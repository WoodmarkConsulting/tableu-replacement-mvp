import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(currentDirectory, "../..");

const DATABRICKS_CLI_VERSION = "1.12.1";

const DATABRICKS_CLI_DIRECTORY = path.join(
  PROJECT_ROOT,
  ".tools",
  "databricks",
);

const DATABRICKS_CLI_PATH = path.join(
  DATABRICKS_CLI_DIRECTORY,
  process.platform === "win32" ? "databricks.exe" : "databricks",
);

const config = {
  CLI_PROFILE: "dashboard-generator",
  DATABRICKS_APP_NAME: "Analytics-Dashboard",
  PROJECT_ROOT,
  DATABRICKS_CLI_VERSION,
  DATABRICKS_CLI_DIRECTORY,
  DATABRICKS_CLI_PATH,
} as const;

export default config;
