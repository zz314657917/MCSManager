import assert from "assert/strict";

import {
  buildLinuxProcessTree,
  inspectLinuxPtyProcess,
  killLinuxProcessTree,
  parseLinuxProcStat
} from "./process_tree";

const createProcStat = (
  pid: number,
  command: string,
  state: string,
  ppid: number,
  pgrp = pid,
  session = pid,
  ttyNr = 0
) =>
  `${pid} (${command}) ${state} ${ppid} ${pgrp} ${session} ${ttyNr} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`;

const baseTable = new Map(
  [
    parseLinuxProcStat(createProcStat(1000, "pty_linux_x64", "S", 1)),
    parseLinuxProcStat(createProcStat(1001, "sh", "S", 1000)),
    parseLinuxProcStat(createProcStat(1002, "java", "R", 1001))
  ].map((item) => [item.pid, item] as const)
);

const tree = buildLinuxProcessTree(1000, baseTable);
assert.deepEqual(
  [...tree.values()].map((item) => [item.pid, item.depth]),
  [
    [1000, 0],
    [1001, 1],
    [1002, 2]
  ]
);

const healthyPty = inspectLinuxPtyProcess(1000, 1001, baseTable);
assert.equal(healthyPty.healthy, true);
assert.equal(healthyPty.pid, 1002);
assert.equal(healthyPty.rootPid, 1000);
assert.equal(healthyPty.childPid, 1001);

const zombieTable = new Map(
  [
    parseLinuxProcStat(createProcStat(1000, "pty_linux_x64", "S", 1)),
    parseLinuxProcStat(createProcStat(1001, "sh", "Z", 1000))
  ].map((item) => [item.pid, item] as const)
);

const zombiePty = inspectLinuxPtyProcess(1000, 1001, zombieTable);
assert.equal(zombiePty.healthy, false);
assert.equal(zombiePty.pid, undefined);
assert.equal(zombiePty.rootState, "S");
assert.equal(zombiePty.childState, "Z");
assert.deepEqual(zombiePty.zombiePids, [1001]);

const killed: Array<{ pid: number; signal?: NodeJS.Signals | number }> = [];
killLinuxProcessTree(
  1000,
  "SIGKILL",
  zombieTable,
  (pid, signal) => killed.push({ pid, signal })
);
assert.deepEqual(killed, [
  { pid: -1000, signal: "SIGKILL" },
  { pid: 1000, signal: "SIGKILL" }
]);

console.log("process_tree tests passed");
process.exit(0);
