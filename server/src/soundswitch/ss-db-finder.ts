import { accessSync, readdirSync, constants } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

interface DbSearchResult {
  readonly path: string | null;
  readonly searchedPaths: readonly string[];
}

/** Known SoundSwitch database filenames to try first */
const DB_FILENAMES = ["SoundSwitch.db", "Fixtures.db", "FixtureLibrary.db"];

function getCandidateDirectories(): readonly string[] {
  const os = platform();

  if (os === "win32") {
    const localAppData = process.env["LOCALAPPDATA"] ?? "";
    return [
      "C:\\Program Files\\SoundSwitch",
      "C:\\Program Files (x86)\\SoundSwitch",
      ...(localAppData
        ? [join(localAppData, "SoundSwitch")]
        : []),
    ];
  }

  if (os === "darwin") {
    return [
      join(homedir(), "Library", "Application Support", "SoundSwitch"),
    ];
  }

  // Linux — unlikely but check common locations
  return [
    join(homedir(), ".soundswitch"),
  ];
}

function isReadable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function findSoundswitchDb(): DbSearchResult {
  const dirs = getCandidateDirectories();
  const searchedPaths: string[] = [];

  for (const dir of dirs) {
    // Try known filenames first
    for (const filename of DB_FILENAMES) {
      const filePath = join(dir, filename);
      searchedPaths.push(filePath);
      if (isReadable(filePath)) {
        return { path: filePath, searchedPaths };
      }
    }

    // Fallback: scan directory for any .db file
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.endsWith(".db")) {
          const filePath = join(dir, entry);
          searchedPaths.push(filePath);
          if (isReadable(filePath)) {
            return { path: filePath, searchedPaths };
          }
        }
      }
    } catch {
      // directory doesn't exist or not readable
    }
  }

  return { path: null, searchedPaths };
}
