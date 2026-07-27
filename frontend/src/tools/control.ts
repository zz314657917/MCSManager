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

const CONTROL_TERMINAL_MAX_ROWS = 1000;
const CONTROL_TERMINAL_MAX_COLUMNS = 2000;

const clampTerminalRow = (row: number) => Math.min(CONTROL_TERMINAL_MAX_ROWS - 1, Math.max(0, row));

const clampTerminalColumn = (column: number) =>
  Math.min(CONTROL_TERMINAL_MAX_COLUMNS - 1, Math.max(0, column));

const clampTerminalCount = (count: number, max = CONTROL_TERMINAL_MAX_ROWS) =>
  Math.min(max, Math.max(1, count));

const padTerminalLineToCursor = (line: string[], cursorColumn: number) => {
  while (line.length < cursorColumn) {
    line.push(" ");
  }
};

const parseTerminalControlParameter = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value.replace(/^[?>]/, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const eraseTerminalLine = (line: string[], cursorColumn: number, parameter: string) => {
  const mode = parseTerminalControlParameter(parameter, 0);

  if (mode === 1) {
    const eraseEnd = Math.min(cursorColumn + 1, line.length);
    for (let index = 0; index < eraseEnd; index += 1) {
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

interface TerminalScreenState {
  lines: string[][];
  row: number;
  column: number;
  savedCursor: {
    row: number;
    column: number;
  };
}

const createTerminalScreen = (): TerminalScreenState => ({
  lines: [[]],
  row: 0,
  column: 0,
  savedCursor: {
    row: 0,
    column: 0
  }
});

const eraseTerminalDisplay = (screen: TerminalScreenState, mode: number) => {
  if (mode === 2 || mode === 3) {
    const cursor = { row: screen.row, column: screen.column };
    screen.lines = [[]];
    screen.row = cursor.row;
    screen.column = cursor.column;
    ensureTerminalLine(screen.lines, screen.row);
    return;
  }

  if (mode === 1) {
    for (let row = 0; row <= screen.row; row += 1) {
      const line = ensureTerminalLine(screen.lines, row);
      const eraseEnd = row === screen.row ? Math.min(screen.column + 1, line.length) : line.length;
      for (let column = 0; column < eraseEnd; column += 1) {
        line[column] = " ";
      }
    }
    return;
  }

  const currentLine = ensureTerminalLine(screen.lines, screen.row);
  currentLine.length = Math.min(screen.column, currentLine.length);
  screen.lines.length = screen.row + 1;
};

const insertTerminalLines = (screen: TerminalScreenState, count: number) => {
  const safeCount = clampTerminalCount(count);
  screen.lines.splice(screen.row, 0, ...Array.from({ length: safeCount }, () => []));
  screen.lines.length = Math.min(screen.lines.length, CONTROL_TERMINAL_MAX_ROWS);
};

const deleteTerminalLines = (screen: TerminalScreenState, count: number) => {
  const safeCount = clampTerminalCount(count);
  screen.lines.splice(screen.row, safeCount);
  ensureTerminalLine(screen.lines, screen.row);
};

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
  let mainScreen = createTerminalScreen();
  let activeScreen = mainScreen;
  let alternateScreenActive = false;

  const setCursor = (row: number, column: number) => {
    activeScreen.row = clampTerminalRow(row);
    activeScreen.column = clampTerminalColumn(column);
    ensureTerminalLine(activeScreen.lines, activeScreen.row);
  };

  const switchAlternateScreen = (enabled: boolean) => {
    if (enabled === alternateScreenActive) return;

    if (enabled) {
      mainScreen = activeScreen;
      activeScreen = createTerminalScreen();
      alternateScreenActive = true;
      return;
    }

    activeScreen = mainScreen;
    alternateScreenActive = false;
  };

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
        const privateMode = /^[?>]/.test(parameterText);
        const parameters = parameterText.replace(/^[?>]/, "").split(";");
        const firstParameter = parseTerminalControlParameter(parameters[0] || "1", 1);
        const secondParameter = parseTerminalControlParameter(parameters[1] || "1", 1);
        const currentLine = ensureTerminalLine(activeScreen.lines, activeScreen.row);

        switch (command) {
          case "A":
            activeScreen.row = clampTerminalRow(
              activeScreen.row - clampTerminalCount(firstParameter)
            );
            ensureTerminalLine(activeScreen.lines, activeScreen.row);
            break;
          case "B":
            activeScreen.row = clampTerminalRow(
              activeScreen.row + clampTerminalCount(firstParameter)
            );
            ensureTerminalLine(activeScreen.lines, activeScreen.row);
            break;
          case "E":
            activeScreen.row = clampTerminalRow(
              activeScreen.row + clampTerminalCount(firstParameter)
            );
            activeScreen.column = 0;
            ensureTerminalLine(activeScreen.lines, activeScreen.row);
            break;
          case "F":
            activeScreen.row = clampTerminalRow(
              activeScreen.row - clampTerminalCount(firstParameter)
            );
            activeScreen.column = 0;
            ensureTerminalLine(activeScreen.lines, activeScreen.row);
            break;
          case "H":
          case "f":
            setCursor(firstParameter - 1, secondParameter - 1);
            break;
          case "K":
            eraseTerminalLine(currentLine, activeScreen.column, parameters[0] || "0");
            break;
          case "G":
            activeScreen.column = clampTerminalColumn(firstParameter - 1);
            break;
          case "C":
            activeScreen.column = clampTerminalColumn(
              activeScreen.column + clampTerminalCount(firstParameter, CONTROL_TERMINAL_MAX_COLUMNS)
            );
            break;
          case "D":
            activeScreen.column = clampTerminalColumn(
              activeScreen.column - clampTerminalCount(firstParameter, CONTROL_TERMINAL_MAX_COLUMNS)
            );
            break;
          case "d":
            activeScreen.row = clampTerminalRow(firstParameter - 1);
            ensureTerminalLine(activeScreen.lines, activeScreen.row);
            break;
          case "P": {
            const deleteCount = clampTerminalCount(firstParameter, CONTROL_TERMINAL_MAX_COLUMNS);
            currentLine.splice(activeScreen.column, deleteCount);
            break;
          }
          case "@": {
            const insertCount = clampTerminalCount(firstParameter, CONTROL_TERMINAL_MAX_COLUMNS);
            currentLine.splice(
              activeScreen.column,
              0,
              ...Array.from({ length: insertCount }, () => " ")
            );
            currentLine.length = Math.min(currentLine.length, CONTROL_TERMINAL_MAX_COLUMNS);
            break;
          }
          case "X": {
            const eraseCount = clampTerminalCount(firstParameter, CONTROL_TERMINAL_MAX_COLUMNS);
            for (
              let column = activeScreen.column;
              column < activeScreen.column + eraseCount;
              column += 1
            ) {
              if (column < currentLine.length) currentLine[column] = " ";
            }
            break;
          }
          case "L":
            insertTerminalLines(activeScreen, firstParameter);
            break;
          case "M":
            deleteTerminalLines(activeScreen, firstParameter);
            break;
          case "S":
            activeScreen.lines.splice(0, clampTerminalCount(firstParameter));
            ensureTerminalLine(activeScreen.lines, activeScreen.row);
            break;
          case "T":
            activeScreen.lines.unshift(
              ...Array.from({ length: clampTerminalCount(firstParameter) }, () => [])
            );
            activeScreen.lines.length = Math.min(
              activeScreen.lines.length,
              CONTROL_TERMINAL_MAX_ROWS
            );
            break;
          case "J": {
            eraseTerminalDisplay(
              activeScreen,
              parseTerminalControlParameter(parameters[0] || "0", 0)
            );
            break;
          }
          case "s":
            activeScreen.savedCursor = {
              row: activeScreen.row,
              column: activeScreen.column
            };
            break;
          case "u":
            setCursor(activeScreen.savedCursor.row, activeScreen.savedCursor.column);
            break;
          case "h":
          case "l":
            if (privateMode) {
              const modes = parameters.map((parameter) =>
                parseTerminalControlParameter(parameter, 0)
              );
              if (modes.some((mode) => mode === 47 || mode === 1047 || mode === 1049)) {
                switchAlternateScreen(command === "h");
              }
            }
            break;
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

    if (char === "\x07") {
      continue;
    }

    if (char === "\n") {
      activeScreen.row = clampTerminalRow(activeScreen.row + 1);
      activeScreen.column = 0;
      ensureTerminalLine(activeScreen.lines, activeScreen.row);
      continue;
    }

    if (char === "\r") {
      activeScreen.column = 0;
      continue;
    }

    if (char === "\b") {
      activeScreen.column = Math.max(0, activeScreen.column - 1);
      continue;
    }

    if (char === "\t") {
      const currentLine = ensureTerminalLine(activeScreen.lines, activeScreen.row);
      const remainder = activeScreen.column % 4;
      const spaces = remainder === 0 ? 4 : 4 - remainder;
      padTerminalLineToCursor(currentLine, activeScreen.column);
      for (let spaceIndex = 0; spaceIndex < spaces; spaceIndex += 1) {
        currentLine[activeScreen.column] = " ";
        activeScreen.column = clampTerminalColumn(activeScreen.column + 1);
      }
      continue;
    }

    if (char.charCodeAt(0) < 0x20) {
      continue;
    }

    const currentLine = ensureTerminalLine(activeScreen.lines, activeScreen.row);
    if (
      activeScreen.column === CONTROL_TERMINAL_MAX_COLUMNS - 1 &&
      currentLine.length >= CONTROL_TERMINAL_MAX_COLUMNS
    ) {
      currentLine.shift();
      currentLine.push(char);
      continue;
    }
    padTerminalLineToCursor(currentLine, activeScreen.column);
    currentLine[activeScreen.column] = char;
    activeScreen.column = clampTerminalColumn(activeScreen.column + 1);
  }

  return sanitizeRenderedTerminalLines(activeScreen.lines.map((line) => line.join(""))).join("\n");
};

export const normalizeControlOutputLog = (raw?: string | null) => renderTerminalSnapshot(raw);

export const splitControlOutputLog = (raw?: string | null) => {
  const lines = normalizeControlOutputLog(raw).split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};
