import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from './app.js';
import { makeRegistryFixture, removeRegistryFixture } from './test-utils.js';

test('GET /health returns ok', async () => {
  const app = createApp();
  const response = await app.inject('/health');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

test('GET /api/v1/skills returns registry summaries', async () => {
  const registryRoot = await makeRegistryFixture();
  const app = createApp({ registryRoot });
  try {
    const response = await app.inject('/api/v1/skills');

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().skills[0].id, 'official/hello');
  } finally {
    await removeRegistryFixture(registryRoot);
  }
});

test('GET detail, versions, manifest, and package endpoints', async () => {
  const registryRoot = await makeRegistryFixture();
  const app = createApp({ registryRoot });
  try {
    const detail = await app.inject('/api/v1/skills/official/hello');
    const versions = await app.inject('/api/v1/skills/official/hello/versions');
    const manifest = await app.inject('/api/v1/skills/official/hello/versions/1.0.0/manifest');
    const packageResponse = await app.inject('/api/v1/skills/official/hello/versions/1.0.0/package');

    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().latestVersion, '1.0.0');
    assert.equal(versions.statusCode, 200);
    assert.equal(versions.json().versions[0].version, '1.0.0');
    assert.equal(manifest.statusCode, 200);
    assert.equal(manifest.json().id, 'official/hello');
    assert.equal(packageResponse.statusCode, 200);
    assert.equal(packageResponse.headers['content-type'], 'application/gzip');
    assert.equal(packageResponse.body, 'fixture package');
  } finally {
    await removeRegistryFixture(registryRoot);
  }
});
