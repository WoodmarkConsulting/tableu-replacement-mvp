// Checks staged module changes for matching documentation updates so module instructions cannot become stale.
import { execFileSync } from "node:child_process";

const ROOT_MODULE_INSTRUCTIONS = "modules/instructions.md";

function getStagedPaths(): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMRD", "-z"],
    { encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean);
}

const stagedPaths = new Set(getStagedPaths());
const changedModules = new Set<string>();

for (const filePath of stagedPaths) {
  const match = /^modules\/([^/]+)\/(.+)$/.exec(filePath);

  if (match && match[2] !== "instructions.md") {
    changedModules.add(match[1]);
  }
}

if (changedModules.size === 0) {
  process.exit(0);
}

const missingInstructions = [...changedModules]
  .sort()
  .map((moduleName) => `modules/${moduleName}/instructions.md`)
  .filter((filePath) => !stagedPaths.has(filePath));

if (!stagedPaths.has(ROOT_MODULE_INSTRUCTIONS)) {
  missingInstructions.unshift(ROOT_MODULE_INSTRUCTIONS);
}

if (missingInstructions.length > 0) {
  console.error(
    "Module documentation check failed. Stage updates to these files:",
  );

  for (const filePath of missingInstructions) {
    console.error(`  - ${filePath}`);
  }

  console.error(
    "Every staged module implementation change requires both the module-specific and root module instructions in the same commit.",
  );
  process.exit(1);
}
