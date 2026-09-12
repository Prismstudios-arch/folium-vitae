/**
 * Simple logger for backend
 */

const levels = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
};

type LogLevel = keyof typeof levels;

function formatLog(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${levels[level]}]`;

  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }

  return `${prefix} ${message}`;
}

export default {
  error: (message: string, data?: any) => {
    console.error(formatLog("error", message, data));
  },

  warn: (message: string, data?: any) => {
    console.warn(formatLog("warn", message, data));
  },

  info: (message: string, data?: any) => {
    console.log(formatLog("info", message, data));
  },

  debug: (message: string, data?: any) => {
    if (process.env.DEBUG) {
      console.log(formatLog("debug", message, data));
    }
  },
};
