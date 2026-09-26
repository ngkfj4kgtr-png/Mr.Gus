import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function validateTelegramInitData(initData,botToken,{maxAgeSeconds=86400,now=Math.floor(Date.now()/1000)}={}) {
  if(typeof initData!=='string'||!initData) throw new Error('Telegram initData is required');
  if(typeof botToken!=='string'||!botToken) throw new Error('Telegram bot token is not configured');
  const params=new URLSearchParams(initData),receivedHash=params.get('hash');
  if(!receivedHash||!/^[a-f0-9]{64}$/i.test(receivedHash)) throw new Error('Invalid Telegram signature');
  const authDate=Number(params.get('auth_date'));
  if(!Number.isInteger(authDate)||authDate<=0) throw new Error('Invalid Telegram auth_date');
  if(authDate>now+60) throw new Error('Telegram auth_date is in the future');
  if(now-authDate>maxAgeSeconds) throw new Error('Telegram auth data expired');
  const dataCheckString=[...params.entries()].filter(([key])=>key!=='hash').sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('\\n');
  const secretKey=createHmac('sha256','WebAppData').update(botToken).digest();
  const calculated=createHmac('sha256',secretKey).update(dataCheckString).digest('hex');
  const a=Buffer.from(calculated,'hex'),b=Buffer.from(receivedHash,'hex');
  if(a.length!==b.length||!timingSafeEqual(a,b)) throw new Error('Invalid Telegram signature');
  const rawUser=params.get('user'); if(!rawUser) throw new Error('Telegram user is missing');
  let user; try{user=JSON.parse(rawUser)}catch{throw new Error('Invalid Telegram user payload')}
  if(!user||!Number.isSafeInteger(Number(user.id))||Number(user.id)<=0) throw new Error('Invalid Telegram user id');
  return {user,authDate,queryId:params.get('query_id')||null};
}
export function hashSessionToken(token){return createHash('sha256').update(token).digest('hex')}
