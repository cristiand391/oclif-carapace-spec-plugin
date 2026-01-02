import {homedir} from "node:os";
import {join} from "node:path";

/**
 * getUserConfigDir returns the default directory to use for user-specific
 * configuration data, following the same rules as Go's os.UserConfigDir.
 *
 * Throws an Error if the directory cannot be determined.
 */
export function getUserConfigDir(): string {
  const platform = process.platform;

  // Windows
  if (platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return appData;
    }
    throw new Error("APPDATA is not set");
  }

  const home = homedir();
  if (!home) {
    throw new Error("Home directory not found");
  }

  // macOS
  if (platform === "darwin") {
    return join(home, "Library", "Application Support");
  }

  // Unix/Linux
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return xdgConfigHome;
  }

  return join(home, ".config");
}
