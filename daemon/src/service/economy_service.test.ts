import assert from "assert";
import fs from "fs-extra";
import os from "os";
import path from "path";
import initSqlJs from "sql.js";
import { EconomyDatabase } from "./economy_database";

async function main() {
  const SQL = await initSqlJs();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mcsm-economy-test-"));
  const databasePath = path.join(tempRoot, "economy.sqlite");
  const database = new EconomyDatabase(SQL, databasePath);

  try {
    await Promise.all([
      database.run(
        `INSERT OR IGNORE INTO economy_transactions
         (id, server_id, instance_id, player_uuid, currency_type, delta, balance_after,
          category, reference_id, occurred_at, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["tx-1", "server-1", "server-1", "player-1", "money", 10, 10, "SYSTEM_IN", "ref-1", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]
      ),
      database.run(
        `INSERT OR IGNORE INTO economy_transactions
         (id, server_id, instance_id, player_uuid, currency_type, delta, balance_after,
          category, reference_id, occurred_at, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["tx-duplicate", "server-1", "server-1", "player-1", "money", 10, 10, "SYSTEM_IN", "ref-1", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]
      )
    ]);
    const count = await database.get<{ count: number }>(
      "SELECT COUNT(1) AS count FROM economy_transactions WHERE server_id = ? AND reference_id = ?",
      ["server-1", "ref-1"]
    );
    assert.strictEqual(Number(count?.count), 1, "reference_id must be idempotent");

    await database.run(
      `INSERT INTO economy_currencies(type, name, total_balance, player_count, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(type) DO UPDATE SET
         name = excluded.name,
         total_balance = excluded.total_balance,
         player_count = excluded.player_count,
         updated_at = excluded.updated_at
       WHERE economy_currencies.updated_at IS NULL
          OR excluded.updated_at >= economy_currencies.updated_at`,
      ["money", "new", 200, 3, "2026-01-02T00:00:00.000Z"]
    );
    await database.run(
      `INSERT INTO economy_currencies(type, name, total_balance, player_count, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(type) DO UPDATE SET
         name = excluded.name,
         total_balance = excluded.total_balance,
         player_count = excluded.player_count,
         updated_at = excluded.updated_at
       WHERE economy_currencies.updated_at IS NULL
          OR excluded.updated_at >= economy_currencies.updated_at`,
      ["money", "stale", 1, 1, "2026-01-01T00:00:00.000Z"]
    );
    const currency = await database.get<{ name: string; total_balance: number }>(
      "SELECT name, total_balance FROM economy_currencies WHERE type = ?",
      ["money"]
    );
    assert.strictEqual(currency?.name, "new", "stale snapshots must not overwrite current names");
    assert.strictEqual(Number(currency?.total_balance), 200, "stale snapshots must not overwrite balances");

    await database.flush();
    await database.run("UPDATE economy_currencies SET total_balance = ? WHERE type = ?", [300, "money"]);
    const originalWriteAtomic = (database as any).writeAtomic;
    (database as any).writeAtomic = async () => {
      throw new Error("simulated flush failure");
    };
    await assert.rejects(() => database.flush(), /simulated flush failure/);
    (database as any).writeAtomic = originalWriteAtomic;
    await database.flush();
    assert.strictEqual(await fs.pathExists(databasePath), true, "failed flush must remain retryable");
  } finally {
    await database.flush().catch(() => undefined);
    await fs.remove(tempRoot);
  }

  console.log("economy persistence tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
