import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";

/** D1 has no interactive transactions: related writes go in one batch. */
export async function runBatch(statements: BatchItem<"sqlite">[]) {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
