// Generates a unique dashboard identifier so new dashboard configurations have stable keys.
import { v4 as uuidv4 } from "uuid";

export function generateDashboardID(): string {
  const id = uuidv4();
  console.info(`Generated new dashboard ID: ${id}`);
  return uuidv4();
}

generateDashboardID();
