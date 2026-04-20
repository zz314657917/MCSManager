import type { ControlLogLine, ControlPreviewNode, ControlTarget } from "@/types/control";

export const CONTROL_POLL_INTERVAL_MS = 1000;
export const CONTROL_OUTPUT_LOG_SIZE = 64 * 1024;
export const CONTROL_MAX_LOG_LINES = 200;

let controlLogSequence = 0;

export const createControlTargetKey = (
  target: Pick<ControlTarget, "daemonId" | "mode" | "instanceId">
) => `${target.daemonId}:${target.mode}:${target.instanceId}`;

export const collectDaemonIdsToHydrate = (
  nodes: Array<Pick<ControlPreviewNode, "daemonId" | "daemonAvailable">>,
  loadedDaemons: Record<string, boolean>,
  options: {
    excludeDaemonId?: string;
    forceRequest?: boolean;
  } = {}
) =>
  nodes
    .filter((node) => node.daemonAvailable)
    .map((node) => node.daemonId)
    .filter((daemonId) => daemonId !== options.excludeDaemonId)
    .filter((daemonId) => Boolean(options.forceRequest) || !loadedDaemons[daemonId]);

export const formatControlLogTime = (date = new Date()) =>
  date.toLocaleTimeString("zh-CN", {
    hour12: false
  });

export const createControlLogLine = (
  level: ControlLogLine["level"],
  text: string,
  date = new Date()
): ControlLogLine => ({
  id: `control-log-${date.getTime()}-${controlLogSequence++}`,
  time: formatControlLogTime(date),
  level,
  text
});

export const trimControlLogLines = (lines: ControlLogLine[], max = CONTROL_MAX_LOG_LINES) =>
  lines.length > max ? lines.slice(-max) : lines;

const getControlRequestErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
};

export const isRetriableControlRequestError = (error: unknown) => {
  const message = getControlRequestErrorMessage(error).trim().toLowerCase();
  if (!message) return false;

  return (
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("econnrefused") ||
    message.includes("timeout") ||
    message.includes("status code 500") ||
    message.includes("status code 502") ||
    message.includes("status code 503") ||
    message.includes("status code 504")
  );
};

export const resolveControlRequestErrorText = (
  error: unknown,
  fallbackText: string,
  options: {
    forbiddenText?: string;
    serverErrorText?: string;
    networkErrorText?: string;
  } = {}
) => {
  const message = getControlRequestErrorMessage(error).trim();
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("403")) return options.forbiddenText || fallbackText;
  if (lowerMessage.includes("500")) return options.serverErrorText || fallbackText;

  if (
    lowerMessage.includes("network error") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("timeout")
  ) {
    return options.networkErrorText || fallbackText;
  }

  return message || fallbackText;
};

