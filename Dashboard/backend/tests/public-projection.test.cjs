const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectDetection, projectMachine, projectSession, projectUser } = require('../src/services/publicProjection.ts');

const secretFields = {
  passwordHash: 'hash', apiKey: 'key', apiKeyHash: 'key-hash', token: 'raw-token',
  accessToken: 'access', refreshToken: 'refresh', rawTokenMaterial: 'raw',
};

function assertNoCredentials(value) {
  if (Array.isArray(value)) return value.forEach(assertNoCredentials);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, /password|apiKey|token/i, `credential field leaked: ${key}`);
    assertNoCredentials(child);
  }
}

test('machine response allows only dashboard fields at the root and in bin details', () => {
  const response = projectMachine({
    _id: 'machine-1', machineCode: 'M01', name: 'Main lobby', status: 'online', latitude: 10.7,
    ...secretFields,
    bins: [{ binType: 'pet', capacityPercent: 25, ...secretFields }],
  });
  assert.equal(response.machineCode, 'M01');
  assert.deepEqual(response.bins, [{ binType: 'pet', capacityPercent: 25 }]);
  assertNoCredentials(response);
});

test('session projections allowlist session, item, populated machine, and claimant data', () => {
  const response = projectSession({
    _id: 'session-1', sessionCode: 'S01', status: 'claimed', totalItems: 2, totalPoints: 20, ...secretFields,
    machineId: { _id: 'machine-1', machineCode: 'M01', name: 'Lobby', ...secretFields },
    claimedBy: { _id: 'user-1', displayName: 'Sam', avatar: 'avatar.png', phoneNumber: '0123456789', ...secretFields },
    items: [{ itemType: 'pet_clean', quantity: 2, pointsPerItem: 10, ...secretFields }],
  });
  assert.equal(response.machineId.machineCode, 'M01');
  assert.deepEqual(response.claimedBy, { _id: 'user-1', displayName: 'Sam', avatar: 'avatar.png' });
  assert.deepEqual(response.items, [{ itemType: 'pet_clean', quantity: 2, pointsPerItem: 10 }]);
  assertNoCredentials(response);
});

test('user lifetime output omits phone and credential fields while retaining public metrics', () => {
  const response = projectUser({
    _id: 'user-1', displayName: 'Sam', phoneNumber: '0123456789', totalPoints: 50,
    totals: { pet_clean: 2, pet_bad: 1, aluminum: 3, points: 50, ...secretFields }, ...secretFields,
  });
  assert.equal(response.totalPoints, 50);
  assert.deepEqual(response.totals, { pet_clean: 2, pet_bad: 1, aluminum: 3, points: 50 });
  assert.equal(response.phoneNumber, undefined);
  assertNoCredentials(response);
});

test('detection stream projection cannot expose new stored fields', () => {
  const response = projectDetection({ _id: 'd-1', machineCode: 'M01', detectedType: 'pet_clean', confidence: 0.9, ...secretFields });
  assert.equal(response.detectedType, 'pet_clean');
  assertNoCredentials(response);
});
