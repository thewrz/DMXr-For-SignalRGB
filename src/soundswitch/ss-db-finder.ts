import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

interface DbSearchResult {
  readonly path: string | null;
  readonly searchedPaths: readonly string[];
}

function getCandidatePaths(): readonly string[] {
  const os = platform();

  if (os === "win32") {
    const localAppData = process.env["LOCALAPPDATA"] ?? "";
    return [
      "C:\\Program Files\\SoundSwitch\\sscloud.db",
      "C:\\Program Files (x86)\\SoundSwitch\\sscloud.db",
      ...(localAppData
        ? [join(localAppData, "SoundSwitch", "sscloud.db")]
        : []),
    ];
  }

  if (os === "darwin") {
    return [
      join(homedir(), "Library", "Application Support", "SoundSwitch", "sscloud.db"),
    ];
  }

  // Linux — unlikely but check common locations
  return [
    join(homedir(), ".soundswitch", "sscloud.db"),
  ];
}

export function findSoundswitchDb(): DbSearchResult {
  const candidates = getCandidatePaths();
  const searchedPaths: string[] = [];

  for (const candidate of candidates) {
    searchedPaths.push(candidate);
    try {
      accessSync(candidate, constants.R_OK);
      return { path: candidate, searchedPaths };
    } catch {
      // not found or not readable, continue
    }
  }

  return { path: null, searchedPaths };
}
