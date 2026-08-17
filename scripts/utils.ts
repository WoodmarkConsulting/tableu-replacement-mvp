import fs from "fs";
import type { PagesConfig } from "@/pagesConfig";

export function validateRootDirectoryAndPagesConfig(
  dashboard: PagesConfig,
  dashboardConfigPath: string,
) {
  const { dashboardName, dashboardConfigName } = dashboard;

  // Check if the "app" folder exists in the current working directory
  if (!fs.existsSync("app")) {
    console.error(
      'Error: "app" folder not found in the current working directory. Please run this script from the root directory of the project.',
    );
    process.exit(1);
  }

  // Check if the dashboardName is a non-empty string
  if (typeof dashboardName !== "string" || dashboardName.trim() === "") {
    console.error(
      `Error: Invalid dashboardName "${dashboardName}". It must be a non-empty string.`,
    );
    process.exit(1);
  }

  // Check if the dashboardConfig is a readable json file
  if (
    typeof dashboardConfigName !== "string" ||
    dashboardConfigName.trim() === "" ||
    !fs.existsSync(dashboardConfigPath) ||
    !dashboardConfigPath.endsWith(".json")
  ) {
    console.error(
      `Error: Invalid dashboardConfig "${dashboardConfigName}". It must be a readable JSON file.`,
    );
    process.exit(1);
  }
}

export const ANSI_COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  RESET: "\x1b[0m",
};
