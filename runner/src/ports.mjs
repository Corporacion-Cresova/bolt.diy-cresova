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
 * Every port a project's processes are listening on, in the order worth trying them.
 *
 * This used to pick one and commit to it — `preferred` if it was open, otherwise the lowest number
 * observed — and the lowest number is a trap. Vite always tries 5173 first and steps up when it is
 * taken, so a project that ended up with servers on 5173, 5174 and 5175 has its *newest* server on
 * the highest port and its oldest on the lowest. Choosing the minimum therefore chose the most
 * stale one, and when that one was wedged the search never moved on: it re-picked the same dead
 * port every half second until the watcher gave up, while a healthy server sat one number away.
 *
 * Returning candidates instead lets the caller settle it the only way that is not a guess — by
 * asking each one for a page. `preferred` still leads, because a framework that honours PORT is
 * telling us plainly where it is.
 */
export async function findServingPorts(pgids, preferred, procRoot = '/proc') {
  const pids = [];

  for (const pgid of pgids) {
    pids.push(...(await processGroupMembers(pgid, procRoot)));
  }

  if (pids.length === 0) {
    return [];
  }

  const ports = await listeningPortsForInodes(await socketInodes(pids, procRoot), procRoot);

  // newest last from Vite's stepping, so the highest is the likeliest live one after `preferred`
  const rest = ports.filter((port) => port !== preferred).sort((a, b) => b - a);

  return ports.includes(preferred) ? [preferred, ...rest] : rest;
}
