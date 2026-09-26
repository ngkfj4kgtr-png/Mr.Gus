import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTelegramInitData } from './src/telegram-auth.js';
import { initDb,migrate,upsertTelegramUser,createSession,getUserBySession,deleteSession,withPlayerTransaction,recordOperation } from './src/db.js';
import { validateOperationId, OPERATION_TYPES } from './src/operations.js';
import { createPlayer,claimTask,buyBusiness,upgradeBusiness,collectOfflineIncome,hourlyProfit,availableTasks } from './src/economy.js';

const root=join(fileURLToPath(new URL('.',import.meta.url)),'public');
const port=Number(process.env.PORT||3000),botToken=process.env.TELEGRAM_BOT_TOKEN,demoMode=process.env.DEMO_MODE==='true';
if(!botToken&&!demoMode)throw new Error('TELEGRAM_BOT_TOKEN is required');
if(!process.env.DATABASE_URL&&!demoMode)throw new Error('DATABASE_URL is required');
if(!demoMode){await initDb();await migrate();}
const demoPlayers=new Map(),demoOperations=new Set();
const cookieOptions=()=>`Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV==='production'?'; Secure':''}`;
function parseCookies(header=''){const out={};for(const part of header.split(';')){const i=part.indexOf('=');if(i<0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();try{out[k]=decodeURIComponent(v)}catch{}}return out}
function sendJson(res,status,payload,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(payload))}
async function readJson(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)throw new Error('Payload too large')}if(!body)return{};const value=JSON.parse(body);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid JSON body');return value}
function serialize(player,user){return{id:String(user?.telegram_id??player.id),name:[user?.first_name,user?.last_name].filter(Boolean).join(' ')||'Игрок',username:user?.username??null,photoUrl:user?.photo_url??null,balance:player.balance,xp:player.xp,level:player.level,businesses:Object.values(player.businesses).map(b=>({...b,profitPerHour:hourlyProfit(player,b.id)})),claimedTasks:[...player.claimedTasks],tasks:availableTasks(player)}}
async function auth(req,res){const cookies=parseCookies(req.headers.cookie);if(demoMode&&cookies.mfz_demo==='1'){const player=demoPlayers.get('demo-user')||createPlayer('demo-user');demoPlayers.set('demo-user',player);return{user:{id:'demo-user',telegram_id:'demo-user',first_name:'Демо',last_name:'Игрок',username:'demo'},player,demo:true}}const user=await getUserBySession(cookies.mfz_session);if(!user){sendJson(res,401,{error:'Authentication required'});return null}return{user,sessionToken:cookies.mfz_session}}
function errorStatus(message){if(message==='Operation already processed')return 409;if(/authentication|required|invalid|expired|already|insufficient|maximum|clock|task|business|locked|overflow|payload/i.test(message))return 400;return 500}

