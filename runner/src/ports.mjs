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

/**
 * The loopback address a listening socket can actually be reached on.
 *
 * Reading the port and assuming `127.0.0.1` is an assumption, not an observation, and it is the
 * same kind of assumption that `PORT` turned out to be: the whole point of asking the kernel is to
 * stop guessing what the project did. A dev server that ends up on the IPv6 loopback is listening,
 * shows up here, and refuses every connection to `127.0.0.1` — which reads from the outside exactly
 * like a server that opened its port and wedged.
 *
 * The IPv4 table only ever holds IPv4 sockets, and one bound to `0.0.0.0` or to `127.0.0.1` is
 * reachable at `127.0.0.1` either way. In the IPv6 table, `::1` reaches both a socket bound to the
 * IPv6 loopback and one bound to `::`, since Node leaves dual stack on. The exception is an
 * IPv4-mapped address (`::ffff:a.b.c.d`), which is an IPv4 socket wearing an IPv6 shape and has to
 * be reached as IPv4.
 */
const IPV4_MAPPED_PREFIX = '0000000000000000FFFF0000';

function loopbackFor(table, addressHex) {
  if (table === 'tcp') {
    return '127.0.0.1';
  }

  return addressHex.toUpperCase().startsWith(IPV4_MAPPED_PREFIX) ? '127.0.0.1' : '::1';
}

/**
 * Listening TCP sockets, from the kernel's tables, restricted to the given socket inodes.
 *
 * Each entry carries the address to reach it on as well as the port, because those are two separate
 * facts and only one of them used to be read.
 */
export async function listeningSocketsForInodes(inodes, procRoot = '/proc') {
  const sockets = new Map();

  for (const table of ['tcp', 'tcp6']) {
    let content;

    try {
      content = await readFile(`${procRoot}/net/${table}`, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split('\n').slice(1)) {
      const columns = line.trim().split(/\s+/);

      if (columns.length < 10 || columns[3] !== LISTEN_STATE || !inodes.has(columns[9])) {
        continue;
      }

      const [addressHex, portHex] = columns[1].split(':');
      const port = Number.parseInt(portHex, 16);

      if (!Number.isFinite(port) || port <= 0) {
        continue;
      }

      const host = loopbackFor(table, addressHex);

      // the same port can be held on both families; each address is worth trying on its own
      sockets.set(`${host}:${port}`, { host, port });
    }
  }

  return [...sockets.values()];
}

/** Just the port numbers, for the readings that only care which ports are held. */
export async function listeningPortsForInodes(inodes, procRoot = '/proc') {
  const sockets = await listeningSocketsForInodes(inodes, procRoot);

  return [...new Set(sockets.map((socket) => socket.port))];
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
export async function findServingSockets(pgids, preferred, procRoot = '/proc') {
  const pids = [];

  for (const pgid of pgids) {
    pids.push(...(await processGroupMembers(pgid, procRoot)));
  }

  if (pids.length === 0) {
    return [];
  }

  const sockets = await listeningSocketsForInodes(await socketInodes(pids, procRoot), procRoot);

  /*
   * `preferred` first, because a framework that honours PORT is telling us plainly where it is.
   * After that the highest port, since Vite steps upward past every port it finds taken and the
   * newest server is therefore the one with the highest number. IPv4 before IPv6 at the same port:
   * the same socket often appears in both tables, and the IPv4 route is the one everything else
   * here already speaks.
   */
  const isIpv6 = (socket) => socket.host.includes(':');

  return sockets.sort((a, b) => {
    if ((a.port === preferred) !== (b.port === preferred)) {
      return a.port === preferred ? -1 : 1;
    }

    if (a.port !== b.port) {
      return b.port - a.port;
    }

    // never localeCompare here: collation does not order punctuation the way an address reads
    return Number(isIpv6(a)) - Number(isIpv6(b));
  });
}
