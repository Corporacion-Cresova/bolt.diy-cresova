import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createConnection, createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { existsSync } from 'node:fs';
import { isValidProjectId, resolveInsideProject } from './paths.mjs';
import { findServingPort } from './ports.mjs';

const PORT_RANGE_START = 41000;
const PORT_RANGE_END = 41999;
const KILL_GRACE_MS = 4000;

/*
 * Where a project remembers how its server was started. It has to live on disk: the point is to
 * survive the runner process being replaced, which is what a redeploy does.
 */
const SERVER_MEMO = '.cresova-runner.json';
const READY_POLL_MS = 500;

/** Generous: a cold dev server can spend a while on the first request before it answers. */
const HTTP_PROBE_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 180_000;

/**
 * Environment handed to project processes.
 *
 * Deliberately an allowlist. These processes run code written by a model, including npm install
 * scripts, and must never be able to read the OpenRouter or Pexels credentials that live in this
 * service's environment.
 */
function projectEnv(port) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'development',
    CI: 'true',
    FORCE_COLOR: '0',
    PORT: String(port),
  };
}

/**
 * Whether nothing is listening on a port.
 *
 * Binding is the authoritative test, and it is worth doing: a dev server orphaned by a previous
 * runner keeps its port, and handing that port to a new project would make the preview proxy serve
 * one project's site under another project's name.
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

/**
 * Whether the dev server on a port actually serves a page.
 *
 * An open port is not a working preview. Vite binds its port and only then resolves dependencies,
 * so the first request can arrive before there is anything to answer with — which is exactly the
 * blank preview that only a manual reload fixed. Waiting for a real response before announcing the
 * server costs nothing and warms the dev server up, so the browser's first load is the second
 * request rather than the first.
 */
