type LogLevel = "info" | "warn" | "error";

const writeLog = (input: {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}): void => {
  const entry = {
    level: input.level,
    message: input.message,
    context: input.context ?? {},
    timestamp: new Date().toISOString(),
  };

  process.stdout.write(`${JSON.stringify(entry)}\n`);
};

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void => {
    writeLog(
      context === undefined ? { level: "info", message } : { level: "info", message, context },
    );
  },
  warn: (message: string, context?: Record<string, unknown>): void => {
    writeLog(
      context === undefined ? { level: "warn", message } : { level: "warn", message, context },
    );
  },
  error: (message: string, context?: Record<string, unknown>): void => {
    writeLog(
      context === undefined ? { level: "error", message } : { level: "error", message, context },
    );
  },
} as const;
