import { watch } from "node:fs";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const PROJECT_ROOT = process.cwd();

const MODULES_DIRECTORY = path.join(PROJECT_ROOT, "modules");

const OUTPUT_FILE = path.join(MODULES_DIRECTORY, "modulRegistry.ts");

const WATCH_DEBOUNCE_MS = 150;

type ModuleInfo = {
  moduleName: string;
  moduleImportPath: string;
  componentExportName: string | "default";
  chartConfigType: string;
  dataSchemaImportPath: string;
  dataSchemaImportName: string;
};

function hasModifier(node: ts.Node, modifierKind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  return (
    ts.getModifiers(node)?.some((modifier) => modifier.kind === modifierKind) ??
    false
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getChartConfigType(sourceCode: string, filePath: string): string {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const typeDeclarations = sourceFile.statements.filter(
    ts.isTypeAliasDeclaration,
  );

  if (typeDeclarations.length === 0) {
    throw new Error(
      `No type declaration found in "${filePath}".\n` +
        "Each chartType.d.ts file must contain exactly one type declaration.",
    );
  }

  if (typeDeclarations.length > 1) {
    const typeNames = typeDeclarations
      .map((declaration) => declaration.name.text)
      .join(", ");

    throw new Error(
      `Multiple type declarations found in "${filePath}".\n` +
        `Found: ${typeNames}\n` +
        "Each chartType.d.ts file must contain exactly one type declaration.",
    );
  }

  return typeDeclarations[0].name.text;
}

function getComponentExports(
  sourceCode: string,
  filePath: string,
): {
  namedExports: string[];
  hasDefaultExport: boolean;
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const namedExports = new Set<string>();
  let hasDefaultExport = false;

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)
    ) {
      const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);

      if (!isExported) {
        continue;
      }

      const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

      if (isDefault) {
        hasDefaultExport = true;
        continue;
      }

      if (statement.name) {
        namedExports.add(statement.name.text);
      }

      continue;
    }

    if (ts.isVariableStatement(statement)) {
      const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);

      if (!isExported) {
        continue;
      }

      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          namedExports.add(declaration.name.text);
        }
      }

      continue;
    }

    if (ts.isExportAssignment(statement)) {
      if (!statement.isExportEquals) {
        hasDefaultExport = true;
      }

      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const exportElement of statement.exportClause.elements) {
        if (exportElement.name.text === "default") {
          hasDefaultExport = true;
          continue;
        }

        namedExports.add(exportElement.name.text);
      }
    }
  }

  return {
    namedExports: [...namedExports],
    hasDefaultExport,
  };
}

function resolveComponentExport(
  moduleName: string,
  namedExports: string[],
  hasDefaultExport: boolean,
): string | "default" {
  if (hasDefaultExport) {
    return "default";
  }

  if (namedExports.includes(moduleName)) {
    return moduleName;
  }

  if (namedExports.length === 1) {
    return namedExports[0];
  }

  throw new Error(
    `Could not determine the component export for module "${moduleName}".\n` +
      `Available named exports: ${namedExports.join(", ") || "none"}\n` +
      "Expected a default export, an export matching the module directory name, or exactly one named export.",
  );
}

function validateDataSchemaDefaultExport(
  sourceCode: string,
  filePath: string,
): void {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let defaultExportCount = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExportCount++;
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)
    ) {
      const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);

      const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

      if (isExported && isDefault) {
        defaultExportCount++;
      }

      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const exportElement of statement.exportClause.elements) {
        if (exportElement.name.text === "default") {
          defaultExportCount++;
        }
      }
    }
  }

  if (defaultExportCount === 0) {
    throw new Error(
      `No default export found in "${filePath}".\n` +
        "Each chartDataSchema.ts file must have exactly one default export.",
    );
  }

  if (defaultExportCount > 1) {
    throw new Error(
      `Multiple default exports found in "${filePath}".\n` +
        "Each chartDataSchema.ts file must have exactly one default export.",
    );
  }
}

