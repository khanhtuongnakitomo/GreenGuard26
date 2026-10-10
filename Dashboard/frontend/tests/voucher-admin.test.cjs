const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { VoucherApiError, normalizeExpiryDate, voucherAdminApi } = require('../src/services/voucherAdmin.ts');
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });

test('expiry is optional and normalized to the end of the selected UTC day', () => {
  assert.equal(normalizeExpiryDate(''), undefined);
  assert.equal(normalizeExpiryDate('2026-10-31'), '2026-10-31T23:59:59.000Z');
  assert.throws(() => normalizeExpiryDate('2026-02-31'), /valid expiry date/);
  assert.throws(() => normalizeExpiryDate('10/31/2026'), /YYYY-MM-DD/);
});

test('voucher upload sends one raw image with its media type and encoded filename', async () => {
  const originalFormData = global.FormData;
  try {
    let captured;
    global.fetch = async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ id: 'code-1', format: 'Code128', availableCount: 1 }) };
    };
    const image = new File([new Uint8Array([1, 2, 3])], 'barcode one.png', { type: 'image/png' });
    const result = await voucherAdminApi.uploadBarcode('admin-token', 'reward/1', image);
    assert.equal(captured.url.endsWith('/admin/rewards/reward%2F1/barcodes'), true);
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers['Content-Type'], 'image/png');
    assert.equal(captured.init.headers['X-Filename'], 'barcode%20one.png');
    assert.equal(captured.init.body, image);
    assert.deepEqual(result, { id: 'code-1', format: 'Code128', availableCount: 1 });
  } finally { global.FormData = originalFormData; }
});

test('invalid barcode files are rejected before network upload', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('should not be called'); };
  await assert.rejects(voucherAdminApi.uploadBarcode('token', 'reward', new File(['x'], 'code.gif', { type: 'image/gif' })), /Only PNG and JPEG/);
  await assert.rejects(voucherAdminApi.uploadBarcode('token', 'reward', new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })), /2 MiB or smaller/);
  assert.equal(calls, 0);
});

test('duplicate response preserves the backend reason and does not mask it as a success', async () => {
  global.fetch = async () => ({ ok: false, status: 409, json: async () => ({ message: 'Barcode already exists in stock.' }) });
  await assert.rejects(voucherAdminApi.uploadBarcode('token', 'reward', new File(['x'], 'code.jpg', { type: 'image/jpeg' })), error => {
    assert.ok(error instanceof VoucherApiError);
    assert.equal(error.status, 409);
    assert.equal(error.message, 'Barcode already exists in stock.');
    return true;
  });
});

test('new rewards preserve the selected catalog status', async () => {
  let captured;
  global.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return { ok: true, status: 201, json: async () => ({ _id: 'reward-1', name: 'Lunch', status: 'inactive' }) };
  };
  await voucherAdminApi.createReward('token', {
    partnerId: 'partner-1', name: 'Lunch', description: '', rewardType: 'meal_voucher', pointsRequired: 100,
    terms: [], deliveryType: 'barcode', status: 'inactive',
  });
  assert.equal(captured.status, 'inactive');
  assert.equal(captured.deliveryType, 'barcode');
});
