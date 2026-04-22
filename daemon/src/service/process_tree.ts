import fs from "fs";

import type { IInstanceProcessRuntimeState } from "../entity/instance/interface";

export interface ILinuxProcessStat {
  pid: number;
  ppid: number;
  pgrp: number;
  session: number;
  ttyNr: number;
  state: string;
  command: string;
}

export interface ILinuxProcessTreeNode extends ILinuxProcessStat {
  depth: number;
}

export interface IInspectLinuxPtyProcessResult extends IInstanceProcessRuntimeState {
  liveDescendantPids: number[];
  zombiePids: number[];
}

type KillFn = (pid: number, signal?: NodeJS.Signals | number) => void;

function isNumericPidName(name: string) {
  return /^\d+$/.test(name);
}

export function parseLinuxProcStat(statRaw: string): ILinuxProcessStat {
  const firstSpaceIndex = statRaw.indexOf(" ");
  const closeBracketIndex = statRaw.lastIndexOf(")");
  if (firstSpaceIndex < 0 || closeBracketIndex < 0 || closeBracketIndex <= firstSpaceIndex) {
    throw new Error("Invalid /proc stat payload");
  }

  const pid = Number(statRaw.slice(0, firstSpaceIndex));
  const command = statRaw.slice(firstSpaceIndex + 2, closeBracketIndex);
  const statTokens = statRaw.slice(closeBracketIndex + 2).trim().split(/\s+/);

  return {
    pid,
    command,
    state: statTokens[0] || "",
    ppid: Number(statTokens[1] || 0),
    pgrp: Number(statTokens[2] || 0),
    session: Number(statTokens[3] || 0),
    ttyNr: Number(statTokens[4] || 0)
  };
}

export function isZombieLinuxProcessState(state?: string) {
  return state === "Z";
}

export function isLiveLinuxProcessState(state?: string) {
  if (!state) return false;
  return !["Z", "X", "x"].includes(state);
}

export function readLinuxProcessTable() {
  const table = new Map<number, ILinuxProcessStat>();
  if (process.platform !== "linux") return table;

  for (const entry of fs.readdirSync("/proc")) {
    if (!isNumericPidName(entry)) continue;
    try {
      const statRaw = fs.readFileSync(`/proc/${entry}/stat`, "utf-8");
      const stat = parseLinuxProcStat(statRaw);
      if (stat.pid > 0) {
        table.set(stat.pid, stat);
      }
    } catch {
      continue;
    }
  }

  return table;
}

export function buildLinuxProcessTree(
  rootPid: number,
  table: ReadonlyMap<number, ILinuxProcessStat>
) {
  const result = new Map<number, ILinuxProcessTreeNode>();
  const root = table.get(rootPid);
  if (!root) return result;

  const childrenMap = new Map<number, ILinuxProcessStat[]>();
  for (const stat of table.values()) {
    if (!childrenMap.has(stat.ppid)) {
      childrenMap.set(stat.ppid, []);
    }
    childrenMap.get(stat.ppid)!.push(stat);
  }

  const queue: Array<{ stat: ILinuxProcessStat; depth: number }> = [{ stat: root, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.set(current.stat.pid, {
      ...current.stat,
      depth: current.depth
    });

    for (const child of childrenMap.get(current.stat.pid) || []) {
      queue.push({
        stat: child,
        depth: current.depth + 1
      });
    }
  }

  return result;
}

export function inspectLinuxPtyProcess(
  rootPid?: number | string,
  childPid?: number | string,
  table?: ReadonlyMap<number, ILinuxProcessStat>
): IInspectLinuxPtyProcessResult {
  const numericRootPid = Number(rootPid);
  const numericChildPid = Number(childPid);
  const effectiveTable = table ?? readLinuxProcessTable();

  if (
    (!table && process.platform !== "linux") ||
    !numericRootPid ||
    Number.isNaN(numericRootPid) ||
    numericRootPid <= 0
  ) {
    return {
      pid: numericChildPid || numericRootPid || undefined,
      rootPid: numericRootPid || undefined,
      childPid: numericChildPid || undefined,
      healthy: true,
      sessionAlive: true,
      liveDescendantPids: [],
      zombiePids: []
    };
  }

  const tree = buildLinuxProcessTree(numericRootPid, effectiveTable);
  const root = tree.get(numericRootPid);
  const child = numericChildPid > 0 ? effectiveTable.get(numericChildPid) : undefined;
  const descendants = [...tree.values()].filter((item) => item.pid !== numericRootPid);
  const liveDescendants = descendants
    .filter((item) => isLiveLinuxProcessState(item.state))
    .sort((a, b) => b.depth - a.depth || a.pid - b.pid);
  const zombiePids = descendants
    .filter((item) => isZombieLinuxProcessState(item.state))
    .map((item) => item.pid);

  const liveBusinessProcess =
    liveDescendants[0] ||
    (child && isLiveLinuxProcessState(child.state)
      ? {
          ...child,
          depth: 1
        }
      : undefined);

  const sessionAlive = Boolean(
    (child && isLiveLinuxProcessState(child.state) && child.ttyNr !== 0) ||
      liveDescendants.some((item) => item.ttyNr !== 0)
  );

  const rootAlive = Boolean(root && isLiveLinuxProcessState(root.state));
  const healthy = Boolean(rootAlive && liveBusinessProcess);

  return {
    pid: liveBusinessProcess?.pid,
    rootPid: root?.pid ?? numericRootPid,
    childPid: child?.pid ?? (numericChildPid > 0 ? numericChildPid : undefined),
    rootState: root?.state,
    childState: child?.state,
    sessionAlive,
    healthy,
    liveDescendantPids: liveDescendants.map((item) => item.pid),
    zombiePids
  };
}

export function killLinuxProcessTree(
  rootPid?: number | string,
  signal: NodeJS.Signals | number = "SIGKILL",
  table?: ReadonlyMap<number, ILinuxProcessStat>,
  killFn: KillFn = (pid, resolvedSignal) => process.kill(pid, resolvedSignal)
) {
  const numericRootPid = Number(rootPid);
  const effectiveTable = table ?? readLinuxProcessTable();
  if (
    (!table && process.platform !== "linux") ||
    !numericRootPid ||
    Number.isNaN(numericRootPid) ||
    numericRootPid <= 0
  ) {
    return false;
  }

  const tree = buildLinuxProcessTree(numericRootPid, effectiveTable);
  const root = tree.get(numericRootPid);
  if (!root) return false;

  let hasKilled = false;
  const liveNodes = [...tree.values()]
    .filter((node) => isLiveLinuxProcessState(node.state))
    .sort((a, b) => b.depth - a.depth || a.pid - b.pid);

  if (root.pgrp > 0 && root.pgrp === root.pid) {
    try {
      killFn(-root.pgrp, signal);
      hasKilled = true;
    } catch {
      // Ignore and fall back to explicit child-tree traversal.
    }
  }

  for (const node of liveNodes) {
    try {
      killFn(node.pid, signal);
      hasKilled = true;
    } catch {
      continue;
    }
  }

  return hasKilled;
}
