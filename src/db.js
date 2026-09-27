import { randomBytes } from 'node:crypto';
import { hashSessionToken } from './telegram-auth.js';
import { createPlayer, TASKS, ACHIEVEMENTS, GOALS, assertMoneyAmount } from './economy.js';
let pool; let Pool;

export async function initDb(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if(!Pool)({Pool}=await import('pg'));
  pool??=new Pool({connectionString:process.env.DATABASE_URL,max:10,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true,ca:process.env.PGSSL_CA||undefined}});
  return pool;
}
export async function getPool(){if(!pool)await initDb();return pool}
export async function migrate(){
  const p=await getPool();
  await p.query(`CREATE TABLE IF NOT EXISTS users(
    id BIGSERIAL PRIMARY KEY,telegram_id BIGINT NOT NULL UNIQUE,username TEXT,first_name TEXT NOT NULL DEFAULT '',last_name TEXT NOT NULL DEFAULT '',photo_url TEXT,
    balance BIGINT NOT NULL DEFAULT 0 CHECK(balance>=0),xp BIGINT NOT NULL DEFAULT 0 CHECK(xp>=0),level INTEGER NOT NULL DEFAULT 1 CHECK(level>=1),
    businesses JSONB NOT NULL DEFAULT '{}'::jsonb,claimed_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,claimed_achievements JSONB NOT NULL DEFAULT '[]'::jsonb,claimed_goals JSONB NOT NULL DEFAULT '[]'::jsonb,event_claims JSONB NOT NULL DEFAULT '{}'::jsonb,stats JSONB NOT NULL DEFAULT '{}'::jsonb,inventory JSONB NOT NULL DEFAULT '{}'::jsonb,active_bonuses JSONB NOT NULL DEFAULT '{}'::jsonb,last_income_at BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS sessions(
      id BIGSERIAL PRIMARY KEY,token_hash CHAR(64) NOT NULL UNIQUE,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS economy_operations(
      id BIGSERIAL PRIMARY KEY,operation_id TEXT NOT NULL,operation_type TEXT NOT NULL,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_amount BIGINT NOT NULL DEFAULT 0 CHECK(reward_amount>=0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,operation_id));
    CREATE INDEX IF NOT EXISTS economy_operations_user_created_idx ON economy_operations(user_id,created_at DESC);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_achievements JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active_bonuses JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_goals JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS event_claims JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '{}'::jsonb;`);
}
export async function upsertTelegramUser(tgUser){
  const r=await(await getPool()).query(`INSERT INTO users(telegram_id,username,first_name,last_name,photo_url) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,photo_url=EXCLUDED.photo_url,updated_at=NOW() RETURNING *`,
    [String(tgUser.id),tgUser.username??null,tgUser.first_name??'',tgUser.last_name??'',tgUser.photo_url??null]); return r.rows[0];
}
export async function createSession(userId,ttlSeconds=7*24*60*60){
  const p=await getPool(),client=await p.connect(),token=randomBytes(32).toString('base64url');
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[String(userId)]);
    await client.query('DELETE FROM sessions WHERE user_id=$1 OR expires_at<NOW()',[userId]);
    await client.query(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+($3*INTERVAL '1 second'))`,[hashSessionToken(token),userId,ttlSeconds]);
    await client.query('COMMIT');
    return token;
  }catch(e){
    await client.query('ROLLBACK');
    throw e;
  }finally{
    client.release();
  }
}
export async function cleanupExpiredSessions(){
  const r=await(await getPool()).query('DELETE FROM sessions WHERE expires_at<=NOW()');
  return r.rowCount;
}
export async function getUserBySession(token){
  if(!token)return null;
  const r=await(await getPool()).query(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hashSessionToken(token)]); return r.rows[0]||null;
}
export async function deleteSession(token){if(token)await(await getPool()).query('DELETE FROM sessions WHERE token_hash=$1',[hashSessionToken(token)])}
export function rowToPlayer(row){
  const p=createPlayer(String(row.telegram_id)); p.balance=Number(row.balance);p.xp=Number(row.xp);p.level=Number(row.level);p.businesses=Object.fromEntries(Object.entries(row.businesses||{}).map(([id,b])=>[id,{
  ...b,expansionLevel:Number.isSafeInteger(b?.expansionLevel)?b.expansionLevel:0,
  employees:b?.employees&&typeof b.employees==='object'&&!Array.isArray(b.employees)?b.employees:{},
  investment:Number.isSafeInteger(b?.investment)?b.investment:0,
  boostUntil:Number.isSafeInteger(b?.boostUntil)?b.boostUntil:0,
  boostMultiplier:typeof b?.boostMultiplier==='number'&&Number.isFinite(b.boostMultiplier)?b.boostMultiplier:1
}]));
  const validTaskIds=new Set(Object.keys(TASKS));p.claimedTasks=new Set((row.claimed_tasks||[]).filter(id=>validTaskIds.has(id)));
  const validAchievementIds=new Set(Object.keys(ACHIEVEMENTS));p.claimedAchievements=new Set((row.claimed_achievements||[]).filter(id=>validAchievementIds.has(id)));
  const validGoalIds=new Set(Object.keys(GOALS));p.claimedGoals=new Set((row.claimed_goals||[]).filter(id=>validGoalIds.has(id)));
  const rawEventClaims=row.event_claims||{};
  p.eventClaims={};
  if(rawEventClaims&&typeof rawEventClaims==='object'&&!Array.isArray(rawEventClaims)){
    for(const [dateKey,claimed] of Object.entries(rawEventClaims)){
      const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
      if(!m||claimed!==true)continue;
      const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
      const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
      if(year>=1970&&month>=1&&month<=12&&day>=1&&day<=daysInMonth)p.eventClaims[dateKey]=true;
    }
  }
  p.stats={...p.stats,...(row.stats||{})};
  p.inventory=row.inventory&&typeof row.inventory==='object'&&!Array.isArray(row.inventory)?row.inventory:{};
  p.activeBonuses=row.active_bonuses&&typeof row.active_bonuses==='object'&&!Array.isArray(row.active_bonuses)?row.active_bonuses:{};
  // Keep the derived ownership counter backward-compatible with players created before Stage 9.
  p.stats.businessesOwned=Object.keys(p.businesses).length;
  p.lastIncomeAt=row.last_income_at===null?null:Number(row.last_income_at);p.createdAt=row.created_at;return p;
}
export async function assertOperationNotProcessed(client,{operationId,userId}){
  const existing=await client.query(
    'SELECT operation_id,operation_type,reward_amount,created_at FROM economy_operations WHERE user_id=$1 AND operation_id=$2 FOR SHARE',
    [String(userId),operationId]
  );
  if(existing.rowCount){
    const err=new Error('Operation already processed');
    err.code='OPERATION_ALREADY_PROCESSED';
    err.operation=existing.rows[0];
    throw err;
  }
}

export async function recordOperation(client,{operationId,type,userId,reward=0,at=Date.now()}){
  const record=(await import('./operations.js')).operationRecord({operationId,type,userId,reward,at});
  const r=await client.query(`INSERT INTO economy_operations(operation_id,operation_type,user_id,reward_amount)
    VALUES($1,$2,$3,$4) ON CONFLICT(user_id,operation_id) DO NOTHING
    RETURNING id,operation_id,operation_type,user_id,reward_amount,created_at`,[record.operationId,record.type,record.userId,record.reward]);
  if(!r.rowCount){const existing=await client.query(`SELECT operation_id,operation_type,reward_amount,created_at FROM economy_operations WHERE user_id=$1 AND operation_id=$2`,[record.userId,record.operationId]);const err=new Error('Operation already processed');err.code='OPERATION_ALREADY_PROCESSED';err.operation=existing.rows[0]||null;throw err;}
  return r.rows[0];
}
export async function updatePlayer(userId,player,client){
  client??=await getPool();
  const r=await client.query(`UPDATE users SET balance=$1,xp=$2,level=$3,businesses=$4::jsonb,claimed_tasks=$5::jsonb,claimed_achievements=$6::jsonb,claimed_goals=$7::jsonb,event_claims=$8::jsonb,stats=$9::jsonb,inventory=$10::jsonb,active_bonuses=$11::jsonb,last_income_at=$12,updated_at=NOW() WHERE id=$11 RETURNING *`,
    [player.balance,player.xp,player.level,JSON.stringify(player.businesses),JSON.stringify([...player.claimedTasks]),JSON.stringify([...player.claimedAchievements]),JSON.stringify([...player.claimedGoals]),JSON.stringify(player.eventClaims),JSON.stringify(player.stats),JSON.stringify(player.inventory||{}),JSON.stringify(player.activeBonuses||{}),player.lastIncomeAt,userId]);
  if(!r.rowCount)throw new Error('User not found');return r.rows[0];
}
export async function withPlayerTransaction(userId,fn){
  const p=await getPool(),client=await p.connect();
  try{await client.query('BEGIN');const r=await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId]);if(!r.rowCount)throw new Error('User not found');
    const player=rowToPlayer(r.rows[0]);const result=await fn(player,client);assertMoneyAmount(player.balance,'Balance');await updatePlayer(userId,player,client);await client.query('COMMIT');return{result,player};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