export const executeControlRequestWithRetry = async <T>(
  execute: (forceRequest: boolean) => Promise<T>,
  options: {
    forceRequest?: boolean;
    retries?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
) => {
  const retries = Math.max(0, options.retries ?? 1);
  const shouldRetry = options.shouldRetry || isRetriableControlRequestError;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const forceRequest = Boolean(options.forceRequest) || attempt > 0;

    try {
      return await execute(forceRequest);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Control request failed");
};

const ensureTerminalLine = (lines: string[][], row: number) => {
  while (lines.length <= row) {
    lines.push([]);
  }
  return lines[row];
};

const padTerminalLineToCursor = (line: string[], cursorColumn: number) => {
  while (line.length < cursorColumn) {
    line.push(" ");
  }
};

const parseTerminalControlParameter = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const eraseTerminalLine = (line: string[], cursorColumn: number, parameter: string) => {
  const mode = parseTerminalControlParameter(parameter, 0);

  if (mode === 1) {
    for (let index = 0; index < Math.min(cursorColumn, line.length); index += 1) {
      line[index] = " ";
    }
    return;
  }

  if (mode === 2) {
    line.length = 0;
    return;
  }

  line.length = Math.min(cursorColumn, line.length);
};

const TRANSIENT_TERMINAL_PROMPT_LINE = /^\s*(?:>|\$|#)\s*$/;

const sanitizeRenderedTerminalLines = (lines: string[]) => {
  const sanitized: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");

    if (TRANSIENT_TERMINAL_PROMPT_LINE.test(line)) {
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    sanitized.push(line);
  }

  return sanitized;
};

// Convert raw outputlog snapshots into a readable terminal transcript.
const renderTerminalSnapshot = (raw?: string | null) => {
  const source = String(raw ?? "").replace(/\r\n/g, "\n");
  const lines: string[][] = [[]];
  let row = 0;
  let column = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\x1b") {
      const nextChar = source[index + 1];

      if (nextChar === "[") {
        let sequenceEnd = index + 2;
        while (sequenceEnd < source.length) {
          const code = source.charCodeAt(sequenceEnd);
          if (code >= 0x40 && code <= 0x7e) break;
          sequenceEnd += 1;
        }

        if (sequenceEnd >= source.length) break;

        const command = source[sequenceEnd];
        const parameterText = source.slice(index + 2, sequenceEnd);
        const parameters = parameterText.split(";");
        const currentLine = ensureTerminalLine(lines, row);

        switch (command) {
          case "K":
            eraseTerminalLine(currentLine, column, parameters[0] || "0");
            break;
          case "G":
            column = Math.max(0, parseTerminalControlParameter(parameters[0], 1) - 1);
            break;
          case "C":
            column += Math.max(0, parseTerminalControlParameter(parameters[0], 1));
            break;
          case "D":
            column = Math.max(0, column - Math.max(0, parseTerminalControlParameter(parameters[0], 1)));
            break;
          case "P": {
            const deleteCount = Math.max(0, parseTerminalControlParameter(parameters[0], 1));
            currentLine.splice(column, deleteCount);
            break;
          }
          case "J": {
            const mode = parseTerminalControlParameter(parameters[0], 0);
            if (mode === 2 || mode === 3) {
              lines.length = 1;
              lines[0] = [];
              row = 0;
              column = 0;
            }
            break;
          }
          default:
            break;
        }

        index = sequenceEnd;
        continue;
      }

      if (nextChar === "]") {
        let sequenceEnd = index + 2;
        while (sequenceEnd < source.length) {
          if (source[sequenceEnd] === "\u0007") break;
          if (source[sequenceEnd] === "\x1b" && source[sequenceEnd + 1] === "\\") {
            sequenceEnd += 1;
            break;
          }
          sequenceEnd += 1;
        }
        index = sequenceEnd;
        continue;
      }

      if (nextChar) {
        index += 1;
      }
      continue;
    }

    if (char === "\n") {
      row += 1;
      column = 0;
      ensureTerminalLine(lines, row);
      continue;
    }

    if (char === "\r") {
      column = 0;
      continue;
    }

    if (char === "\b") {
      column = Math.max(0, column - 1);
      continue;
    }

    if (char === "\t") {
      const currentLine = ensureTerminalLine(lines, row);
      const remainder = column % 4;
      const spaces = remainder === 0 ? 4 : 4 - remainder;
      padTerminalLineToCursor(currentLine, column);
      for (let spaceIndex = 0; spaceIndex < spaces; spaceIndex += 1) {
        currentLine[column] = " ";
        column += 1;
      }
      continue;
    }

    if (char.charCodeAt(0) < 0x20) {
      continue;
    }

    const currentLine = ensureTerminalLine(lines, row);
    padTerminalLineToCursor(currentLine, column);
    currentLine[column] = char;
    column += 1;
  }

  return sanitizeRenderedTerminalLines(lines.map((line) => line.join(""))).join("\n");
};

export const normalizeControlOutputLog = (raw?: string | null) => renderTerminalSnapshot(raw);

export const splitControlOutputLog = (raw?: string | null) => {
  const lines = normalizeControlOutputLog(raw).split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};
