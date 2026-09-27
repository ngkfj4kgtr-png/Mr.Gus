import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer,
  claimTask,
  buyBusiness,
  upgradeBusiness,
  collectOfflineIncome,
  hourlyProfit,
  CONFIG,
  availableAchievements,
  availableGoals,
  claimAchievement,
  claimGoal,
  currentEvent,
  claimEvent,
  availableTasks
} from '../src/economy.js';

test('scenario: new player reaches first business without free money', () => {
  const player = createPlayer('new-player');

  assert.equal(player.balance, 0);
  claimTask(player, 'first_order');
  claimTask(player, 'second_order');
  claimTask(player, 'third_order');

  assert.equal(player.balance, 1_100);
  assert.equal(player.xp, 225);
  assert.equal(Object.keys(player.businesses).length, 0);

  buyBusiness(player, 'kiosk', 1_000);

  assert.equal(player.balance, 100);
  assert.equal(player.businesses.kiosk.level, 1);
  assert.equal(player.lastIncomeAt, 1_000);
  assert.equal(hourlyProfit(player, 'kiosk'), 500);
});

test('scenario: active player can accumulate, then upgrade and increase profit', () => {
  const player = createPlayer('active-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const twoHoursLater = 1_000 + 2 * 60 * 60 * 1_000;
  assert.equal(collectOfflineIncome(player, twoHoursLater).income, 1_000);
  assert.equal(player.balance, 1_000);

  player.balance = 10_000;
  const upgradeTime = twoHoursLater + 1_000;
  const before = hourlyProfit(player, 'kiosk');
  const upgrade = upgradeBusiness(player, 'kiosk', upgradeTime);

  assert.equal(upgrade.level, 2);
  assert.equal(upgrade.cost, 500);
  assert.equal(player.balance, 9_500);
  assert.equal(player.xp, 150);
  assert.equal(hourlyProfit(player, 'kiosk'), 675);
  assert.ok(hourlyProfit(player, 'kiosk') > before);
});

test('scenario: inactive player receives at most eight hours of offline income', () => {
  const player = createPlayer('inactive-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const thirtyDaysLater = 1_000 + 30 * 24 * 60 * 60 * 1_000;
  const result = collectOfflineIncome(player, thirtyDaysLater);

  assert.equal(result.seconds, CONFIG.maxOfflineSeconds);
  assert.equal(result.income, 4_000);
  assert.equal(player.balance, 4_000);
  assert.equal(player.lastIncomeAt, thirtyDaysLater);
});

test('scenario: repeated reward cannot create additional money', () => {
  const player = createPlayer('retry-player');

  claimTask(player, 'first_order');
  const balanceAfterFirstClaim = player.balance;
  const xpAfterFirstClaim = player.xp;

  assert.throws(() => claimTask(player, 'first_order'), /already claimed/);
  assert.equal(player.balance, balanceAfterFirstClaim);
  assert.equal(player.xp, xpAfterFirstClaim);
});

test('scenario: repeated offline collection at the same time pays zero', () => {
  const player = createPlayer('repeat-income-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const returnTime = 1_000 + 2 * 60 * 60 * 1_000;
  assert.equal(collectOfflineIncome(player, returnTime).income, 1_000);
  assert.equal(collectOfflineIncome(player, returnTime).income, 0);
  assert.equal(player.balance, 1_000);
});

test('scenario: device clock changes cannot grant future income', () => {
  const player = createPlayer('clock-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 5_000);

  assert.throws(() => collectOfflineIncome(player, 4_999), /Clock moved backwards/);
  assert.equal(player.balance, 0);
  assert.equal(player.lastIncomeAt, 5_000);
});

test('scenario: failed mutation preserves the original player state', () => {
  const player = createPlayer('rollback-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const snapshot = {
    balance: player.balance,
    xp: player.xp,
    level: player.level,
    business: structuredClone(player.businesses.kiosk),
    lastIncomeAt: player.lastIncomeAt
  };

  assert.throws(() => upgradeBusiness(player, 'kiosk', 6_000), /Insufficient balance/);

  assert.deepEqual({
    balance: player.balance,
    xp: player.xp,
    level: player.level,
    business: player.businesses.kiosk,
    lastIncomeAt: player.lastIncomeAt
  }, snapshot);
});

test('scenario: known instant rewards cannot reach one million', () => {
  const player = createPlayer('million-player');

  for (const taskId of ['first_order', 'second_order', 'third_order', 'busy_day']) {
    claimTask(player, taskId);
  }

  assert.equal(player.balance, 2_000);
  assert.ok(player.balance < 1_000_000);

  buyBusiness(player, 'kiosk', 10_000);
  assert.equal(player.balance, 1_000);

  assert.equal(collectOfflineIncome(player, 10_000).income, 0);
  assert.ok(player.balance < 1_000_000);
});

test('scenario: device timestamp cannot be supplied to accelerate server-side income', () => {
  const player = createPlayer('server-time-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 10_000);

  assert.throws(() => collectOfflineIncome(player, 9_999), /Clock moved backwards/);
  assert.equal(player.balance, 0);
});


test('scenario: daily event multiplier increases collected business income', () => {
  const player = createPlayer('event-income-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const twoHoursLater = 1_000 + 2 * 60 * 60 * 1_000;
  const result = collectOfflineIncome(player, twoHoursLater, 1.20);

  assert.equal(result.income, 1_200);
  assert.equal(player.balance, 1_200);
});

test('scenario: progression rewards are one-time and unlock from server state', () => {
  const player = createPlayer('progression-player');

  claimTask(player, 'first_order');
  claimTask(player, 'second_order');
  claimTask(player, 'third_order');
  buyBusiness(player, 'kiosk', 1_000);

  assert.equal(availableAchievements(player).find(x => x.id === 'first_business').unlocked, true);
  assert.equal(availableGoals(player).find(x => x.id === 'start_business').unlocked, true);

  const achievement = claimAchievement(player, 'first_business');
  const goal = claimGoal(player, 'start_business');

  assert.equal(achievement.reward, 300);
  assert.equal(goal.reward, 500);
  assert.throws(() => claimAchievement(player, 'first_business'), /already claimed/);
  assert.throws(() => claimGoal(player, 'start_business'), /already claimed/);
});

test('scenario: daily event reward is claimable once per date', () => {
  const player = createPlayer('event-player');
  const now = Date.parse('2026-09-26T12:00:00.000Z');

  const event = currentEvent(now);
  const reward = claimEvent(player, now);

  assert.equal(reward.eventId, event.id);
  assert.equal(reward.dateKey, event.dateKey);
  assert.throws(() => claimEvent(player, now), /already claimed/);
});


test('scenario: millionaire achievement uses lifetime earned income, not current balance', () => {
  const player = createPlayer('lifetime-millionaire-player');
  player.stats.totalEarned = 1_000_000;
  player.balance = 1_000;
  assert.equal(availableAchievements(player).find(x => x.id === 'millionaire').unlocked, true);
});

test('scenario: business upgrade income collection respects the daily event multiplier', () => {
  const player = createPlayer('upgrade-event-player');
  player.balance = 10_000;
  buyBusiness(player, 'kiosk', 1_000);
  const twoHoursLater = 1_000 + 2 * 60 * 60 * 1_000;
  const before = player.balance;
  const income = collectOfflineIncome(player, twoHoursLater, 1.20);
  assert.equal(income.income, 1_200);
  assert.equal(player.balance, before + 1_200);
});


test('scenario: ten-thousand income goal ignores reward-only earnings', () => {
  const player = createPlayer('income-goal-semantics-player');
  player.stats.totalEarned = 10_000;
  player.stats.totalIncome = 9_999;
  assert.equal(availableGoals(player).find(x => x.id === 'earn_10k').unlocked, false);
  player.stats.totalIncome = 10_000;
  assert.equal(availableGoals(player).find(x => x.id === 'earn_10k').unlocked, true);
});

test('scenario: stats validation rejects corrupted progression counters', () => {
  const player = createPlayer('stats-validation-player');
  player.stats.totalEarned = -1;
  assert.throws(() => availableGoals(player), /Invalid stat: totalEarned/);
});

test('scenario: all four tasks unlock the final task with consistent wording', () => {
  const player = createPlayer('four-tasks-player');
  for (const taskId of ['first_order','second_order','third_order']) claimTask(player, taskId);
  const task = availableTasks(player).find(x => x.id === 'busy_day');
  assert.equal(task.locked, false);
  assert.equal(task.title, 'Выполнить 4 задания');
});


test('scenario: malformed calendar event dates are rejected', () => {
  const player = createPlayer('invalid-calendar-event-player');
  player.eventClaims['2026-02-30'] = true;
  assert.throws(() => availableGoals(player), /Invalid event claim/);
});

test('scenario: persisted progression IDs and event claims must be valid', () => {
  const player = createPlayer('corrupt-progression-player');
  player.claimedTasks.add('unknown_task');
  assert.throws(() => availableTasks(player), /Invalid claimed task/);

  const clean = createPlayer('corrupt-event-player');
  clean.eventClaims['not-a-date'] = true;
  assert.throws(() => availableGoals(clean), /Invalid event claim/);
});


import { migrate, upsertTelegramUser, withPlayerTransaction, recordOperation, assertOperationNotProcessed, getPool } from '../src/db.js';

const integrationEnabled = Boolean(process.env.DATABASE_URL);
const testTelegramId = () => (BigInt(Date.now()) * 100000n + BigInt(process.pid)).toString();

test('integration: concurrent identical operation is applied exactly once', { skip: !integrationEnabled }, async () => {
  await migrate();
  const telegramId = testTelegramId();
  const user = await upsertTelegramUser({ id: telegramId, first_name: 'Concurrency', last_name: 'Test' });
  const operationId = 'concurrent_same_' + telegramId;

  const run = () => withPlayerTransaction(user.id, async (player, client) => {
    await assertOperationNotProcessed(client, { operationId, userId: user.id });
    player.balance += 100;
    await recordOperation(client, { operationId, type: OPERATION_TYPES.TASK_REWARD, userId: user.id, reward: 100 });
    return player.balance;
  });

  const results = await Promise.allSettled([run(), run()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason?.code === 'OPERATION_ALREADY_PROCESSED').length, 1);

  const row = await (await getPool()).query('SELECT balance FROM users WHERE id=$1', [user.id]);
  assert.equal(Number(row.rows[0].balance), 100);
});

test('integration: concurrent different operations both commit without double income', { skip: !integrationEnabled }, async () => {
  await migrate();
  const telegramId = testTelegramId();
  const user = await upsertTelegramUser({ id: telegramId, first_name: 'Income', last_name: 'Test' });
  const fixedStart = 1_000_000;
  const fixedEnd = fixedStart + 3_600_000;

  await withPlayerTransaction(user.id, async (player) => {
    player.businesses = { kiosk: { id: 'kiosk', level: 1, purchasedAt: fixedStart - 1 } };
    player.lastIncomeAt = fixedStart;
  });

  const collect = () => withPlayerTransaction(user.id, async (player) => {
    const before = player.lastIncomeAt;
    const income = collectOfflineIncome(player, fixedEnd, 1);
    return { before, income: income.income, after: player.lastIncomeAt };
  });
  const results = await Promise.all([collect(), collect()]);
  assert.deepEqual(results.map(r => r.result.income).sort((a, b) => a - b), [0, 500]);

  const row = await (await getPool()).query('SELECT balance, last_income_at, stats FROM users WHERE id=$1', [user.id]);
  assert.equal(Number(row.rows[0].balance), 500);
  assert.equal(Number(row.rows[0].last_income_at), fixedEnd);
  assert.equal(Number(row.rows[0].stats.totalIncome), 500);
});
