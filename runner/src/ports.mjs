import { readFile, readdir, readlink } from 'node:fs/promises';

/**
 * Finds the port a project's server actually opened.
 *
 * The runner hands each project a port through the PORT environment variable, but that is only a
 * suggestion: Vite ignores PORT entirely and listens on 5173, and it is the framework the models
 * reach for most. WebContainer never had this problem because it observes the listen() call rather
 * than dictating a port, so the runner observes too.
 *
 * Observation is done through /proc: the sockets held by the project's own processes, matched
 * against the kernel's table of listening sockets. Nothing is inferred from command output, whose
 * format differs per framework and changes between versions.
 */
const LISTEN_STATE = '0A';

/** Processes belonging to a process group. Commands are spawned detached, so pid == pgid. */
export async function processGroupMembers(pgid, procRoot = '/proc') {
  let entries;

  try {
    entries = await readdir(procRoot);
  } catch {
    return [];
  }

  const members = [];

  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }

    try {
      const stat = await readFile(`${procRoot}/${entry}/stat`, 'utf8');

      /*
       * The second field is the executable name in parentheses and may itself contain spaces and
       * parentheses, so the fields after it are found from the last ')' rather than by splitting
       * the whole line. From there: state, ppid, pgrp.
       */
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');

      if (Number(fields[2]) === pgid) {
        members.push(Number(entry));
      }
    } catch {
      // the process exited while we were looking at it
    }
  }

  return members;
}

/** The socket inodes a set of processes has open. */
export async function socketInodes(pids, procRoot = '/proc') {
  const inodes = new Set();

  for (const pid of pids) {
    let descriptors;

    try {
      descriptors = await readdir(`${procRoot}/${pid}/fd`);
    } catch {
      continue;
    }

    for (const descriptor of descriptors) {
      try {
        const target = await readlink(`${procRoot}/${pid}/fd/${descriptor}`);
        const match = /^socket:\[(\d+)\]$/.exec(target);

        if (match) {
          inodes.add(match[1]);
        }
      } catch {
        // the descriptor closed while we were looking at it
      }
    }
  }

  return inodes;
}

/** Listening TCP ports, from the kernel's tables, restricted to the given socket inodes. */
export async function listeningPortsForInodes(inodes, procRoot = '/proc') {
  const ports = new Set();

  for (const table of [`${procRoot}/net/tcp`, `${procRoot}/net/tcp6`]) {
    let content;

    try {
      content = await readFile(table, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split('\n').slice(1)) {
      const columns = line.trim().split(/\s+/);

      if (columns.length < 10 || columns[3] !== LISTEN_STATE || !inodes.has(columns[9])) {
        continue;
      }

      const port = Number.parseInt(columns[1].split(':')[1], 16);

      if (Number.isFinite(port) && port > 0) {
        ports.add(port);
      }
    }
  }

  return [...ports];
}

/**
 * The port a project is serving on, or undefined if it is not listening yet.
 *
 * `preferred` is the port the runner assigned: when a framework does respect PORT that is the one
 * to use, and only otherwise is the lowest observed port taken.
 */
export async function findServingPort(pgids, preferred, procRoot = '/proc') {
  const pids = [];

  for (const pgid of pgids) {
    pids.push(...(await processGroupMembers(pgid, procRoot)));
  }

  if (pids.length === 0) {
    return undefined;
  }

  const ports = await listeningPortsForInodes(await socketInodes(pids, procRoot), procRoot);

  if (ports.length === 0) {
    return undefined;
  }

  return ports.includes(preferred) ? preferred : Math.min(...ports);
}
