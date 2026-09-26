import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer,
  claimTask,
  buyBusiness,
  upgradeBusiness,
  collectOfflineIncome,
  hourlyProfit,
  CONFIG
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
  assert.equal(hourlyProfit(player, 'kiosk'), 100);
});

test('scenario: active player can accumulate, then upgrade and increase profit', () => {
  const player = createPlayer('active-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const twoHoursLater = 1_000 + 2 * 60 * 60 * 1_000;
  assert.equal(collectOfflineIncome(player, twoHoursLater).income, 200);
  assert.equal(player.balance, 200);

  player.balance = 10_000;
  const upgradeTime = twoHoursLater + 1_000;
  const before = hourlyProfit(player, 'kiosk');
  const upgrade = upgradeBusiness(player, 'kiosk', upgradeTime);

  assert.equal(upgrade.level, 2);
  assert.equal(upgrade.cost, 1_350);
  assert.equal(player.balance, 8_650);
  assert.equal(player.xp, 150);
  assert.equal(hourlyProfit(player, 'kiosk'), 135);
  assert.ok(hourlyProfit(player, 'kiosk') > before);
});

test('scenario: inactive player receives at most eight hours of offline income', () => {
  const player = createPlayer('inactive-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 1_000);

  const thirtyDaysLater = 1_000 + 30 * 24 * 60 * 60 * 1_000;
  const result = collectOfflineIncome(player, thirtyDaysLater);

  assert.equal(result.seconds, CONFIG.maxOfflineSeconds);
  assert.equal(result.income, 800);
  assert.equal(player.balance, 800);
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
  assert.equal(collectOfflineIncome(player, returnTime).income, 200);
  assert.equal(collectOfflineIncome(player, returnTime).income, 0);
  assert.equal(player.balance, 200);
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

  // No elapsed server time means no business income.
  assert.equal(collectOfflineIncome(player, 10_000).income, 0);
  assert.ok(player.balance < 1_000_000);
});

test('scenario: device timestamp cannot be supplied to accelerate server-side income', () => {
  const player = createPlayer('server-time-player');
  player.balance = 1_000;
  buyBusiness(player, 'kiosk', 10_000);

  // The economy function accepts only the server-selected timestamp.
  // A timestamp earlier than the recorded server time is rejected.
  assert.throws(() => collectOfflineIncome(player, 9_999), /Clock moved backwards/);
  assert.equal(player.balance, 0);
});
