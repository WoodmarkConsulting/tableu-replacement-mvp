import AdmZip from "adm-zip";
import { execFileSync } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import config from "./config";

type SupportedOperatingSystem = "linux" | "darwin" | "windows";
type SupportedArchitecture = "amd64" | "arm64" | "386" | "arm";

const {
  DATABRICKS_CLI_DIRECTORY,
  DATABRICKS_CLI_PATH,
  DATABRICKS_CLI_VERSION,
} = config;

function getOperatingSystem(): SupportedOperatingSystem {
  switch (process.platform) {
    case "linux":
      return "linux";

    case "darwin":
      return "darwin";

    case "win32":
      return "windows";

    default:
      throw new Error(`Unsupported operating system: ${process.platform}`);
  }
}

function getArchitecture(): SupportedArchitecture {
  switch (process.arch) {
    case "x64":
      return "amd64";

    case "arm64":
      return "arm64";

    case "ia32":
      return "386";

    case "arm":
      return "arm";

    default:
      throw new Error(`Unsupported CPU architecture: ${process.arch}`);
  }
}

function getInstalledVersion(): string | null {
  try {
    const output = execFileSync(DATABRICKS_CLI_PATH, ["-v"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const versionMatch = output.match(/\d+\.\d+\.\d+/);

    return versionMatch?.[0] ?? null;
  } catch {
    return null;
  }
}

async function installDatabricksCli(): Promise<void> {
  const installedVersion = getInstalledVersion();

  if (installedVersion === DATABRICKS_CLI_VERSION) {
    console.log(
      `Databricks CLI ${DATABRICKS_CLI_VERSION} is already installed locally.`,
    );
    return;
  }

  if (installedVersion) {
    console.log(
      `Found local Databricks CLI ${installedVersion}. ` +
        `Replacing it with ${DATABRICKS_CLI_VERSION}.`,
    );
  } else {
    console.log(
      `Installing Databricks CLI ${DATABRICKS_CLI_VERSION} locally...`,
    );
  }

  const operatingSystem = getOperatingSystem();
  const architecture = getArchitecture();

  const archiveName =
    `databricks_cli_${DATABRICKS_CLI_VERSION}` +
    `_${operatingSystem}_${architecture}.zip`;

  const downloadUrl =
    `https://github.com/databricks/cli/releases/download/` +
    `v${DATABRICKS_CLI_VERSION}/${archiveName}`;

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "databricks-cli-"),
  );

  try {
    const archivePath = path.join(temporaryDirectory, archiveName);

    console.log(
      `Downloading Databricks CLI for ${operatingSystem}/${architecture}...`,
    );

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download Databricks CLI. ` +
          `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const archiveBuffer = Buffer.from(await response.arrayBuffer());

    await writeFile(archivePath, archiveBuffer);

    const extractionDirectory = path.join(temporaryDirectory, "extracted");

    const zip = new AdmZip(archivePath);

    zip.extractAllTo(extractionDirectory, true);

    const executableEntry = zip.getEntries().find((entry) => {
      const fileName = path.basename(entry.entryName);

      return fileName === "databricks" || fileName === "databricks.exe";
    });

    if (!executableEntry) {
      throw new Error(
        "The downloaded archive does not contain a Databricks CLI executable.",
      );
    }

    const extractedExecutablePath = path.join(
      extractionDirectory,
      executableEntry.entryName,
    );

    await mkdir(DATABRICKS_CLI_DIRECTORY, {
      recursive: true,
    });

    await rm(DATABRICKS_CLI_PATH, {
      force: true,
    });

    await copyFile(extractedExecutablePath, DATABRICKS_CLI_PATH);

    if (process.platform !== "win32") {
      await chmod(DATABRICKS_CLI_PATH, 0o755);
    }

    const verifiedVersion = getInstalledVersion();

    if (verifiedVersion !== DATABRICKS_CLI_VERSION) {
      throw new Error(
        `Databricks CLI installation verification failed. ` +
          `Expected ${DATABRICKS_CLI_VERSION}, but found ${
            verifiedVersion ?? "no valid version"
          }.`,
      );
    }

    console.log(`Databricks CLI ${verifiedVersion} installed successfully.`);

    console.log(`CLI path: ${DATABRICKS_CLI_PATH}`);
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}

installDatabricksCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Failed to install Databricks CLI: ${message}`);

  process.exit(1);
});
