import { createHmac, timingSafeEqual } from 'node:crypto';

// Draft commercial policy. No production endpoint imports this module yet.
export const PLAN_POLICY = Object.freeze({
  free: Object.freeze({ monthlyUsd: 0, storageBytes: 0, renderSeconds: 0, socialAccounts: 0 }),
  pro: Object.freeze({
    monthlyUsd: 5.99,
    storageBytes: 5_000_000_000,
    renderSeconds: 1800,
    socialAccounts: 0,
  }),
  plus: Object.freeze({
    monthlyUsd: 11.99,
    storageBytes: 20_000_000_000,
    renderSeconds: 5400,
    socialAccounts: 3,
  }),
});

export function verifyWebhook(rawBody, signature, secret) {
  if (typeof secret !== 'string' || secret.length < 16 || !/^[a-f0-9]{64}$/i.test(signature || ''))
    return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

// Only pass a provider subscription retrieved server-side after verifying its webhook.
// variantToPlan and subscription owner must come from trusted server storage.
export function resolveEntitlement(subscription, variantToPlan, now = Date.now()) {
  const a = subscription?.attributes;
  if (!a || a.test_mode !== false) return 'free';
  const plan = Object.hasOwn(variantToPlan, String(a.variant_id))
    ? variantToPlan[String(a.variant_id)]
    : 'free';
  if (!['pro', 'plus'].includes(plan)) return 'free';
  if (
    a.status === 'active' &&
    Number.isFinite(Date.parse(a.renews_at)) &&
    Date.parse(a.renews_at) > now
  )
    return plan;
  if (
    a.status === 'cancelled' &&
    Number.isFinite(Date.parse(a.ends_at)) &&
    Date.parse(a.ends_at) > now
  )
    return plan;
  return 'free';
}

export function canReserve(plan, used, amount, resource) {
  const policy = PLAN_POLICY[plan];
  if (!policy || !['storageBytes', 'renderSeconds', 'socialAccounts'].includes(resource))
    return false;
  return (
    Number.isSafeInteger(used) &&
    Number.isSafeInteger(amount) &&
    used >= 0 &&
    amount > 0 &&
    used + amount <= policy[resource]
  );
}

export function estimateContribution({ price, rate = 0.07, fixedFee = 0.5, variableCost = 1 }) {
  if (
    ![price, rate, fixedFee, variableCost].every(Number.isFinite) ||
    price < 0 ||
    rate < 0 ||
    rate > 1 ||
    fixedFee < 0 ||
    variableCost < 0
  )
    throw new RangeError('Invalid cost assumptions');
  const fee = price * rate + fixedFee;
  return {
    revenue: price,
    fee,
    afterPayment: price - fee,
    contribution: price - fee - variableCost,
  };
}
