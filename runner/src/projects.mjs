import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createConnection, createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { isValidProjectId, isValidPublishName, resolveInsideProject } from './paths.mjs';
import {
  findServingSockets,
  listeningPortsForInodes,
  listeningSocketsForInodes,
  processGroupMembers,
  socketInodes,
} from './ports.mjs';

/*
 * The same order `#runBuildAction` in the app tries them in — kept in sync by hand, since the two
 * run in different processes with no module to share. Whichever exists first wins.
 */
const BUILD_OUTPUT_DIRS = ['dist', 'build', 'out', 'output', '.next', 'public'];

const PORT_RANGE_START = 41000;
const PORT_RANGE_END = 41999;
const KILL_GRACE_MS = 4000;

/*
 * Where a project remembers how its server was started. It has to live on disk: the point is to
 * survive the runner process being replaced, which is what a redeploy does.
 */
const SERVER_MEMO = '.cresova-runner.json';

/**
 * Files the tree never carries, alongside the directories it already skips.
 *
 * A lockfile is the largest thing in an ordinary project after `node_modules` — comfortably past a
 * megabyte — and it is sent again in full after every command, to establish almost every time that
 * nothing changed. Nothing wants it either: the browser shows it to no one, and `sanitizeText`
 * already strips `package-lock.json` out of what reaches the model, so today it is carried across
 * the socket only to be thrown away at the other end.
 *
 * Left out entirely rather than listed without content: an entry with no content reaches the file
 * store as an empty file, and a file the workbench believes is empty is worse than one it has never
 * heard of.
 */
const UNTRACKED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', '.DS_Store']);
const READY_POLL_MS = 500;

/** `127.0.0.1:5173`, and `[::1]:5173` for the family that needs brackets to be read back. */
function describeSocket({ host, port }) {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}

/**
 * How much of a command's output the diagnostics report carries.
 *
 * The tail, not the head: a server that wedges says what it is stuck on last. Small enough to paste
 * into a conversation. It is the same stream the browser already shows in its terminal, and it
 * cannot carry a credential — project processes are given an allowlisted environment (`projectEnv`)
 * precisely so the OpenRouter and runner secrets are not theirs to print.
 */
const OUTPUT_TAIL_CHARS = 2000;

/** Generous: a cold dev server can spend a while on the first request before it answers. */
const HTTP_PROBE_TIMEOUT_MS = 30_000;

/**
 * How long to keep looking for the server after the last process of the project exited.
 *
 * This, and not a fixed budget from the spawn, is what bounds the search. A dev server is started
 * as `npm install && npm run dev` in a single command, so a fixed budget is really a budget for
 * `npm install` — and on a busy host that install alone can outlast any number worth picking. The
 * watcher used to give up after three minutes measured from the spawn, which meant a project whose
 * install ran long never got its `server-ready`: the server came up, served correctly, and nobody
 * was told. The browser learns of a preview from that one event, so the preview, the refresh and
 * the publish button all stayed missing behind a server that was working.
 *
 * A live process is the honest signal that the server is still on its way. Once nothing is running
 * any more, the command either failed or finished without serving, and a short grace covers the gap
 * between one process exiting and its successor appearing.
 */
const READY_GRACE_AFTER_EXIT_MS = 30_000;

/** Absolute ceiling, so a watcher can never outlive the project that owns it. */
const READY_CEILING_MS = 30 * 60_000;

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
 * Whether the dev server on an address actually serves a page, and if not, what went wrong.
 *
 * An open port is not a working preview. Vite binds its port and only then resolves dependencies,
 * so the first request can arrive before there is anything to answer with — which is exactly the
 * blank preview that only a manual reload fixed. Waiting for a real response before announcing the
 * server costs nothing and warms the dev server up, so the browser's first load is the second
 * request rather than the first.
 *
 * The reason matters as much as the answer, and used to be thrown away. A refused connection and a
 * connection that is accepted and then never answered are **opposite** faults: the first is a
 * server that is not where we are looking — a different address, a port already handed on — and the
 * second is one that started and wedged. Reported as the same «no contestó», every reading of this
 * cost another round of guessing.
 */
