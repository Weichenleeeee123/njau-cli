export const EXIT_CODES = {
  INVALID_ARGUMENT: 2,
  UNKNOWN_COMMAND: 2,
  HEADED_REQUIRED: 2,
  BACKEND_UNAVAILABLE: 10,
  LOGIN_REQUIRED: 11,
  NETWORK_REQUIRED: 12,
  PERMISSION_DENIED: 13,
  AUTH_LOGOUT_FAILED: 14,
  BROWSER_UNAVAILABLE: 15,
  BROWSER_INSTALL_CONFIRM_REQUIRED: 16,
  BROWSER_INSTALL_CANCELLED: 17,
  BROWSER_INSTALL_FAILED: 18,
  BROWSER_SELECTION_INVALID: 19,
  PAGE_CHANGED: 20,
  SKILL_NOT_FOUND: 21,
  NOT_FOUND: 22,
  CONFIRM_REQUIRED: 27,
  RATE_LIMITED: 30,
  DOWNLOAD_UNAVAILABLE: 31,
  AUTH_LOGIN_TIMEOUT: 39
};

export class CliError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.code = code;
    if (options.hint) {
      this.hint = options.hint;
    }
    if (options.details) {
      this.details = options.details;
    }
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export function fail(code, message, options) {
  throw new CliError(code, message, options);
}

export function exitCodeFor(code) {
  return EXIT_CODES[code] ?? 1;
}

export function toErrorPayload(error) {
  return {
    code: error.code ?? 'UNKNOWN_ERROR',
    message: error.message,
    ...(error.hint ? { hint: error.hint } : {}),
    ...(error.details ? { details: error.details } : {})
  };
}
