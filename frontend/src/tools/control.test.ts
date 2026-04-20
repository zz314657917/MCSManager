import { describe, expect, it } from "vitest";

import {
  collectDaemonIdsToHydrate,
  executeControlRequestWithRetry,
  normalizeControlOutputLog,
  resolveControlRequestErrorText,
  splitControlOutputLog
} from "./control";

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

  it("collapses blank lines introduced by stripped prompts and private mode control sequences", () => {
    const rawOutput = [
      "",
      "> ",
      "\u001b[?1l\u001b>\u001b[?1000l\u001b[?2004l\u001b[?1h\u001b=\u001b[?2004h> ",
      "",
      "\u001b[K[16:09:21] [Server thread/INFO]: \u001b[0;37;22m玩家在线 0/50\u001b[39;0m",
      "",
      "> ",
      "",
      "\u001b[K[16:09:22] [Server thread/INFO]: \u001b[0;37;22m========================\u001b[39;0m",
      ""
    ].join("\n");

    expect(splitControlOutputLog(rawOutput)).toEqual([
      "[16:09:21] [Server thread/INFO]: 玩家在线 0/50",
      "[16:09:22] [Server thread/INFO]: ========================"
    ]);
  });

  it("removes osc title sequences without leaving empty transcript rows", () => {
    const rawOutput = [
      "\u001b]0;MCSManager Terminal\u0007",
      "\u001b[K[16:10:29] [Server thread/INFO]: \u001b[0;37;1mFor next page perform \u001b[0;35;22mcmi ? 2\u001b[39;0m",
      "\u001b]0;idle\u0007",
      "> "
    ].join("\n");

    expect(normalizeControlOutputLog(rawOutput)).toBe(
      "[16:10:29] [Server thread/INFO]: For next page perform cmi ? 2"
    );
  });
});

describe("control panel target hydration", () => {
  it("collects only online daemons that still need background target hydration", () => {
    expect(
      collectDaemonIdsToHydrate(
        [
          { daemonId: "daemon-a", daemonAvailable: true },
          { daemonId: "daemon-b", daemonAvailable: true },
          { daemonId: "daemon-c", daemonAvailable: false },
          { daemonId: "daemon-d", daemonAvailable: true }
        ],
        {
          "daemon-d": true
        },
        {
          excludeDaemonId: "daemon-a"
        }
      )
    ).toEqual(["daemon-b"]);
  });

  it("includes already loaded daemons when forceRequest is enabled", () => {
    expect(
      collectDaemonIdsToHydrate(
        [
          { daemonId: "daemon-a", daemonAvailable: true },
          { daemonId: "daemon-b", daemonAvailable: true },
          { daemonId: "daemon-c", daemonAvailable: false }
        ],
        {
          "daemon-a": true,
          "daemon-b": true
        },
        {
          forceRequest: true
        }
      )
    ).toEqual(["daemon-a", "daemon-b"]);
  });
});

describe("control request retry handling", () => {
  it("retries transient request failures once before succeeding", async () => {
    const forceRequests: boolean[] = [];

    const result = await executeControlRequestWithRetry(async (forceRequest) => {
      forceRequests.push(forceRequest);
      if (forceRequests.length === 1) {
        throw new Error("Network Error");
      }
      return "ok";
    });

    expect(result).toBe("ok");
    expect(forceRequests).toEqual([false, true]);
  });

  it("does not retry non-transient request failures", async () => {
    let attempts = 0;

    await expect(
      executeControlRequestWithRetry(async () => {
        attempts += 1;
        throw new Error("403 forbidden");
      })
    ).rejects.toThrow("403 forbidden");

    expect(attempts).toBe(1);
  });

  it("preserves the original backend message when it is already specific", () => {
    expect(
      resolveControlRequestErrorText(new Error("令牌(Token)验证失败，拒绝访问"), "加载节点列表失败", {
        forbiddenText: "权限不足，无法执行当前控制操作",
        serverErrorText: "Panel 服务异常，请稍后重试",
        networkErrorText: "网络异常，无法连接 Panel"
      })
    ).toBe("令牌(Token)验证失败，拒绝访问");
  });
});
