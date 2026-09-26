import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, migrate, upsertTelegramUser, withPlayerTransaction, recordOperation, assertOperationNotProcessed, getPool } from '../src/db.js';
import { OPERATION_TYPES } from '../src/operations.js';

const hasDb = Boolean(process.env.DATABASE_URL);
const maybe = { skip: !hasDb };

test('db: concurrent same operation commits exactly once', maybe, async () => {
  await initDb();
  await migrate();
  const telegramId = String(BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000)));
  const row = await upsertTelegramUser({
    id: telegramId,
    first_name: 'Concurrency',
    last_name: 'Test'
  });

  try {
    const operationId = `concurrency_${telegramId}`;
    const run = () => withPlayerTransaction(row.id, async (player, client) => {
      await assertOperationNotProcessed(client, { operationId, userId: row.id });
      player.balance += 250;
      await recordOperation(client, {
        operationId,
        type: OPERATION_TYPES.TASK_REWARD,
        userId: row.id,
        reward: 250
      });
      return 'committed';
    });

    const results = await Promise.allSettled([run(), run()]);
    const fulfilled = results.filter(x => x.status === 'fulfilled');
    const rejected = results.filter(x => x.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.message, /Operation already processed/);

    const pool = await getPool();
    const state = await pool.query('SELECT balance FROM users WHERE id=$1', [row.id]);
    const operations = await pool.query(
      'SELECT operation_id, reward_amount FROM economy_operations WHERE user_id=$1 AND operation_id=$2',
      [row.id, operationId]
    );

    assert.equal(Number(state.rows[0].balance), 250);
    assert.equal(operations.rowCount, 1);
    assert.equal(Number(operations.rows[0].reward_amount), 250);
  } finally {
    const pool = await getPool();
    await pool.query('DELETE FROM users WHERE id=$1', [row.id]);
  }
});