const server=http.createServer(async(req,res)=>{try{
const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
if(req.method==='POST'&&url.pathname==='/api/auth/telegram'){
if(demoMode&&!req.headers['x-telegram-init-data']){res.setHeader('Set-Cookie',`mfz_demo=1; ${cookieOptions()}; Max-Age=604800`);return sendJson(res,200,{ok:true,demo:true,user:{first_name:'Демо',last_name:'Игрок',username:'demo'}})}
const verified=validateTelegramInitData(String(req.headers['x-telegram-init-data']||''),botToken),user=await upsertTelegramUser(verified.user),token=await createSession(user.id);
res.setHeader('Set-Cookie',`mfz_session=${encodeURIComponent(token)}; ${cookieOptions()}; Max-Age=604800`);return sendJson(res,200,{ok:true,user:{id:String(user.telegram_id),firstName:user.first_name,lastName:user.last_name,username:user.username,photoUrl:user.photo_url}});
}
if(req.method==='POST'&&url.pathname==='/api/auth/logout'){const c=parseCookies(req.headers.cookie);if(!demoMode)await deleteSession(c.mfz_session);else demoPlayers.delete('demo-user');res.setHeader('Set-Cookie',[`mfz_session=; ${cookieOptions()}; Max-Age=0`,`mfz_demo=; ${cookieOptions()}; Max-Age=0`]);return sendJson(res,200,{ok:true})}
if(url.pathname.startsWith('/api/')){
const a=await auth(req,res);if(!a)return;
if(a.demo){const player=a.player;if(req.method==='GET'&&url.pathname==='/api/state'){collectOfflineIncome(player,Date.now());return sendJson(res,200,serialize(player,a.user))}
if(req.method==='POST'){const body=await readJson(req),operationId=String(body.operationId||'');validateOperationId(operationId);if(demoOperations.has(`demo-user:${operationId}`))throw new Error('Operation already processed');let action;
if(url.pathname==='/api/task/claim')action=claimTask(player,String(body.taskId||''));else if(url.pathname==='/api/business/buy')action=buyBusiness(player,String(body.businessId||''),Date.now());else if(url.pathname==='/api/business/upgrade')action=upgradeBusiness(player,String(body.businessId||''),Date.now());else if(url.pathname==='/api/income/collect')action=collectOfflineIncome(player,Date.now());else return sendJson(res,404,{error:'Endpoint not found'});
demoOperations.add(`demo-user:${operationId}`);demoPlayers.set('demo-user',player);return sendJson(res,200,{...serialize(player,a.user),action})}return sendJson(res,405,{error:'Method not allowed'})}
if(req.method==='GET'&&url.pathname==='/api/state'){const tx=await withPlayerTransaction(a.user.id,async(player,client)=>{const from=player.lastIncomeAt,now=Date.now(),out=collectOfflineIncome(player,now);if(out.seconds>0&&from!==null){const operationId=`income_auto_${from}_${player.lastIncomeAt}`;await recordOperation(client,{operationId,type:OPERATION_TYPES.INCOME_COLLECTION,userId:a.user.id,reward:out.income,at:now})}return out});return sendJson(res,200,{...serialize(tx.player,a.user),action:tx.result})}
if(req.method==='POST'){const body=await readJson(req),operationId=String(body.operationId||'');validateOperationId(operationId);let out;const tx=await withPlayerTransaction(a.user.id,async(player,client)=>{
const now=Date.now();
if(url.pathname==='/api/task/claim')out=claimTask(player,String(body.taskId||''));
else if(url.pathname==='/api/business/buy'){
  const before=player.lastIncomeAt; const income=collectOfflineIncome(player,now);
  if(income.income>0&&before!==null) await recordOperation(client,{operationId:`income_auto_${before}_${player.lastIncomeAt}`,type:OPERATION_TYPES.INCOME_COLLECTION,userId:a.user.id,reward:income.income,at:now});
  out=buyBusiness(player,String(body.businessId||''),now);
}
else if(url.pathname==='/api/business/upgrade'){
  const before=player.lastIncomeAt; const income=collectOfflineIncome(player,now);
  if(income.income>0&&before!==null) await recordOperation(client,{operationId:`income_auto_${before}_${player.lastIncomeAt}`,type:OPERATION_TYPES.INCOME_COLLECTION,userId:a.user.id,reward:income.income,at:now});
  out=upgradeBusiness(player,String(body.businessId||''),now);
}
else if(url.pathname==='/api/income/collect')out=collectOfflineIncome(player,now);
else throw new Error('Endpoint not found');
const type=url.pathname==='/api/task/claim'?OPERATION_TYPES.TASK_REWARD:url.pathname==='/api/business/buy'?OPERATION_TYPES.BUSINESS_PURCHASE:url.pathname==='/api/business/upgrade'?OPERATION_TYPES.BUSINESS_UPGRADE:OPERATION_TYPES.INCOME_COLLECTION;
const reward=Number(out?.reward??out?.income??0);await recordOperation(client,{operationId,type,userId:a.user.id,reward});return out});
return sendJson(res,200,{...serialize(tx.player,a.user),action:out})}
return sendJson(res,405,{error:'Method not allowed'})}
const requested=url.pathname==='/'?'/index.html':url.pathname,safe=normalize(requested).replace(/^\.\.(\/|\\)+/,'');const file=join(root,safe),data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch(e){const msg=e?.message||'Server error';if(req.url?.startsWith('/api/'))return sendJson(res,errorStatus(msg),{error:msg});res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Server error')}});
server.listen(port,'0.0.0.0',()=>console.log(`Mr.Gus — stages 1–6: http://localhost:${port}`));