import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import config from "./config";
import { ANSI_COLORS } from "../utils";

type DatabricksColumn = {
  name: string;
  type_text?: string;
  type_name?: string;
  nullable?: boolean;
  position?: number;
};

type DatabricksTable = {
  name: string;
  full_name?: string;
  data_source_format?: string;
  columns?: DatabricksColumn[];
};

type TableSchemaColumn = {
  name: string;
  type: string;
};

type TableSchema = {
  tablePath: string;
  columns: TableSchemaColumn[];
};

type TableSchemaFile = {
  id: string;
  tables: TableSchema[];
};

const execFileAsync = promisify(execFile);

const { CLI_PROFILE, DATABRICKS_CLI_PATH } = config;

const SCHEMA_DIRECTORY = path.resolve(process.cwd(), "pagesConfig", "schemas");

const id = process.argv[2];
const tablePaths = process.argv.slice(3);

if (!id || !tablePaths.length) {
  console.error(
    `${ANSI_COLORS.RED}Error: Missing required arguments.${ANSI_COLORS.RESET}`,
  );

  console.error(
    "Usage: npm run databricks:tableSchemas -- <chartid> <table-path> [table-path...]",
  );

  process.exit(1);
}

writeTableSchemas(id, tablePaths).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`${ANSI_COLORS.RED}Error: ${message}${ANSI_COLORS.RESET}`);

  process.exit(1);
});

function normalizeTablePath(tablePath: string): string {
  const trimmedPath = tablePath.trim();

  // Bash interprets backticks as command substitution when the table path
  // is not wrapped in single quotes. This usually results in an empty
  // catalog/schema/table segment such as "catalog..table".
  if (trimmedPath.includes("..")) {
    throw new Error(
      `${ANSI_COLORS.YELLOW}Invalid table path "${tablePath}".\n\n` +
        "The table path contains an empty segment. This can happen when a Databricks table path containing backticks was copied into Bash without quoting it.\n\n" +
        "Wrap the complete Databricks table path in single quotes.\n\n" +
        "Wrong Example:\n" +
        "npm run databricks:tableSchemas -- <id> 'catalog.`schema`.table'" +
        "\n\nCorrect Example:\n" +
        "npm run databricks:tableSchemas -- <id> 'catalog.schema.table'" +
        `\n\n${ANSI_COLORS.RESET}`,
    );
  }

  const normalizedPath = tablePath.trim().replace(/`/g, "");

  const parts = normalizedPath.split(".");

  if (parts.length !== 3) {
    throw new Error(
      `Invalid table path "${tablePath}". ` +
        "Expected a fully qualified Databricks table path in the format catalog.schema.table.",
    );
  }

  if (parts.some((part) => !part.trim())) {
    throw new Error(
      `Invalid table path "${tablePath}". ` +
        "Catalog, schema, and table name must not be empty.",
    );
  }

  return parts.join(".");
}

async function getTableSchema(tablePath: string): Promise<TableSchema> {
  const normalizedTablePath = normalizeTablePath(tablePath);

  let stdout: string;

  try {
    const result = await execFileAsync(
      DATABRICKS_CLI_PATH,
      [
        "tables",
        "get",
        normalizedTablePath,
        "--profile",
        CLI_PROFILE,
        "--output",
        "json",
      ],
      {
        encoding: "utf8",
      },
    );

    stdout = result.stdout;
  } catch (error) {
    const cliError = error as Error & {
      stderr?: string;
    };

    const details = cliError.stderr?.trim() || cliError.message;

    throw new Error(
      `Failed to read Databricks table "${tablePath}".\n${details}`,
    );
  }

  let table: DatabricksTable;

  try {
    table = JSON.parse(stdout) as DatabricksTable;
  } catch {
    throw new Error(
      `Databricks returned invalid JSON for table "${tablePath}".`,
    );
  }

  if (table.data_source_format && table.data_source_format !== "DELTA") {
    throw new Error(
      `Table "${tablePath}" is not a Delta table. ` +
        `Detected format: ${table.data_source_format}`,
    );
  }

  if (!table.columns) {
    throw new Error(`No column schema was returned for table "${tablePath}".`);
  }

  const columns = [...table.columns]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((column) => {
      const columnType = column.type_text ?? column.type_name;

      if (!columnType) {
        throw new Error(
          `No datatype was returned for column "${column.name}" in table "${tablePath}".`,
        );
      }

      return {
        name: column.name,
        type: columnType,
      };
    });

  return {
    tablePath: normalizedTablePath,
    columns,
  };
}

async function writeTableSchemas(
  id: string,
  tablePaths: string[],
): Promise<void> {
  if (!id.trim()) {
    throw new Error("A schema ID is required.");
  }

  if (tablePaths.length === 0) {
    throw new Error("At least one Databricks table path is required.");
  }

  console.log(
    `Reading schemas for ${tablePaths.length} Databricks table(s)...`,
  );

  const tables: TableSchema[] = [];

  for (const tablePath of tablePaths) {
    console.log(`Reading table: ${tablePath}`);

    const tableSchema = await getTableSchema(tablePath);

    tables.push(tableSchema);

    console.log(
      `${ANSI_COLORS.GREEN}Schema loaded: ${tableSchema.tablePath}${ANSI_COLORS.RESET}`,
    );
  }

  const schemaFile: TableSchemaFile = {
    id,
    tables,
  };

  await mkdir(SCHEMA_DIRECTORY, {
    recursive: true,
  });

  const outputPath = path.join(SCHEMA_DIRECTORY, `${id}.json`);

  await writeFile(outputPath, JSON.stringify(schemaFile, null, 2), "utf8");

  console.log(
    `${ANSI_COLORS.GREEN}Table schemas written successfully.${ANSI_COLORS.RESET}`,
  );

  console.log(`Output: ${outputPath}`);
}
