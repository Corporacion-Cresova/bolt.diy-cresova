import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findServingSockets, listeningPortsForInodes, listeningSocketsForInodes } from './ports.mjs';

/*
 * A stand-in /proc, because the real one cannot be made to show what this has to handle: this
 * container has no IPv6 at all, and the whole point is what happens when a project's server ends up
 * somewhere other than the IPv4 loopback the code used to assume.
 *
 * The rows are the kernel's own shape. The columns that matter are the local address, the state,
 * and the inode; the rest is padding so the parser sees a row of the right width.
 */
const LISTEN = '0A';
const PORT_5173 = '1435';
const PORT_3000 = '0BB8';

const IPV4_LOOPBACK = '0100007F';
const IPV4_ANY = '00000000';
const IPV6_LOOPBACK = '00000000000000000000000001000000';
const IPV6_ANY = '00000000000000000000000000000000';
const IPV6_MAPPED_V4 = '0000000000000000FFFF00000100007F';

function row(index, address, port, inode, state = LISTEN) {
  return `   ${index}: ${address}:${port} 00000000:0000 ${state} 00000000:00000000 00:00000000 00000000     0        0 ${inode} 1 0000000000000000 100 0 0 10 0`;
}

function table(rows) {
  return [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    ...rows,
  ].join('\n');
}

describe('reading which sockets a project is listening on', () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cresova-proc-'));
    await mkdir(join(root, 'net'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads an IPv4 server as reachable on the IPv4 loopback', async () => {
    await writeFile(join(root, 'net', 'tcp'), table([row(0, IPV4_LOOPBACK, PORT_5173, '9001')]));

    expect(await listeningSocketsForInodes(new Set(['9001']), root)).toEqual([{ host: '127.0.0.1', port: 5173 }]);
  });

  it('reads a server bound to every IPv4 address the same way', async () => {
    await writeFile(join(root, 'net', 'tcp'), table([row(0, IPV4_ANY, PORT_5173, '9001')]));

    expect(await listeningSocketsForInodes(new Set(['9001']), root)).toEqual([{ host: '127.0.0.1', port: 5173 }]);
  });

  /*
   * The case this whole change exists for. A dev server here is listening, shows up in the kernel's
   * table, and refuses every connection to 127.0.0.1 — which reads from the outside exactly like a
   * server that opened its port and then wedged, and sent the investigation the wrong way.
   */
  it('reads an IPv6 server as reachable on the IPv6 loopback, not the IPv4 one', async () => {
    await writeFile(join(root, 'net', 'tcp6'), table([row(0, IPV6_LOOPBACK, PORT_5173, '9002')]));

    expect(await listeningSocketsForInodes(new Set(['9002']), root)).toEqual([{ host: '::1', port: 5173 }]);
  });

  it('reads a dual stack server as reachable on the IPv6 loopback, which also serves IPv4', async () => {
    await writeFile(join(root, 'net', 'tcp6'), table([row(0, IPV6_ANY, PORT_5173, '9002')]));

    expect(await listeningSocketsForInodes(new Set(['9002']), root)).toEqual([{ host: '::1', port: 5173 }]);
  });

  /*
   * An IPv4 socket wearing an IPv6 shape. `::1` would not reach it, so the family has to be read
   * from the address rather than from which table it turned up in.
   */
  it('reads an IPv4 mapped address as IPv4, however it is filed', async () => {
    await writeFile(join(root, 'net', 'tcp6'), table([row(0, IPV6_MAPPED_V4, PORT_5173, '9002')]));

    expect(await listeningSocketsForInodes(new Set(['9002']), root)).toEqual([{ host: '127.0.0.1', port: 5173 }]);
  });

  it('ignores a socket that is not listening, and one belonging to somebody else', async () => {
    await writeFile(
      join(root, 'net', 'tcp'),
      table([row(0, IPV4_LOOPBACK, PORT_5173, '9001', '01'), row(1, IPV4_LOOPBACK, PORT_3000, '7777')]),
    );

    expect(await listeningSocketsForInodes(new Set(['9001']), root)).toEqual([]);
  });

  it('still answers with plain port numbers for the readings that only want those', async () => {
    await writeFile(join(root, 'net', 'tcp'), table([row(0, IPV4_LOOPBACK, PORT_5173, '9001')]));
    await writeFile(join(root, 'net', 'tcp6'), table([row(0, IPV6_ANY, PORT_5173, '9002')]));

    // the same port held on both families is one port, not two
    expect(await listeningPortsForInodes(new Set(['9001', '9002']), root)).toEqual([5173]);
  });
});

describe("the order a project's sockets are worth trying in", () => {
  let root;

  /** A process in its own group, holding the given socket inodes. */
  async function processHolding(pid, inodes) {
    await mkdir(join(root, String(pid), 'fd'), { recursive: true });
    await writeFile(join(root, String(pid), 'stat'), `${pid} (node) S 1 ${pid} ${pid} 0 -1 4194304 0 0`);

    for (const [index, inode] of inodes.entries()) {
      await symlink(`socket:[${inode}]`, join(root, String(pid), 'fd', String(index + 3)));
    }
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cresova-proc-order-'));
    await mkdir(join(root, 'net'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /*
   * Vite steps upward past every port it finds taken, so the highest number is the newest server
   * and the lowest is the oldest — the one most likely to be the wedged leftover. `preferred` still
   * leads, because a framework that honours PORT is saying plainly where it is.
   */
  it('puts the assigned port first, then the newest server, then the older ones', async () => {
    await processHolding(4242, ['9001', '9002', '9003']);
    await writeFile(
      join(root, 'net', 'tcp'),
      table([
        row(0, IPV4_LOOPBACK, PORT_5173, '9001'),
        row(1, IPV4_LOOPBACK, PORT_3000, '9002'),
        row(2, IPV4_LOOPBACK, '1436', '9003'),
      ]),
    );

    expect(await findServingSockets([4242], 3000, root)).toEqual([
      { host: '127.0.0.1', port: 3000 },
      { host: '127.0.0.1', port: 5174 },
      { host: '127.0.0.1', port: 5173 },
    ]);
  });

  it('tries the IPv4 route before the IPv6 one when a port is held on both', async () => {
    await processHolding(4243, ['9001', '9002']);
    await writeFile(join(root, 'net', 'tcp'), table([row(0, IPV4_LOOPBACK, PORT_5173, '9001')]));
    await writeFile(join(root, 'net', 'tcp6'), table([row(0, IPV6_ANY, PORT_5173, '9002')]));

    expect(await findServingSockets([4243], 41000, root)).toEqual([
      { host: '127.0.0.1', port: 5173 },
      { host: '::1', port: 5173 },
    ]);
  });

  it('finds nothing when the project has no processes left', async () => {
    expect(await findServingSockets([9999], 41000, root)).toEqual([]);
  });
});
