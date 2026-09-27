import { getPool } from './db.js';

const ADMIN_IDS=()=>new Set(String(process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));

export function isAdminTelegramId(id){return ADMIN_IDS().has(String(id));}

export async function ensureSocialTables(){
  const p=await getPool();
  await p.query(`CREATE TABLE IF NOT EXISTS audit_logs(
    id BIGSERIAL PRIMARY KEY,user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    telegram_id TEXT,action TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
    CREATE TABLE IF NOT EXISTS error_logs(
    id BIGSERIAL PRIMARY KEY,user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    path TEXT,severity TEXT NOT NULL DEFAULT 'error',message TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS error_logs_created_idx ON error_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS error_logs_path_idx ON error_logs(path);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;`);
}

export async function writeAudit({userId=null,telegramId=null,action,details={}}){
  try{await (await getPool()).query('INSERT INTO audit_logs(user_id,telegram_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[userId,telegramId?String(telegramId):null,String(action),JSON.stringify(details)]);}catch{}
}
export async function writeError({userId=null,path='',message,severity='error',details={}}){
  try{await (await getPool()).query('INSERT INTO error_logs(user_id,path,message,severity,details) VALUES($1,$2,$3,$4,$5::jsonb)',[userId,path,String(message),severity,JSON.stringify(details)]);}catch{}
}

const rowName=r=>[r.first_name,r.last_name].filter(Boolean).join(' ')||r.username||String(r.telegram_id);
function playerRow(r){
  const businesses=r.businesses&&typeof r.businesses==='object'&&!Array.isArray(r.businesses)?r.businesses:{};
  const stats=r.stats||{};
  const achievements=Array.isArray(r.claimed_achievements)?r.claimed_achievements:[];
  return {id:String(r.telegram_id),name:rowName(r),username:r.username||null,photoUrl:r.photo_url||null,level:Number(r.level),xp:Number(r.xp),balance:Number(r.balance),businesses:Object.keys(businesses).length,achievements:achievements.length,stats,createdAt:r.created_at};
}
function sortRows(rows,key){return rows.sort((a,b)=>Number(b[key]||0)-Number(a[key]||0)||String(a.name).localeCompare(String(b.name)));}
export async function getRankings(limit=50,currentTelegramId=null){
  const p=await getPool(),safe=Math.max(1,Math.min(100,Number(limit)||50));
  const users=(await p.query('SELECT id,telegram_id,username,first_name,last_name,photo_url,balance,xp,level,businesses,claimed_achievements,stats,created_at FROM users WHERE blocked=false')).rows.map(playerRow);
  const addPositions=(rows,key)=>rows.map((r,i)=>({...r,position:i+1,isMe:String(r.id)===String(currentTelegramId)}));
  const trimWithMe=(rows)=>{const ranked=addPositions(rows);const top=ranked.slice(0,safe);const me=ranked.find(r=>r.isMe);return me&&!top.some(r=>r.isMe)?[...top,me]:top;};
  const overall=sortRows(users.map(r=>({...r,score:r.level*1000000+r.balance+r.achievements*10000+r.businesses*5000})), 'score');
  const level=sortRows([...users], 'level');
  const capital=sortRows([...users], 'balance');
  const businesses=sortRows([...users], 'businesses');
  const achievements=sortRows([...users], 'achievements');
  const weekly=(await p.query(`SELECT u.telegram_id,u.username,u.first_name,u.last_name,u.photo_url,COALESCE(SUM(o.reward_amount),0)::bigint AS points,COUNT(o.id)::bigint AS operations
    FROM users u LEFT JOIN economy_operations o ON o.user_id=u.id AND o.created_at>=date_trunc('week',NOW())
    WHERE u.blocked=false GROUP BY u.id ORDER BY points DESC,operations DESC,u.id ASC`)).rows.map(r=>({...playerRow({...r,balance:0,xp:0,level:0,businesses:{},claimed_achievements:[],stats:{},created_at:null}),points:Number(r.points),operations:Number(r.operations)}));
  const season=(await p.query(`SELECT u.telegram_id,u.username,u.first_name,u.last_name,u.photo_url,COALESCE(SUM(o.reward_amount),0)::bigint AS points,COUNT(o.id)::bigint AS operations
    FROM users u LEFT JOIN economy_operations o ON o.user_id=u.id AND o.created_at>=date_trunc('month',NOW())
    WHERE u.blocked=false GROUP BY u.id ORDER BY points DESC,operations DESC,u.id ASC`)).rows.map(r=>({...playerRow({...r,balance:0,xp:0,level:0,businesses:{},claimed_achievements:[],stats:{},created_at:null}),points:Number(r.points),operations:Number(r.operations)}));
  return {overall:trimWithMe(overall),level:trimWithMe(level),capital:trimWithMe(capital),businesses:trimWithMe(businesses),achievements:trimWithMe(achievements),weekly:trimWithMe(weekly),season:trimWithMe(season),seasonKey:new Date().toISOString().slice(0,7)};
}
export async function getProfile(telegramId){
  const r=(await (await getPool()).query('SELECT * FROM users WHERE telegram_id=$1 AND blocked=false',[String(telegramId)])).rows[0];
  if(!r)return null;
  const p=playerRow(r),businesses=r.businesses||{};
  const xpCurrent=typeof p.xp==='number'?p.xp:0;
  const xpNext=Math.max(xpCurrent+1,Math.floor(xpCurrent/1000+1)*1000);
  return {...p,telegramId:p.id,ownedBusinesses:Object.entries(businesses).map(([id,b])=>({id,level:b.level,expansionLevel:b.expansionLevel||0,investment:b.investment||0,employees:b.employees||{},profitPerHour:Number(b.profitPerHour)||0})),daily:{streak:Number(r.daily_state?.streak)||0,lastClaimDate:r.daily_state?.lastClaimDate||null},progress:{xp:xpCurrent,level:p.level,current:xpCurrent,next:xpNext,percent:Math.min(100,Math.max(0,Math.round(((xpCurrent-(xpNext-1000))/1000)*100)))},stats:{...p.stats}};
}
export async function searchAdminUsers(query='',limit=100){
  const q=String(query||'').trim().slice(0,100);
  const p=await getPool();
  const r=await p.query(`SELECT id,telegram_id,username,first_name,last_name,photo_url,balance,xp,level,businesses,claimed_achievements,stats,blocked,created_at,updated_at
    FROM users
    WHERE ($1='' OR telegram_id::text ILIKE '%'||$1||'%' OR username ILIKE '%'||$1||'%' OR first_name ILIKE '%'||$1||'%' OR last_name ILIKE '%'||$1||'%')
    ORDER BY created_at DESC LIMIT $2`,[q,Math.max(1,Math.min(100,Number(limit)||100))]);
  return r.rows.map(row=>({...playerRow(row),dbId:String(row.id),blocked:!!row.blocked,updatedAt:row.updated_at}));
}

export async function getAdminSnapshot(){
  const p=await getPool();
  const users=(await p.query(`SELECT id,telegram_id,username,first_name,last_name,photo_url,balance,xp,level,businesses,claimed_achievements,stats,blocked,created_at,updated_at FROM users ORDER BY created_at DESC LIMIT 200`)).rows.map(r=>({...playerRow(r),dbId:String(r.id),blocked:!!r.blocked,updatedAt:r.updated_at}));
  const operations=(await p.query(`SELECT o.operation_id,o.operation_type,o.reward_amount,o.created_at,u.telegram_id,u.username FROM economy_operations o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 200`)).rows;
  const audits=(await p.query('SELECT id,telegram_id,action,details,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200')).rows;
  const errors=(await p.query('SELECT id,path,severity,message,details,created_at FROM error_logs ORDER BY created_at DESC LIMIT 200')).rows;
  return {users,operations,audits,errors,metrics:{users:users.length,operations:operations.length,errors:errors.length}};
}
export async function setBlocked(userId,blocked){
  const r=await (await getPool()).query('UPDATE users SET blocked=$1,updated_at=NOW() WHERE id=$2 RETURNING telegram_id',[!!blocked,userId]);
  return r.rows[0]||null;
}
