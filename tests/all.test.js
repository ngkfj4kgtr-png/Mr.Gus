import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,claimTask,buyBusiness,collectOfflineIncome,hourlyProfit,upgradeBusiness,availableTasks,CONFIG} from '../src/economy.js';
import {createOperationId,validateOperationId} from '../src/operations.js';

test('new player starts safely',()=>{const p=createPlayer('u');assert.equal(p.balance,0);assert.equal(p.level,1);});
test('task chain cannot be skipped',()=>{const p=createPlayer('u');assert.equal(availableTasks(p)[1].locked,true);claimTask(p,'first_order');assert.equal(p.balance,250);assert.throws(()=>claimTask(p,'third_order'),/locked/);});
test('task reward cannot be claimed twice',()=>{const p=createPlayer('u');claimTask(p,'first_order');assert.throws(()=>claimTask(p,'first_order'),/already claimed/);assert.equal(p.balance,250);});
test('business profit is server-side',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);assert.equal(hourlyProfit(p,'kiosk'),100);});
test('offline income is capped at eight hours',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);const r=collectOfflineIncome(p,1000+24*3600*1000);assert.equal(r.seconds,CONFIG.maxOfflineSeconds);assert.equal(r.income,800);});
test('same collection timestamp pays zero twice',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);const t=1000+2*3600*1000;assert.equal(collectOfflineIncome(p,t).income,200);assert.equal(collectOfflineIncome(p,t).income,0);});
test('clock rollback is rejected',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',5000);assert.throws(()=>collectOfflineIncome(p,4999),/Clock moved backwards/);});
test('upgrade changes profit',()=>{const p=createPlayer('u');p.balance=1000;buyBusiness(p,'kiosk',1000);p.balance=100000;upgradeBusiness(p,'kiosk',2000);assert.equal(hourlyProfit(p,'kiosk'),135);});
test('operation IDs are validated',()=>{const id=createOperationId('income');assert.match(id,/^income_/);validateOperationId(id);assert.throws(()=>validateOperationId('bad id'),/Invalid operation ID/);});
