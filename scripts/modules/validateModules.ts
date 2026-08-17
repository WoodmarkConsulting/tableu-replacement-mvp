import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ANSI_COLORS } from "../utils";

const modulesDirectory = path.resolve("modules");

const requiredFiles = [
  "index.tsx",
  "chartDataSchema.ts",
  "chartType.d.ts",
  "instructions.md",
] as const;

let hasErrors = false;

function reportError(moduleName: string, message: string) {
  hasErrors = true;
  console.error(
    `${ANSI_COLORS.RED}[${moduleName}] ${message}${ANSI_COLORS.RESET}`,
  );
}

function parseFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");

  const scriptKind = filePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;

  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
}

function hasDefaultExport(filePath: string) {
  const sourceFile = parseFile(filePath);

  return sourceFile.statements.some((statement) => {
    // Example: export default MyComponent;
    if (ts.isExportAssignment(statement)) {
      return !statement.isExportEquals;
    }

    // Example: export default function MyComponent() {}
    // Example: export default class MyComponent {}
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;

    return (
      modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) === true &&
      modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      )
    );
  });
}

function validateChartType(filePath: string, moduleName: string) {
  const sourceFile = parseFile(filePath);

  const typeDeclarations = sourceFile.statements.filter((statement) =>
    ts.isTypeAliasDeclaration(statement),
  );

  if (typeDeclarations.length !== 1) {
    reportError(
      moduleName,
      `chartType.d.ts must contain exactly one type declaration. Found ${typeDeclarations.length}.`,
    );
  }

  if (sourceFile.statements.length !== 1) {
    reportError(
      moduleName,
      "chartType.d.ts must contain only one type declaration.",
    );
  }
}

function validateModule(modulePath: string) {
  const moduleName = path.basename(modulePath);

  for (const fileName of requiredFiles) {
    const filePath = path.join(modulePath, fileName);

    if (!fs.existsSync(filePath)) {
      reportError(moduleName, `Missing required file: ${fileName}`);
    }
  }

  const indexPath = path.join(modulePath, "index.tsx");

  if (fs.existsSync(indexPath) && !hasDefaultExport(indexPath)) {
    reportError(moduleName, "index.tsx must have a default export.");
  }

  const schemaPath = path.join(modulePath, "chartDataSchema.ts");

  if (fs.existsSync(schemaPath) && !hasDefaultExport(schemaPath)) {
    reportError(moduleName, "chartDataSchema.ts must have a default export.");
  }

  const typePath = path.join(modulePath, "chartType.d.ts");

  if (fs.existsSync(typePath)) {
    validateChartType(typePath, moduleName);
  }
}

const moduleDirectories = fs
  .readdirSync(modulesDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(modulesDirectory, entry.name));

for (const moduleDirectory of moduleDirectories) {
  validateModule(moduleDirectory);
}

if (hasErrors) {
  console.error("\nModule validation failed.");
  process.exit(1);
}

console.log(`${ANSI_COLORS.GREEN}All modules are valid.${ANSI_COLORS.RESET}`);