function answersHttp(host, port) {
  return new Promise((resolve) => {
    const probe = httpRequest({ host, port, path: '/', method: 'GET' }, (response) => {
      response.resume();
      resolve({ ok: true });
    });

    probe.setTimeout(HTTP_PROBE_TIMEOUT_MS, () => {
      probe.destroy();
      resolve({ ok: false, reason: `aceptó la conexión y no contestó en ${HTTP_PROBE_TIMEOUT_MS / 1000} s` });
    });
    probe.once('error', (error) =>
      resolve({ ok: false, reason: `no aceptó la conexión (${error.code ?? error.message})` }),
    );
    probe.end();
  });
}

/**
 * Runs a command in a directory and waits for it to exit.
 *
 * Unlike `ProjectManager.spawn` below, which starts a dev server expected to keep running and
 * streams its output to the browser, this is for a one-shot command with a result the caller needs
 * before it can do anything else — publishing has nothing to copy until the build finishes.
 */
function runToCompletion(cwd, command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, shell: true });
    let output = '';

    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('exit', (code) => resolve({ exitCode: code ?? 1, output }));
    child.on('error', (error) => resolve({ exitCode: 1, output: `${output}${error.message}` }));
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

  /*
   * The two readiness budgets are settable so a test can exercise both endings in milliseconds
   * rather than minutes. Production passes neither and gets the constants above; nothing else in
   * the service knows they exist.
   */
  constructor({
    root,
    publishedRoot,
    previewDomain,
    onEvent,
    readyGraceAfterExitMs = READY_GRACE_AFTER_EXIT_MS,
    readyCeilingMs = READY_CEILING_MS,
  }) {
    this.root = root;
    this.publishedRoot = publishedRoot;
    this.previewDomain = previewDomain;
    this.onEvent = onEvent;
    this.readyGraceAfterExitMs = readyGraceAfterExitMs;
    this.readyCeilingMs = readyCeilingMs;
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

  publishedUrl(name) {
    return `https://${name}.${this.previewDomain}`;
  }

  /** Where a published site's files live, or undefined if that name has never been published. */
  publishedDir(name) {
    if (!isValidPublishName(name)) {
      return undefined;
    }

    const dir = join(this.publishedRoot, name);

    return existsSync(dir) ? dir : undefined;
  }

  /**
   * Builds the project and serves the result under its own name, replacing whatever was published
   * there before.
   *
   * The directory this writes to is the whole record of what is published: nothing else remembers
   * it, so a publish survives the runner restarting and the live project being closed or reaped —
   * on purpose, since a published site and the dev project that built it have different lifetimes.
   *
   * Copied to `<name>.tmp` and swapped into place by rename rather than written straight into
   * `<name>`, so a request arriving mid-copy finds the previous, complete version — never a
   * half-written one. The rename itself is not instantaneous the way a rename usually is, since the
   * old directory has to be removed first to make room for it; a request in that narrow gap gets a
   * 404 rather than a half-copied site, which is the failure mode this is actually guarding against.
   */
  async publish(projectId, name) {
    if (!isValidPublishName(name)) {
      throw new Error(`Invalid publish name: ${name}`);
    }

    const project = await this.open(projectId);

    // a build takes minutes and prints nothing, so without this the log looks like a hung runner
    console.log(`Building ${projectId} to publish as ${name}`);

    const { exitCode, output } = await runToCompletion(project.dir, 'npm', ['run', 'build'], projectEnv(project.port));

    if (exitCode !== 0) {
      throw new Error(`Build failed (exit ${exitCode}):\n${output}`);
    }

    const sourceDir = BUILD_OUTPUT_DIRS.map((dir) => join(project.dir, dir)).find((dir) => existsSync(dir));

    if (!sourceDir) {
      throw new Error(`No build output found. Looked in: ${BUILD_OUTPUT_DIRS.join(', ')}`);
    }

    await mkdir(this.publishedRoot, { recursive: true });

    const finalDir = join(this.publishedRoot, name);
    const tempDir = join(this.publishedRoot, `${name}.tmp`);

    await rm(tempDir, { recursive: true, force: true });
    await cp(sourceDir, tempDir, { recursive: true });
    await rm(finalDir, { recursive: true, force: true });
    await rename(tempDir, finalDir);
    console.log(`Published ${projectId} as ${name}`);

    return { url: this.publishedUrl(name) };
  }

  /**
   * Everything the runner knows about one project, in one answer.
   *
   * This exists because the same handful of questions kept being asked by hand, one shell command
   * at a time, hours apart: is anything running, what did it open, did the probe ever reach it. The
   * answers only mean something together — a live process with no port is a different fault from a
   * port that never answers — and by the time they were collected separately the project had often
   * moved on. Asking the service that already knows is faster and cannot be measured at the wrong
   * moment.
   *
   * Deliberately no environment and no file contents: this is written to be pasted into a chat, and
   * the environment is where the credentials live.
   */
  /**
   * Whether the project already has files of its own on disk.
   *
   * The browser replays a restored chat's whole artifact when it opens a project, because under
   * WebContainer that is the only way the project comes back: the container dies with the tab. On
   * the runner the files outlive both, so the same replay rewrites what is already there, runs the
   * install again, and starts a second server on top of one that was already serving.
   *
   * It cannot simply be switched off, though — an idle project is reaped, files and all, and coming
   * back to one of those needs exactly that rebuild. So the browser is told which case it is in
   * rather than guessing.
   *
   * The bookkeeping file is not a file of the project's own: a directory holding only that is a
   * project that was reaped and reopened, and it still needs rebuilding.
   */
  async hasFiles(projectId) {
    try {
      const entries = await readdir(`${this.root}/${projectId}`);
      return entries.some((entry) => entry !== SERVER_MEMO);
    } catch {
      return false;
    }
  }

  async diagnostics(projectId) {
    const project = await this.open(projectId);
    const groups = [...project.processes.values()].map((child) => child.pid).filter(Boolean);

    const pids = [];

    for (const group of groups) {
      pids.push(...(await processGroupMembers(group)));
    }

    const inodes = pids.length > 0 ? await socketInodes(pids) : new Set();
    const listeningPorts = pids.length > 0 ? await listeningPortsForInodes(inodes) : [];

    /*
     * The addresses as well as the ports. Reading only the port hides the difference between a
     * server on the IPv4 loopback and one on the IPv6 loopback, and that difference is the whole
     * distance between a preview that works and one that refuses every connection.
     */
    const listeningSockets = pids.length > 0 ? (await listeningSocketsForInodes(inodes)).map(describeSocket) : [];

    return {
      projectId,
      assignedPort: project.port,
      servingPort: project.servingPort,
      servingHost: project.servingHost,
      ready: project.ready,
      liveProcesses: project.processes.size,
      stillWatching: Boolean(project.readyWatcher),
      lastProbe: project.lastProbe,
      listeningPorts,
      listeningSockets,
      lastCommand: project.lastCommand,
      lastOutput: project.lastOutput,
      idleForMs: Date.now() - project.lastSeen,
      publishedNames: existsSync(this.publishedRoot) ? readdirSync(this.publishedRoot) : [],
    };
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
          entry.name === SERVER_MEMO ||
          UNTRACKED_FILES.has(entry.name)
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

    const emit = (stream, chunk) => {
      const data = chunk.toString();
      project.lastOutput = `${project.lastOutput ?? ''}${data}`.slice(-OUTPUT_TAIL_CHARS);
      this.onEvent(projectId, { type: 'output', processId, stream, data });
    };

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
      const candidates = await findServingSockets(groups, project.port);

      /*
       * Asked one by one rather than picked. A project can end up with more than one server — a
       * restored chat replays its artifact, and Vite steps past a port it finds taken — and then
       * which one is *open* stops being the question: the useful one is whichever still answers.
       */
      const refusals = [];

      for (const candidate of candidates) {
        const answer = await answersHttp(candidate.host, candidate.port);

        if (answer.ok) {
          return candidate;
        }

        refusals.push(`${describeSocket(candidate)} ${answer.reason}`);
      }

      project.lastProbe =
        refusals.length > 0 ? `abrió ${refusals.join('; ')}` : 'ningún proceso del proyecto tenía un puerto escuchando';

      return undefined;
    }

    project.lastProbe = 'el proyecto no tiene ningún proceso corriendo';

    if (existsSync('/proc/net/tcp')) {
      return undefined;
    }

    const fallback = { host: '127.0.0.1', port: project.port };

    return (await canConnect(project.port)) && (await answersHttp(fallback.host, fallback.port)).ok
      ? fallback
      : undefined;
  }

  /**
   * Stops looking for the server and says so.
   *
   * Saying so is the point. This used to be a bare `return`, which meant the one signal the browser
   * has that a preview exists simply never arrived: no preview, no refresh, no publish button, and
   * nothing anywhere to say why. A service that is working is then indistinguishable from one that
   * is hung, which is the most expensive shape a failure can take here.
   */
  #stopWatching(project, reason) {
    clearInterval(project.readyWatcher);
    project.readyWatcher = undefined;

    /*
     * What was actually observed, not just that the wait ended.
     *
     * «It never became ready» leaves the two possible faults indistinguishable, and they call for
     * opposite investigations: a server that never opened a port at all is a command that failed or
     * a framework that never got going, while a server holding an open port without answering is
     * one that started and then wedged. Saying which was seen is the difference between a log that
     * closes the question and one that starts another round of guessing.
     */
    const observed = project.lastProbe ?? 'no llegó a observarse nada';

    console.log(`Stopped waiting for the server of ${project.id}: ${reason} (${observed})`);
    this.onEvent(project.id, { type: 'server-timeout', reason, observed });
  }

  #watchForServer(project) {
    if (project.readyWatcher) {
      return;
    }

    const startedAt = Date.now();

    // a project whose command has not been seen running yet is given the same grace as one that just exited
    let lastAliveAt = Date.now();

    project.readyWatcher = setInterval(async () => {
      const now = Date.now();

      if (project.processes.size > 0) {
        lastAliveAt = now;
      }

      if (now - startedAt > this.readyCeilingMs) {
        this.#stopWatching(project, 'it did not start within the time a project is given');

        return;
      }

      if (now - lastAliveAt > this.readyGraceAfterExitMs) {
        this.#stopWatching(project, 'the command that starts it exited without serving anything');

        return;
      }

      // the HTTP probe can outlast the poll interval, and two of them would race each other
      if (project.probing) {
        return;
      }

      project.probing = true;

      let serving;

      try {
        serving = await this.#findServingPort(project);

        // every unsuccessful path leaves its own note inside #findServingPort, which knows what it saw
        if (serving !== undefined) {
          project.lastProbe = `contestó en ${describeSocket(serving)}`;
        }
      } finally {
        project.probing = false;
      }

      if (serving === undefined) {
        return;
      }

      if (!project.readyWatcher) {
        return;
      }

      clearInterval(project.readyWatcher);
      project.readyWatcher = undefined;
      project.ready = true;
      project.servingPort = serving.port;
      project.servingHost = serving.host;
      void this.#rememberServerCommand(project);

      this.onEvent(project.id, {
        type: 'server-ready',
        port: serving.port,
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
