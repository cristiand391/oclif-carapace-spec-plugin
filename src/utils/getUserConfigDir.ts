import {homedir} from "node:os";
import {join} from "node:path";

/**
 * getUserConfigDir returns the default directory to use for user-specific
 * configuration data.
 */
export function getUserConfigDir(): string {
  // carapace respects `XDG_CONFIG_HOME` on all OSes:
  // https://carapace-sh.github.io/carapace-bin/setup/userConfigDir.html
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return xdgConfigHome;
  }

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

  return join(home, ".config");
}
