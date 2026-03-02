export interface TranslatedError {
  readonly title: string;
  readonly suggestion: string;
}

const ERROR_MAP: ReadonlyMap<string, TranslatedError> = new Map([
  [
    "ENOENT",
    {
      title: "DMX adapter not found",
      suggestion:
        'Check that your USB adapter is plugged in. Try the "Scan Ports" button in Web Manager.',
    },
  ],
  [
    "EACCES",
    {
      title: "Permission denied",
      suggestion:
        "Another app may be using this port. Close other DMX software and restart.",
    },
  ],
  [
    "EPERM",
    {
      title: "Permission denied",
      suggestion:
        "Another app may be using this port. Close other DMX software and restart.",
    },
  ],
  [
    "EBUSY",
    {
      title: "Port busy",
      suggestion:
        "Close QLC+, SoundSwitch, or other DMX software and restart DMXr.",
    },
  ],
]);

const DEFAULT_ERROR: TranslatedError = {
  title: "DMX connection error",
  suggestion:
    "Check adapter is connected and try restarting the server.",
};

function extractErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as Record<string, unknown>)["code"];
    if (typeof code === "string") return code;
  }
  return null;
}

export function translateDmxError(error: unknown): TranslatedError {
  const code = extractErrorCode(error);
  if (code !== null) {
    const mapped = ERROR_MAP.get(code);
    if (mapped) return mapped;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("No such file") || message.includes("cannot find")) {
    return ERROR_MAP.get("ENOENT")!;
  }
  if (message.includes("Access denied") || message.includes("permission")) {
    return ERROR_MAP.get("EACCES")!;
  }

  return { ...DEFAULT_ERROR };
}
