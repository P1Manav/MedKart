// src/lib/logger.ts

type RedactReplacer = string | ((substring: string, ...args: string[]) => string);

const REDACT_PATTERNS: Array<[RegExp, RedactReplacer]> = [
  // Full 10-digit Indian phone numbers: mask middle digits
  [/\b(?:\+?91[\s-]?)?([6-9]\d{9})\b/g, (_match, phone) => `+91 ${phone.slice(0, 2)}****${phone.slice(-4)}`],
  // 6-digit OTP codes
  [/\b(otp|code)["':\s]+([0-9]{6})\b/gi, '$1: <otp-redacted>'],
  // Bearer tokens or JWTs (3 segments separated by dots)
  [/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '<jwt-redacted>'],
  // Postgres connection strings with credentials
  [/postgres(?:ql)?:\/\/[^:]+:([^@]+)@/gi, 'postgresql://<user>:<password-redacted>@'],
  // Hex keys (32+ chars, like encryption key or secrets)
  [/\b[0-9a-fA-F]{32,64}\b/g, '<secret-hex-redacted>'],
];

export function redactString(str: string): string {
  let redacted = str;
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    if (typeof replacement === 'string') {
      redacted = redacted.replace(pattern, replacement);
    } else {
      redacted = redacted.replace(pattern, (match, ...groups) =>
        replacement(match, ...groups.map((g) => (typeof g === 'string' ? g : String(g))))
      );
    }
  }
  return redacted;
}

function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return redactString(arg);
    }
    if (arg instanceof Error) {
      const cloned = new Error(redactString(arg.message));
      cloned.name = arg.name;
      if (arg.stack) cloned.stack = redactString(arg.stack);
      return cloned;
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.parse(redactString(JSON.stringify(arg)));
      } catch {
        return arg;
      }
    }
    return arg;
  });
}

export const logger = {
  info: (...args: unknown[]) => {
    console.info(...formatArgs(args));
  },
  warn: (...args: unknown[]) => {
    console.warn(...formatArgs(args));
  },
  error: (...args: unknown[]) => {
    console.error(...formatArgs(args));
  },
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(...formatArgs(args));
    }
  },
};
