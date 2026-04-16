import { describe, expect, it } from "vitest";

import { normalizeControlOutputLog, splitControlOutputLog } from "./control";

describe("control output normalization", () => {
  it("removes ansi escape sequences and transient prompt lines from polled snapshots", () => {
    const rawOutput = [
      "\u001b[K[16:05:40] [Server thread/INFO]: \u001b[0;37;22m[LyMySQLCore] 玩家 \u001b[0;32;1m何方妖孽 \u001b[0;37;22m数据保存事件开始于: \u001b[0;33;22m16时05分40秒0892\u001b[39;0m",
      "> ",
      "\u001b[K[16:05:40] [Server thread/INFO]: \u001b[0;37;22m玩家\u001b[0;33;1m何方妖孽\u001b[0;37;22m等级数据\u001b[0;33;1m保存\u001b[0;37;22m成功!\u001b[39;0m",
      "> ",
      "\u001b[?1l\u001b>\u001b[?1000l\u001b[?2004l\u001b[?1h\u001b=\u001b[?2004h> ",
      "\u001b[K[16:09:21] [Server thread/INFO]: \u001b[0;37;22m========================\u001b[39;0m",
      "> "
    ].join("\n");

    expect(normalizeControlOutputLog(rawOutput)).toBe(
      [
        "[16:05:40] [Server thread/INFO]: [LyMySQLCore] 玩家 何方妖孽 数据保存事件开始于: 16时05分40秒0892",
        "[16:05:40] [Server thread/INFO]: 玩家何方妖孽等级数据保存成功!",
        "[16:09:21] [Server thread/INFO]: ========================"
      ].join("\n")
    );
  });

  it("treats carriage-return rewrites as in-place updates instead of extra log lines", () => {
    const rawOutput = "> \r\u001b[K[15:58:30] [Server thread/INFO]: \u001b[0;37;22m========================\u001b[39;0m\n> ";

    expect(splitControlOutputLog(rawOutput)).toEqual([
      "[15:58:30] [Server thread/INFO]: ========================"
    ]);
  });
});
