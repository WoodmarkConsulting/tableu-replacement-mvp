import { randomUUID } from "node:crypto";

import { runQuery } from "../warehouse/connection";
import type { FilterSnapshot } from "@/types/filters";

const CATALOG =
  process.env.FILTER_SNAPSHOT_CATALOG ??
  "westeurope_extollo_2026007fielddatadev75cd75";
const SCHEMA = process.env.FILTER_SNAPSHOT_SCHEMA ?? "2018001_cudo_mvp_dev";
const TABLE = "filter_snapshots";

// All identifiers are constants (schema starts with a digit -> backticks required).
const FQTN = `\`${CATALOG}\`.\`${SCHEMA}\`.\`${TABLE}\``;

let ensureTablePromise: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = runQuery(
      `CREATE TABLE IF NOT EXISTS ${FQTN} (id STRING, dashboard STRING, state STRING, created_at TIMESTAMP) USING DELTA`,
    )
      .then(() => undefined)
      .catch((error) => {
        ensureTablePromise = null;
        throw error;
      });
  }

  return ensureTablePromise;
}

export async function saveSnapshot(
  dashboard: string,
  snapshot: FilterSnapshot,
): Promise<string> {
  await ensureTable();

  const id = randomUUID();

  await runQuery(
    `INSERT INTO ${FQTN} (id, dashboard, state, created_at) VALUES (:id, :dashboard, :state, current_timestamp())`,
    { id, dashboard, state: JSON.stringify(snapshot) },
  );

  return id;
}

export async function loadSnapshot(id: string): Promise<FilterSnapshot | null> {
  const rows = await runQuery<{ state: string }[]>(
    `SELECT state FROM ${FQTN} WHERE id = :id LIMIT 1`,
    { id },
  );

  if (rows.length === 0) {
    return null;
  }

  try {
    return JSON.parse(rows[0].state) as FilterSnapshot;
  } catch {
    return null;
  }
}
