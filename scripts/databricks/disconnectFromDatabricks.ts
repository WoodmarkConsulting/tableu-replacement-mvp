import { spawn } from "node:child_process";
import config from "./config";

const { CLI_PROFILE, DATABRICKS_CLI_PATH } = config;

const logoutProcess = spawn(
  DATABRICKS_CLI_PATH,
  ["auth", "logout", "--profile", CLI_PROFILE, "--delete", "--auto-approve"],
  {
    stdio: "inherit",
  },
);

logoutProcess.on("error", (error) => {
  console.error("Failed to start the Databricks CLI:", error);
  process.exit(1);
});

logoutProcess.on("exit", (code) => {
  if (code === 0) {
    console.log("Databricks logout completed successfully.");
  } else {
    console.error("Databricks logout failed.");
  }

  process.exit(code ?? 1);
});
