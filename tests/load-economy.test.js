import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer,
  claimTask,
  buyBusiness,
  upgradeBusiness,
  collectOfflineIncome,
  hourlyProfit,
  availableTasks,
  availableAchievements,
  availableGoals,
  currentEvent
} from '../src/economy.js';

function assertInvariant(player) {
  assert.ok(Number.isSafeInteger(player.balance));
  assert.ok(player.balance >= 0);
  assert.ok(Number.isSafeInteger(player.xp));
  assert.ok(player.xp >= 0);
  assert.ok(Number.isSafeInteger(player.level));
  assert.ok(player.level >= 1);
  assert.equal(player.stats.businessesOwned, Object.keys(player.businesses).length);
  assert.ok(player.stats.totalIncome >= 0);
  assert.ok(player.stats.totalEarned >= 0);
  for (const business of Object.values(player.businesses)) {
    assert.ok(Number.isSafeInteger(business.level));
    assert.ok(business.level >= 1);
    assert.ok(Number.isSafeInteger(business.expansionLevel));
    assert.ok(business.expansionLevel >= 0);
    assert.ok(Number.isSafeInteger(business.investment));
    assert.ok(business.investment >= 0);
    assert.ok(Number.isSafeInteger(business.purchasedAt));
  }
}

test('load: 1000 isolated players survive a full early-game economy workload', async () => {
  const playerCount = 1_000;
  const players = Array.from({ length: playerCount }, (_, i) => createPlayer(`load-${i}`));
  const start = 1_700_000_000_000;

  await Promise.all(players.map(async (player, index) => {
    claimTask(player, 'first_order');
    claimTask(player, 'second_order');
    claimTask(player, 'third_order');

    buyBusiness(player, 'kiosk', start + index);
    const firstCollection = collectOfflineIncome(player, start + index + 8 * 60 * 60 * 1_000);
    assert.equal(firstCollection.income, 4_000);

    upgradeBusiness(player, 'kiosk', start + index + 8 * 60 * 60 * 1_000 + 1);

    const secondCollection = collectOfflineIncome(
      player,
      start + index + 16 * 60 * 60 * 1_000,
      1.10
    );
    assert.equal(secondCollection.income, 4_950);

    assert.ok(hourlyProfit(player, 'kiosk') > 500);
    assertInvariant(player);
  }));

  assert.equal(players.length, playerCount);
  assert.equal(players.reduce((sum, p) => sum + p.balance, 0), 10_450_000);
  assert.equal(players.reduce((sum, p) => sum + p.stats.totalIncome, 0), 8_950_000);
  assertInvariant(players[0]);
});

test('load: concurrent reads over many players do not mutate economy state', async () => {
  const playerCount = 1_000;
  const players = Array.from({ length: playerCount }, (_, i) => {
    const player = createPlayer(`read-${i}`);
    claimTask(player, 'first_order');
    claimTask(player, 'second_order');
    claimTask(player, 'third_order');
    buyBusiness(player, 'kiosk', 2_000_000 + i);
    return player;
  });

  const snapshots = players.map(player => ({
    balance: player.balance,
    xp: player.xp,
    level: player.level,
    tasks: [...player.claimedTasks],
    achievements: [...player.claimedAchievements],
    goals: [...player.claimedGoals]
  }));

  await Promise.all(players.flatMap(player => [
    Promise.resolve().then(() => availableTasks(player)),
    Promise.resolve().then(() => availableAchievements(player)),
    Promise.resolve().then(() => availableGoals(player)),
    Promise.resolve().then(() => currentEvent(1_758_888_000_000))
  ]));

  players.forEach((player, index) => {
    const before = snapshots[index];
    assert.equal(player.balance, before.balance);
    assert.equal(player.xp, before.xp);
    assert.equal(player.level, before.level);
    assert.deepEqual([...player.claimedTasks], before.tasks);
    assert.deepEqual([...player.claimedAchievements], before.achievements);
    assert.deepEqual([...player.claimedGoals], before.goals);
    assertInvariant(player);
  });
});

test('load: failed mutations remain atomic across repeated retries', () => {
  const players = Array.from({ length: 500 }, (_, i) => {
    const player = createPlayer(`retry-${i}`);
    claimTask(player, 'first_order');
    claimTask(player, 'second_order');
    claimTask(player, 'third_order');
    buyBusiness(player, 'kiosk', 3_000_000 + i);
    return player;
  });

  for (const player of players) {
    const before = structuredClone({
      balance: player.balance,
      xp: player.xp,
      level: player.level,
      businesses: player.businesses,
      lastIncomeAt: player.lastIncomeAt,
      stats: player.stats
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.throws(
        () => upgradeBusiness(player, 'kiosk', 3_000_000 + attempt),
        /Insufficient balance/
      );
    }

    assert.deepEqual({
      balance: player.balance,
      xp: player.xp,
      level: player.level,
      businesses: player.businesses,
      lastIncomeAt: player.lastIncomeAt,
      stats: player.stats
    }, before);
    assertInvariant(player);
  }
});
