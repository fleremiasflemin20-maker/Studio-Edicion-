import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhook, resolveEntitlement, canReserve, estimateContribution } from './billing.mjs';

test('billing rejects forged and tampered webhook payloads', () => {
  const secret = 'test-only-signing-secret',
    body = '{"data":{"id":"1"}}';
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyWebhook(body, signature, secret), true);
  assert.equal(verifyWebhook(body + ' ', signature, secret), false);
  assert.equal(verifyWebhook(body, '00', secret), false);
  assert.equal(verifyWebhook(body, signature, ''), false);
});
test('entitlements fail closed for test payments, unknown variants and unpaid states', () => {
  const now = Date.parse('2026-10-26T00:00:00Z');
  const attributes = {
    variant_id: 10,
    status: 'active',
    test_mode: false,
    renews_at: '2026-11-26T00:00:00Z',
  };
  const resolve = (changes = {}) =>
    resolveEntitlement({ attributes: { ...attributes, ...changes } }, { 10: 'pro' }, now);
  assert.equal(resolve(), 'pro');
  for (const status of ['past_due', 'unpaid', 'expired', 'paused', 'on_trial'])
    assert.equal(resolve({ status }), 'free');
  assert.equal(resolve({ test_mode: true }), 'free');
  assert.equal(resolve({ variant_id: 11 }), 'free');
  assert.equal(resolve({ renews_at: 'bad' }), 'free');
  assert.equal(resolve({ renews_at: '2026-10-01' }), 'free');
  assert.equal(resolve({ status: 'cancelled', ends_at: '2026-11-01' }), 'pro');
  assert.equal(resolve({ status: 'cancelled', ends_at: '2026-10-01' }), 'free');
});
test('quota reservation rejects overages and invalid amounts', () => {
  assert.equal(canReserve('pro', 1700, 100, 'renderSeconds'), true);
  assert.equal(canReserve('pro', 1700, 101, 'renderSeconds'), false);
  assert.equal(canReserve('free', 0, 1, 'renderSeconds'), false);
  assert.equal(canReserve('pro', 0, -1, 'storageBytes'), false);
  assert.equal(canReserve('pro', 0, 1, 'unknown'), false);
});
test('contribution estimate separates fees and variable costs', () => {
  const e = estimateContribution({ price: 5.99, variableCost: 1 });
  assert.ok(Math.abs(e.contribution - 4.0707) < 1e-9);
  assert.throws(() => estimateContribution({ price: -1 }), RangeError);
});