function answersHttp(port) {
  return new Promise((resolve) => {
    const probe = httpRequest({ host: '127.0.0.1', port, path: '/', method: 'GET' }, (response) => {
      response.resume();
      resolve(true);
    });

    probe.setTimeout(HTTP_PROBE_TIMEOUT_MS, () => {
      probe.destroy();
      resolve(false);
    });
    probe.once('error', () => resolve(false));
    probe.end();
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

export class ProjectManager {
  #projects = new Map();
  #nextPort = PORT_RANGE_START;

  constructor({ root, previewDomain, onEvent }) {
    this.root = root;
    this.previewDomain = previewDomain;
    this.onEvent = onEvent;
  }

  async #allocatePort() {
    const taken = new Set([...this.#projects.values()].map((project) => project.port));

    for (let attempt = 0; attempt <= PORT_RANGE_END - PORT_RANGE_START; attempt++) {
      const port = this.#nextPort;
      this.#nextPort = this.#nextPort >= PORT_RANGE_END ? PORT_RANGE_START : this.#nextPort + 1;

      if (!taken.has(port) && (await isPortFree(port))) {
        return port;
      }
    }

    throw new Error('No free port available for a new project');
  }

  async open(projectId) {
    if (!isValidProjectId(projectId)) {
      throw new Error(`Invalid project id: ${projectId}`);
    }

    const existing = this.#projects.get(projectId);

    if (existing) {
      existing.lastSeen = Date.now();
      return existing;
    }

    const project = {
      id: projectId,
      dir: `${this.root}/${projectId}`,
      port: await this.#allocatePort(),
      processes: new Map(),
      lastSeen: Date.now(),
      ready: false,
      servingPort: undefined,
    };

    await mkdir(project.dir, { recursive: true });
    this.#projects.set(projectId, project);

    /*
     * Deliberately not awaited: bringing the previous server back is a nicety, and the browser must
     * not wait on it. If it were part of opening the project, a slow or failing restore would hold
     * up the handshake and the client would hang with no way to tell why.
     */
    void this.#restoreServer(project).catch((error) => {
      console.log(`Could not restore the server for ${project.id}: ${error?.message ?? error}`);
    });

    return project;
  }

  /**
   * Writes down the command that brought a server up.
   *
   * The files survive a restart because they are on a volume, but the running server does not, and
   * nothing else knows how to bring it back: the browser only sends a start command while it is
   * generating. Without this, a redeploy leaves the project with all its files and a dead preview.
   */
  async #rememberServerCommand(project) {
    if (!project.lastCommand) {
      return;
    }

    try {
      await writeFile(
        `${project.dir}/${SERVER_MEMO}`,
        JSON.stringify({ command: project.lastCommand, rememberedAt: Date.now() }),
      );
    } catch {
      // losing the memo only costs an automatic restart, never correctness
    }
  }

  /** Brings the server back after the runner itself was restarted. */
  async #restoreServer(project) {
    let memo;

    try {
      memo = JSON.parse(await readFile(`${project.dir}/${SERVER_MEMO}`, 'utf8'));
    } catch {
      // nothing was ever started here
      return;
    }

    if (!memo?.command) {
      return;
    }

    console.log(`Restoring the server for ${project.id}: ${memo.command}`);
    await this.spawn(project.id, memo.command, []);
  }

  get(projectId) {
    return this.#projects.get(projectId);
  }

  previewUrl(projectId) {
    return `https://${projectId}.${this.previewDomain}`;
  }

  async writeFile(projectId, path, content) {
    const project = await this.open(projectId);
    const target = resolveInsideProject(project.dir, path);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  async readFile(projectId, path) {
    const project = await this.open(projectId);
    return readFile(resolveInsideProject(project.dir, path), 'utf8');
  }

  async mkdir(projectId, path) {
    const project = await this.open(projectId);
    await mkdir(resolveInsideProject(project.dir, path), { recursive: true });
  }

  async rm(projectId, path, options = {}) {
    const project = await this.open(projectId);
    await rm(resolveInsideProject(project.dir, path), { recursive: !!options.recursive, force: true });
  }

  async readdir(projectId, path, options = {}) {
    const project = await this.open(projectId);
    const entries = await readdir(resolveInsideProject(project.dir, path), { withFileTypes: true });

    return options.withFileTypes
      ? entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
      : entries.map((entry) => entry.name);
  }

  /**
   * Every file in the project the browser has not written itself.
   *
   * The browser's file tree only ever hears about its own writes; a command that scaffolds files or
   * generates a lockfile leaves the tree believing they do not exist. This is not a live watch —
   * that would mean streaming every path `npm install` touches through the socket to say nothing
   * useful — it is a one-shot read, taken right after a command finishes, so the tree can catch up
   * on whatever changed underneath it.
   */
  async tree(projectId) {
    const project = await this.open(projectId);
    const files = [];

    const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === SERVER_MEMO
        ) {
          continue;
        }

        const absolute = join(dir, entry.name);
        const path = relative(project.dir, absolute);

        if (entry.isDirectory()) {
          files.push({ path, type: 'dir' });
          await walk(absolute);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        try {
          files.push({ path, type: 'file', content: await readFile(absolute, 'utf8') });
        } catch {
          // unreadable as text (binary, gone by the time we got to it) — still worth listing
          files.push({ path, type: 'file' });
        }
      }
    };

    await walk(project.dir);

    return files;
  }

  /** Runs a command in the project directory, streaming its output through onEvent. */
  async spawn(projectId, command, args = []) {
    const project = await this.open(projectId);
    project.lastSeen = Date.now();

    const child = spawn(command, args, {
      cwd: project.dir,
      env: projectEnv(project.port),
      shell: true,

      /*
       * Its own process group. `shell: true` means the child is a shell, and a dev server started
       * as `npm install && npm run dev` is its grandchild: signalling the shell alone would leave
       * the server holding the port. Killing the group reaches every descendant.
       */
      detached: true,
    });

    const processId = String(child.pid ?? Math.random().toString(36).slice(2));
    project.processes.set(processId, child);
    project.lastCommand = [command, ...args].join(' ').trim();

    const emit = (stream, chunk) =>
      this.onEvent(projectId, { type: 'output', processId, stream, data: chunk.toString() });

    child.stdout?.on('data', (chunk) => emit('stdout', chunk));
    child.stderr?.on('data', (chunk) => emit('stderr', chunk));

    child.on('exit', (code) => {
      project.processes.delete(processId);
      this.onEvent(projectId, { type: 'exit', processId, code: code ?? 0 });
    });

    this.#watchForServer(project);

    return processId;
  }

  write(projectId, processId, data) {
    this.#projects.get(projectId)?.processes.get(processId)?.stdin?.write(data);
  }

  /**
   * Stops a command. SIGTERM first so a dev server can shut down cleanly, then SIGKILL if it is
   * still there: the browser side shell waits for the exit before it will run anything else, so a
   * process that ignores the signal would block the whole session.
   */
  kill(projectId, processId) {
    const project = this.#projects.get(projectId);
    const child = project?.processes.get(processId);

    if (!child) {
      return;
    }

    killTree(child);

    setTimeout(() => {
      if (project.processes.get(processId) === child) {
        killTree(child, 'SIGKILL');
      }
    }, KILL_GRACE_MS).unref?.();
  }

  /**
   * Which port the project is serving on, if any.
   *
   * Asking the kernel which port the project's own processes opened, rather than assuming it obeyed
   * PORT. On a system without /proc there is nothing to ask, so the assigned port is probed
   * directly — the same behaviour as before, and enough for the frameworks that do respect PORT.
   */
  async #findServingPort(project) {
    const groups = [...project.processes.values()].map((child) => child.pid).filter(Boolean);

    if (groups.length > 0) {
      const observed = await findServingPort(groups, project.port);

      if (observed !== undefined) {
        return observed;
      }
    }

    if (existsSync('/proc/net/tcp')) {
      return undefined;
    }

    return (await canConnect(project.port)) ? project.port : undefined;
  }

  #watchForServer(project) {
    if (project.readyWatcher) {
      return;
    }

    const startedAt = Date.now();

    project.readyWatcher = setInterval(async () => {
      if (Date.now() - startedAt > READY_TIMEOUT_MS) {
        clearInterval(project.readyWatcher);
        project.readyWatcher = undefined;

        return;
      }

      // the HTTP probe can outlast the poll interval, and two of them would race each other
      if (project.probing) {
        return;
      }

      project.probing = true;

      let servingPort;

      try {
        servingPort = await this.#findServingPort(project);

        if (servingPort !== undefined && !(await answersHttp(servingPort))) {
          servingPort = undefined;
        }
      } finally {
        project.probing = false;
      }

      if (servingPort === undefined) {
        return;
      }

      if (!project.readyWatcher) {
        return;
      }

      clearInterval(project.readyWatcher);
      project.readyWatcher = undefined;
      project.ready = true;
      project.servingPort = servingPort;
      void this.#rememberServerCommand(project);

      this.onEvent(project.id, {
        type: 'server-ready',
        port: servingPort,
        url: this.previewUrl(project.id),
      });
    }, READY_POLL_MS);
  }

  touch(projectId) {
    const project = this.#projects.get(projectId);

    if (project) {
      project.lastSeen = Date.now();
    }
  }

  /** Stops everything for a project. The files stay: the browser holds the source of truth. */
  async close(projectId, { deleteFiles = false } = {}) {
    const project = this.#projects.get(projectId);

    if (!project) {
      return;
    }

    clearInterval(project.readyWatcher);

    for (const child of project.processes.values()) {
      killTree(child);
    }

    this.#projects.delete(projectId);

    if (deleteFiles) {
      await rm(project.dir, { recursive: true, force: true });
    }
  }

  /**
   * Stops every project. Called when the runner itself is shutting down.
   *
   * Commands run in their own process group so a dev server can be signalled together with the
   * shell that started it, and that same detachment means they would otherwise survive the runner
   * and keep holding ports. Files are kept: the browser can push them again.
   */
  async closeAll() {
    await Promise.all([...this.#projects.keys()].map((projectId) => this.close(projectId)));
  }

  async reapIdle(maxIdleMs) {
    const now = Date.now();

    for (const [projectId, project] of this.#projects) {
      if (now - project.lastSeen > maxIdleMs) {
        await this.close(projectId, { deleteFiles: true });
      }
    }
  }

  stats() {
    return {
      projects: this.#projects.size,
      running: [...this.#projects.values()].filter((project) => project.processes.size > 0).length,
    };
  }
}

/**
 * Stops a command and everything it started.
 *
 * Children are spawned detached, so the child's pid is also its process group id and a negative
 * pid signals the whole group. If the group is already gone the kill throws, which is the normal
 * case for a command that just exited on its own.
 */
export function killTree(child, signal = 'SIGTERM') {
  if (!child?.pid) {
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // already gone
    }
  }
}
