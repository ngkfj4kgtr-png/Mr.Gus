import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer, claimTask, buyBusiness, collectOfflineIncome, upgradeBusiness,
  claimAchievement, claimGoal, claimEvent, claimDailyActivity, buyShopItem,
  hireEmployee, expandBusiness, addInvestment, activateBusinessBoost
} from '../src/economy.js';
import { validateOperationId, createOperationId } from '../src/operations.js';

const seed=()=>{
  const p=createPlayer('test');
  p.balance=100000;
  return p;
};

test('task reward is granted once and repeat is rejected',()=>{
  const p=seed();
  const before=p.balance;
  const out=claimTask(p,'first_order');
  assert.equal(out.reward,250);
  assert.equal(p.balance,before+250);
  assert.throws(()=>claimTask(p,'first_order'),/already claimed/);
  assert.equal(p.balance,before+250);
});

test('business purchase and upgrade preserve non-negative balance',()=>{
  const p=seed();
  const b=buyBusiness(p,'kiosk',Date.now());
  assert.equal(b.id,'kiosk');
  assert.ok(p.balance>=0);
  const before=p.balance;
  upgradeBusiness(p,'kiosk',Date.now());
  assert.ok(p.balance<before);
  assert.ok(p.balance>=0);
});

test('offline income increases balance without allowing negative balance',()=>{
  const p=seed();
  const now=Date.now();
  buyBusiness(p,'kiosk',now-8*60*60*1000);
  const before=p.balance;
  const out=collectOfflineIncome(p,now,1);
  assert.ok(out.income>=0);
  assert.ok(p.balance>=before);
  assert.ok(p.balance>=0);
});

test('invalid task, business and shop item do not mutate balance',()=>{
  const p=seed();
  const before=p.balance;
  assert.throws(()=>claimTask(p,'nope'),/not found/);
  assert.throws(()=>buyBusiness(p,'nope',Date.now()),/not found/);
  assert.throws(()=>buyShopItem(p,'nope',Date.now()),/not found/);
  assert.equal(p.balance,before);
});

test('achievement, goal, event and daily rewards cannot be claimed twice',()=>{
  const p=seed();
  buyBusiness(p,'kiosk',Date.now());
  const a=claimAchievement(p,'first_business');
  assert.equal(a.reward,300);
  const afterA=p.balance;
  assert.throws(()=>claimAchievement(p,'first_business'),/already claimed/);
  assert.equal(p.balance,afterA);

  const g=claimGoal(p,'start_business');
  assert.equal(g.reward,500);
  const afterG=p.balance;
  assert.throws(()=>claimGoal(p,'start_business'),/already claimed/);
  assert.equal(p.balance,afterG);

  const e=claimEvent(p,Date.UTC(2026,8,27));
  assert.ok(e.reward>0);
  const afterE=p.balance;
  assert.throws(()=>claimEvent(p,Date.UTC(2026,8,27)),/already claimed/);
  assert.equal(p.balance,afterE);

  const d=claimDailyActivity(p,Date.UTC(2026,8,27));
  assert.ok(d.reward>0);
  const afterD=p.balance;
  assert.throws(()=>claimDailyActivity(p,Date.UTC(2026,8,27)),/already claimed/);
  assert.equal(p.balance,afterD);
});

test('employee, expansion, investment and boost reject insufficient funds atomically at domain level',()=>{
  const p=seed();
  buyBusiness(p,'kiosk',Date.now());
  p.balance=0;
  assert.throws(()=>hireEmployee(p,'kiosk','cashier',Date.now()),/Insufficient balance/);
  assert.throws(()=>expandBusiness(p,'kiosk',Date.now()),/Insufficient balance/);
  assert.throws(()=>addInvestment(p,'kiosk',5000),/Insufficient balance/);
  assert.throws(()=>activateBusinessBoost(p,'kiosk',Date.now()),/Insufficient balance/);
  assert.equal(p.balance,0);
});

test('shop purchases apply expected effects',()=>{
  const p=seed();
  const beforeXp=p.xp;
  const out=buyShopItem(p,'xp_boost',Date.now());
  assert.equal(out.itemId,'xp_boost');
  assert.ok(p.xp>beforeXp);
  assert.equal(p.inventory.xp_boost,1);
});


test('operation IDs reserve system namespace and remain valid for normal clients',()=>{
  const id=createOperationId('client');
  assert.equal(validateOperationId(id),id);
  assert.throws(()=>validateOperationId('sys_income_12345678'),/Invalid operation ID/);
});
