import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const mode = process.argv[2];

let input = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  const data = input ? JSON.parse(input) : {};

  const sessionId = data.session_id;
  const cwd = data.cwd ?? process.cwd();

  if (!sessionId) {
    if (mode === "check") {
      deny("Missing Copilot session ID.");
    }

    process.exit(0);
  }

  const markerPath = getMarkerPath(cwd, sessionId);

  if (mode === "grant") {
    fs.mkdirSync(path.dirname(markerPath), {
      recursive: true,
    });

    fs.writeFileSync(markerPath, "development-agent");
    process.exit(0);
  }

  if (mode === "revoke") {
    fs.rmSync(markerPath, {
      force: true,
    });

    process.exit(0);
  }

  if (mode === "check") {
    checkPermission(data, markerPath);
    process.exit(0);
  }

  console.error(`Unknown permission mode: ${mode}`);
  process.exit(1);
});

function getMarkerPath(cwd, sessionId) {
  const workspaceHash = crypto
    .createHash("sha256")
    .update(cwd)
    .digest("hex")
    .slice(0, 16);

  return path.join(
    os.tmpdir(),
    "vscode-copilot-permissions",
    workspaceHash,
    sessionId,
  );
}

function checkPermission(data, markerPath) {
  fs.appendFileSync(
    path.join(os.tmpdir(), "copilot-tools.log"),
    `${data.tool_name}\n`,
  );
  const toolName = data.tool_name?.split("/").at(-1);

  const restrictedTools = new Set([
    // Current file modification tools
    "apply_patch",
    "insert_edit_into_file",
    "create_file",
    "create_directory",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "edit_notebook_file",
    "create_new_jupyter_notebook",

    // Current execution tools
    "run_in_terminal",
    "create_and_run_task",
    "run_task",
    "run_notebook_cell",

    // Legacy / contributed tool names
    "editFiles",
    "createFile",
    "createDirectory",
    "editNotebook",
    "runInTerminal",
    "createAndRunTask",
    "runNotebookCell",

    "copilot_applyPatch",
    "copilot_insertEdit",
    "copilot_createFile",
    "copilot_createDirectory",
    "copilot_replaceString",
    "copilot_multiReplaceString",
    "copilot_editNotebook",
    "copilot_runNotebookCell",
    "copilot_createAndRunTask",
  ]);

  if (!restrictedTools.has(toolName)) {
    return;
  }

  const isPrivilegedSession = fs.existsSync(markerPath);

  if (isPrivilegedSession) {
    return;
  }

  deny(
    `Tool "${toolName}" is disabled. Select the Development agent and start a new chat session to make changes.`,
  );
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
}
