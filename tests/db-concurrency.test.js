import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb,migrate,getPool,upsertTelegramUser,createSession,getUserBySession,deleteSession,withPlayerTransaction,assertOperationNotProcessed,recordOperation } from '../src/db.js';
import {collectOfflineIncome} from '../src/economy.js';
import {OPERATION_TYPES} from '../src/operations.js';

const enabled=Boolean(process.env.DATABASE_URL);
async function freshUser(){ await migrate(); const tgId=String(Date.now())+String(Math.floor(Math.random()*1_000_000)); return upsertTelegramUser({id:tgId,first_name:'CI',last_name:'Test'}); }
async function cleanup(userId){ const pool=await getPool(); await pool.query('DELETE FROM users WHERE id=$1',[userId]); }
async function runTransactions(count,fn){ return Promise.allSettled(Array.from({length:count},(_,i)=>fn(i))); }

test('PostgreSQL concurrency: same operation ID mutates exactly once',{skip:!enabled},async()=>{
 const user=await freshUser(); try{
  const results=await runTransactions(10,async()=>withPlayerTransaction(user.id,async(player,client)=>{ const operationId='concurrent_same_operation'; await assertOperationNotProcessed(client,{operationId,userId:user.id}); player.balance+=1; await recordOperation(client,{operationId,type:OPERATION_TYPES.TASK_REWARD,userId:user.id,reward:1}); }));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(results.filter(r=>r.status==='rejected').length,9);
  const pool=await getPool(); const row=(await pool.query('SELECT balance,(SELECT count(*) FROM economy_operations WHERE user_id=$1 AND operation_id=$2) AS operations FROM users WHERE id=$1',[user.id,'concurrent_same_operation'])).rows[0];
  assert.equal(Number(row.balance),1); assert.equal(Number(row.operations),1);
 }finally{await cleanup(user.id);} });

test('PostgreSQL concurrency: different operations do not lose balance updates',{skip:!enabled},async()=>{
 const user=await freshUser(); try{
  const results=await runTransactions(10,async(i)=>withPlayerTransaction(user.id,async(player,client)=>{ const operationId='concurrent_'+i; await assertOperationNotProcessed(client,{operationId,userId:user.id}); player.balance+=1; await recordOperation(client,{operationId,type:OPERATION_TYPES.TASK_REWARD,userId:user.id,reward:1}); }));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,10);
  const pool=await getPool(); const row=(await pool.query('SELECT balance FROM users WHERE id=$1',[user.id])).rows[0]; assert.equal(Number(row.balance),10);
 }finally{await cleanup(user.id);} });

test('PostgreSQL concurrency: offline income is paid once',{skip:!enabled},async()=>{
 const user=await freshUser(); try{ const pool=await getPool();
  await pool.query('UPDATE users SET balance=0,businesses=$1::jsonb,last_income_at=$2 WHERE id=$3',[JSON.stringify({kiosk:{id:'kiosk',level:1,purchasedAt:1000}}),1000,user.id]);
  const results=await runTransactions(10,()=>withPlayerTransaction(user.id,async(player)=>collectOfflineIncome(player,1000+3600*1000)));
  const incomes=results.filter(r=>r.status==='fulfilled').map(r=>r.value.result.income); assert.equal(incomes.filter(x=>x===500).length,1); assert.equal(incomes.filter(x=>x===0).length,9);
  const row=(await pool.query('SELECT balance,last_income_at FROM users WHERE id=$1',[user.id])).rows[0]; assert.equal(Number(row.balance),500); assert.equal(Number(row.last_income_at),3601000);
 }finally{await cleanup(user.id);} });

test('PostgreSQL transaction rollback preserves progress',{skip:!enabled},async()=>{
 const user=await freshUser(); try{ await assert.rejects(()=>withPlayerTransaction(user.id,async(player)=>{player.balance=999; throw new Error('forced rollback');}),/forced rollback/);
  const pool=await getPool(); const row=(await pool.query('SELECT balance,xp,level FROM users WHERE id=$1',[user.id])).rows[0]; assert.equal(Number(row.balance),0); assert.equal(Number(row.xp),0); assert.equal(Number(row.level),1);
 }finally{await cleanup(user.id);} });

test('PostgreSQL sessions: concurrent rotation leaves exactly one active session',{skip:!enabled},async()=>{
 const user=await freshUser(); try{
  const tokens=await Promise.all([createSession(user.id),createSession(user.id),createSession(user.id),createSession(user.id)]);
  const pool=await getPool();
  const row=(await pool.query('SELECT count(*) AS count FROM sessions WHERE user_id=$1',[user.id])).rows[0];
  assert.equal(Number(row.count),1);
  const valid=await Promise.all(tokens.map(async token=>Boolean(await getUserBySession(token))));
  assert.equal(valid.filter(Boolean).length,1);
 }finally{await cleanup(user.id);}
});

test('PostgreSQL sessions: rotation invalidates the previous token',{skip:!enabled},async()=>{
 const user=await freshUser(); try{
  const first=await createSession(user.id);
  assert.ok(await getUserBySession(first));
  const second=await createSession(user.id);
  assert.ok(await getUserBySession(second));
  assert.equal(await getUserBySession(first),null);
 }finally{await cleanup(user.id);}
});

test('PostgreSQL sessions: expired token is rejected and logout deletes active token',{skip:!enabled},async()=>{
 const user=await freshUser(); try{
  const token=await createSession(user.id);
  const pool=await getPool();
  await pool.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",[user.id]);
  assert.equal(await getUserBySession(token),null);
  const active=await createSession(user.id);
  assert.ok(await getUserBySession(active));
  await deleteSession(active);
  assert.equal(await getUserBySession(active),null);
 }finally{await cleanup(user.id);}
});
