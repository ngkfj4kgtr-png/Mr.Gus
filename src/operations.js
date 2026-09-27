import { randomUUID } from 'node:crypto';

export const OPERATION_TYPES = Object.freeze({
  TASK_REWARD: 'task_reward',
  BUSINESS_PURCHASE: 'business_purchase',
  BUSINESS_UPGRADE: 'business_upgrade',
  EMPLOYEE_HIRE: 'employee_hire',
  BUSINESS_EXPANSION: 'business_expansion',
  BUSINESS_INVESTMENT: 'business_investment',
  BUSINESS_BOOST: 'business_boost',
  SHOP_PURCHASE: 'shop_purchase',
  INCOME_COLLECTION: 'income_collection',
  ACHIEVEMENT_REWARD: 'achievement_reward',
  GOAL_REWARD: 'goal_reward',
  EVENT_REWARD: 'event_reward'
});

export function createOperationId(prefix='op') {
  if (!/^[a-z][a-z0-9_]{1,31}$/i.test(prefix)) throw new Error('Invalid operation prefix');
  return `${prefix}_${randomUUID()}`;
}

export function validateOperationId(operationId) {
  if (typeof operationId !== 'string' || operationId.length < 8 || operationId.length > 100) throw new Error('Invalid operation ID');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(operationId)) throw new Error('Invalid operation ID');
  return operationId;
}

export function operationRecord({operationId,type,userId,reward=0,at=Date.now()}) {
  validateOperationId(operationId);
  if (!Object.values(OPERATION_TYPES).includes(type)) throw new Error('Invalid operation type');
  if (userId === undefined || userId === null || String(userId).length === 0) throw new Error('Invalid operation user');
  if (!Number.isSafeInteger(reward) || reward < 0) throw new Error('Invalid operation reward');
  if (!Number.isSafeInteger(at) || at < 0) throw new Error('Invalid operation time');
  return {operationId,type,userId:String(userId),reward,at};
}
