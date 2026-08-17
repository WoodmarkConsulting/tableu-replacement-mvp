import path from "node:path";

let input = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  const data = input ? JSON.parse(input) : {};

  checkPermission(data);
});

function checkPermission(data) {
  const toolName = data.tool_name?.split("/").at(-1);
  const toolInput = data.tool_input ?? {};
  const cwd = data.cwd ?? process.cwd();

  if (isFileWriteTool(toolName)) {
    validateFileWrite(toolName, toolInput, cwd);
    return;
  }

  if (isExecutionTool(toolName)) {
    validateExecution(toolName, toolInput);
  }
}

function isFileWriteTool(toolName) {
  return new Set([
    "apply_patch",
    "insert_edit_into_file",
    "create_file",
    "create_directory",
    "replace_string_in_file",
    "multi_replace_string_in_file",

    "copilot_applyPatch",
    "copilot_insertEdit",
    "copilot_createFile",
    "copilot_createDirectory",
    "copilot_replaceString",
    "copilot_multiReplaceString",
  ]).has(toolName);
}

function isExecutionTool(toolName) {
  return new Set([
    "run_in_terminal",
    "runInTerminal",
    "create_and_run_task",
    "createAndRunTask",
    "run_task",
    "execution_subagent",
  ]).has(toolName);
}

function validateFileWrite(toolName, toolInput, cwd) {
  const paths = extractWritePaths(toolName, toolInput);

  if (paths.length === 0) {
    deny(
      `Dashboard agent cannot verify the target path for tool "${toolName}".`,
    );
  }

  for (const filePath of paths) {
    if (!isInsidePagesConfig(filePath, cwd)) {
      deny(
        `Dashboard agent may only directly modify files inside pagesConfig/. Blocked path: ${filePath}`,
      );
    }
  }
}

function extractWritePaths(toolName, toolInput) {
  if (typeof toolInput.filePath === "string") {
    return [toolInput.filePath];
  }

  if (typeof toolInput.dirPath === "string") {
    return [toolInput.dirPath];
  }

  if (Array.isArray(toolInput.replacements)) {
    return toolInput.replacements
      .map((replacement) => replacement.filePath)
      .filter((filePath) => typeof filePath === "string");
  }

  if (
    (toolName === "apply_patch" || toolName === "copilot_applyPatch") &&
    typeof toolInput.input === "string"
  ) {
    return extractPatchPaths(toolInput.input);
  }

  return [];
}

function extractPatchPaths(patch) {
  const paths = [];

  const pattern = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm;

  for (const match of patch.matchAll(pattern)) {
    paths.push(match[1].trim());
  }

  return paths;
}

function isInsidePagesConfig(filePath, cwd) {
  const pagesConfigRoot = path.resolve(cwd, "pagesConfig");

  const resolvedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(cwd, filePath);

  const relativePath = path.relative(pagesConfigRoot, resolvedPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function validateExecution(toolName, toolInput) {
  if (toolName !== "run_in_terminal" && toolName !== "runInTerminal") {
    deny(
      `Execution tool "${toolName}" is not allowed for the Dashboard agent.`,
    );
  }

  const command = toolInput.command;

  if (typeof command !== "string") {
    deny("Dashboard agent could not verify the terminal command.");
  }

  const allowedCommands = [
    /^npm run pageConfig:generateId\s*$/,
    /^npm run databricks:tableSchemas(?:\s+.+)?$/,
    /^npm run pageConfig:generatePage\s*$/,
  ];

  const isAllowed = allowedCommands.some((pattern) =>
    pattern.test(command.trim()),
  );

  if (!isAllowed) {
    deny(
      `Dashboard agent may only run approved dashboard npm scripts. Blocked command: ${command}`,
    );
  }
}

function deny(reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );

  process.exit(0);
}