function createDataSchemaImportName(moduleName: string): string {
  const sanitizedName = moduleName.replace(/[^a-zA-Z0-9_$]/g, "_");

  const safeName = /^[a-zA-Z_$]/.test(sanitizedName)
    ? sanitizedName
    : `_${sanitizedName}`;

  return `${safeName}DataSchema`;
}

async function readModules(): Promise<ModuleInfo[]> {
  const directoryEntries = await readdir(MODULES_DIRECTORY, {
    withFileTypes: true,
  });

  const foundModules: ModuleInfo[] = [];

  for (const directoryEntry of directoryEntries) {
    if (!directoryEntry.isDirectory()) {
      continue;
    }

    const moduleName = directoryEntry.name;

    const moduleDirectory = path.join(MODULES_DIRECTORY, moduleName);

    const indexFilePath = path.join(moduleDirectory, "index.tsx");

    const chartTypeFilePath = path.join(moduleDirectory, "chartType.d.ts");

    const chartDataSchemaFilePath = path.join(
      moduleDirectory,
      "chartDataSchema.ts",
    );

    const hasIndexFile = await fileExists(indexFilePath);

    if (!hasIndexFile) {
      continue;
    }

    const hasChartTypeFile = await fileExists(chartTypeFilePath);

    if (!hasChartTypeFile) {
      throw new Error(
        `Module "${moduleName}" contains index.tsx but is missing chartType.d.ts.`,
      );
    }

    const hasChartDataSchemaFile = await fileExists(chartDataSchemaFilePath);

    if (!hasChartDataSchemaFile) {
      throw new Error(
        `Module "${moduleName}" contains index.tsx but is missing chartDataSchema.ts.`,
      );
    }

    const [
      componentSourceCode,
      chartTypeSourceCode,
      chartDataSchemaSourceCode,
    ] = await Promise.all([
      readFile(indexFilePath, "utf8"),
      readFile(chartTypeFilePath, "utf8"),
      readFile(chartDataSchemaFilePath, "utf8"),
    ]);

    const { namedExports, hasDefaultExport } = getComponentExports(
      componentSourceCode,
      indexFilePath,
    );

    const componentExportName = resolveComponentExport(
      moduleName,
      namedExports,
      hasDefaultExport,
    );

    const chartConfigType = getChartConfigType(
      chartTypeSourceCode,
      chartTypeFilePath,
    );

    validateDataSchemaDefaultExport(
      chartDataSchemaSourceCode,
      chartDataSchemaFilePath,
    );

    foundModules.push({
      moduleName,

      moduleImportPath: `@/modules/${moduleName}`,

      componentExportName,

      chartConfigType,

      dataSchemaImportPath: `@/modules/${moduleName}/chartDataSchema`,

      dataSchemaImportName: createDataSchemaImportName(moduleName),
    });
  }

  return foundModules.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

function validateChartConfigTypes(moduleInfos: ModuleInfo[]): void {
  const typeOwners = new Map<string, string[]>();

  for (const moduleInfo of moduleInfos) {
    const owners = typeOwners.get(moduleInfo.chartConfigType) ?? [];

    owners.push(moduleInfo.moduleName);

    typeOwners.set(moduleInfo.chartConfigType, owners);
  }

  const duplicates = [...typeOwners.entries()].filter(
    ([, owners]) => owners.length > 1,
  );

  if (duplicates.length === 0) {
    return;
  }

  const description = duplicates
    .map(([typeName, owners]) => `${typeName}: ${owners.join(", ")}`)
    .join("\n");

  throw new Error(
    "Duplicate chart config type names detected:\n" + description,
  );
}

function generateDataSchemaImports(moduleInfos: ModuleInfo[]): string {
  return moduleInfos
    .map(
      (moduleInfo) =>
        `import ${moduleInfo.dataSchemaImportName} from ${JSON.stringify(
          moduleInfo.dataSchemaImportPath,
        )};`,
    )
    .join("\n");
}

function generateChartConfigsType(moduleInfos: ModuleInfo[]): string {
  return moduleInfos
    .map((moduleInfo) => moduleInfo.chartConfigType)
    .join(" | ");
}

function generateRegistryEntries(moduleInfos: ModuleInfo[]): string {
  return moduleInfos
    .map((moduleInfo) => {
      const componentExport =
        moduleInfo.componentExportName === "default"
          ? "loadedModule.default"
          : `loadedModule.${moduleInfo.componentExportName}`;

      return `  ${JSON.stringify(moduleInfo.moduleName)}: {
    component: dynamic(() =>
      import(${JSON.stringify(moduleInfo.moduleImportPath)}).then(
        (loadedModule) => ${componentExport},
      ),
    ),
    dataSchema: ${moduleInfo.dataSchemaImportName},
  },`;
    })
    .join("\n");
}

function generateRegistrySource(moduleInfos: ModuleInfo[]): string {
  const dataSchemaImports = generateDataSchemaImports(moduleInfos);

  const chartConfigsType = generateChartConfigsType(moduleInfos);

  const registryEntries = generateRegistryEntries(moduleInfos);

  return `// AUTO-GENERATED FILE.
// DO NOT EDIT MANUALLY.
// Run the module registry generator to update this file.

import dynamic from "next/dynamic";

${dataSchemaImports}

export type ModuleRegistryKeys = keyof typeof moduleRegistry;

export type ChartConfigs = ${chartConfigsType};

export const moduleRegistry = {
${registryEntries}
} as const;

export type ModuleRegistryKey = keyof typeof moduleRegistry;
`;
}

async function generateModuleRegistry(): Promise<void> {
  const moduleInfos = await readModules();

  if (moduleInfos.length === 0) {
    throw new Error("No valid chart modules were found.");
  }

  validateChartConfigTypes(moduleInfos);

  const registrySource = generateRegistrySource(moduleInfos);

  let currentRegistrySource: string | null = null;

  try {
    currentRegistrySource = await readFile(OUTPUT_FILE, "utf8");
  } catch {
    // Registry does not exist yet.
  }

  if (currentRegistrySource === registrySource) {
    return;
  }

  await writeFile(OUTPUT_FILE, registrySource, "utf8");

  console.log(`Module registry updated: ${OUTPUT_FILE}`);

  for (const moduleInfo of moduleInfos) {
    console.log(
      `- ${moduleInfo.moduleName} -> config: ${moduleInfo.chartConfigType}, schema: ${moduleInfo.dataSchemaImportName}`,
    );
  }
}

let debounceTimer: NodeJS.Timeout | undefined;

let generationIsRunning = false;
let generationRequested = false;

async function runGenerator(): Promise<void> {
  if (generationIsRunning) {
    generationRequested = true;
    return;
  }

  generationIsRunning = true;

  try {
    await generateModuleRegistry();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`Failed to generate module registry:\n${message}`);
  } finally {
    generationIsRunning = false;

    if (generationRequested) {
      generationRequested = false;
      await runGenerator();
    }
  }
}

function scheduleGeneration(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    void runGenerator();
  }, WATCH_DEBOUNCE_MS);
}

async function start(): Promise<void> {
  await runGenerator();

  console.log(`Watching for module changes: ${MODULES_DIRECTORY}`);

  const watcher = watch(
    MODULES_DIRECTORY,
    {
      recursive: true,
      persistent: true,
    },
    (_eventType, filename) => {
      if (!filename) {
        scheduleGeneration();
        return;
      }

      const changedFilePath = path.resolve(
        MODULES_DIRECTORY,
        filename.toString(),
      );

      if (changedFilePath === path.resolve(OUTPUT_FILE)) {
        return;
      }

      scheduleGeneration();
    },
  );

  watcher.on("error", (error) => {
    console.error(`Module watcher failed: ${error.message}`);

    process.exit(1);
  });

  const shutdown = () => {
    console.log("\nStopping module registry watcher...");

    watcher.close();

    process.exit(0);
  };

  process.on("SIGINT", shutdown);

  process.on("SIGTERM", shutdown);
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Failed to start module registry generator:\n${message}`);

  process.exit(1);
});
