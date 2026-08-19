import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createConnection } from 'node:net';
import { isValidProjectId, resolveInsideProject } from './paths.mjs';

const PORT_RANGE_START = 41000;
const PORT_RANGE_END = 41999;
const READY_POLL_MS = 500;
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

  #allocatePort() {
    const taken = new Set([...this.#projects.values()].map((project) => project.port));

    for (let attempt = 0; attempt <= PORT_RANGE_END - PORT_RANGE_START; attempt++) {
      const port = this.#nextPort;
      this.#nextPort = this.#nextPort >= PORT_RANGE_END ? PORT_RANGE_START : this.#nextPort + 1;

      if (!taken.has(port)) {
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
      port: this.#allocatePort(),
      processes: new Map(),
      lastSeen: Date.now(),
      ready: false,
    };

    await mkdir(project.dir, { recursive: true });
    this.#projects.set(projectId, project);

    return project;
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

  /** Runs a command in the project directory, streaming its output through onEvent. */
  async spawn(projectId, command, args = []) {
    const project = await this.open(projectId);
    project.lastSeen = Date.now();

    const child = spawn(command, args, {
      cwd: project.dir,
      env: projectEnv(project.port),
      shell: true,
    });

    const processId = String(child.pid ?? Math.random().toString(36).slice(2));
    project.processes.set(processId, child);

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

  kill(projectId, processId) {
    const child = this.#projects.get(projectId)?.processes.get(processId);
    child?.kill('SIGTERM');
  }

  /**
   * Detects the dev server by connecting to the port we assigned, rather than by reading the
   * command output. Output formats differ per framework and change between versions; a successful
   * TCP connection does not.
   */
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

      if (!(await canConnect(project.port))) {
        return;
      }

      clearInterval(project.readyWatcher);
      project.readyWatcher = undefined;
      project.ready = true;

      this.onEvent(project.id, {
        type: 'server-ready',
        port: project.port,
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
      child.kill('SIGTERM');
    }

    this.#projects.delete(projectId);

    if (deleteFiles) {
      await rm(project.dir, { recursive: true, force: true });
    }
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
