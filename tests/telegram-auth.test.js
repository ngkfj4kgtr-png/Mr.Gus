import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateTelegramInitData } from '../src/telegram-auth.js';

const botToken='123456:TEST_TOKEN';
function makeInitData({authDate=Math.floor(Date.now()/1000),user={id:123456789,first_name:'Test',username:'tester'},extra={}}={}){
  const params=new URLSearchParams({auth_date:String(authDate),query_id:'AA-test',user:JSON.stringify(user),...extra});
  const data=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const secret=createHmac('sha256','WebAppData').update(botToken).digest();
  const hash=createHmac('sha256',secret).update(data).digest('hex');
  params.set('hash',hash);
  return params.toString();
}

test('Telegram init data accepts a valid signed payload',()=>{
  const now=1_700_000_000;
  const result=validateTelegramInitData(makeInitData({authDate:now-30}),botToken,{now,maxAgeSeconds:60});
  assert.equal(result.user.id,123456789);
  assert.equal(result.authDate,now-30);
  assert.equal(result.queryId,'AA-test');
});

test('Telegram init data rejects expired payloads',()=>{
  const now=1_700_000_000;
  assert.throws(()=>validateTelegramInitData(makeInitData({authDate:now-61}),botToken,{now,maxAgeSeconds:60}),/expired/);
});

test('Telegram init data rejects future timestamps',()=>{
  const now=1_700_000_000;
  assert.throws(()=>validateTelegramInitData(makeInitData({authDate:now+61}),botToken,{now,maxAgeSeconds:3600}),/future/);
});

test('Telegram init data rejects tampered signed fields',()=>{
  const now=1_700_000_000;
  const params=new URLSearchParams(makeInitData({authDate:now-10}));
  params.set('user',JSON.stringify({id:999999999,first_name:'Attacker'}));
  assert.throws(()=>validateTelegramInitData(params.toString(),botToken,{now,maxAgeSeconds:60}),/Invalid Telegram signature/);
});

test('Telegram init data rejects unsafe user ids',()=>{
  const now=1_700_000_000;
  assert.throws(()=>validateTelegramInitData(makeInitData({authDate:now-10,user:{id:0,first_name:'Bad'}}),botToken,{now,maxAgeSeconds:60}),/Invalid Telegram user id/);
});
