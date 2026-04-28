import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createApp } from './app.js';
import { makePackageFixture, makeRegistryFixture, removeRegistryFixture } from './test-utils.js';

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
    const response = await app.inject('/api/v1/skills?category=examples&sort=newest');

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

const multipartPayload = async (input: {
  filePath: string;
  filename: string;
  contentType: string;
  fields?: Record<string, string>;
}) => {
  const boundary = `----skill-market-test-${Date.now()}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(input.fields ?? {})) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${name}"\r\n\r\n`
      + `${value}\r\n`,
    ));
  }

  chunks.push(Buffer.from(
    `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="file"; filename="${input.filename}"\r\n`
    + `Content-Type: ${input.contentType}\r\n\r\n`,
  ));
  chunks.push(await readFile(input.filePath));
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

test('publisher can upload zip package and admin can approve it', async () => {
  const registryRoot = await makeRegistryFixture();
  const packageFixture = await makePackageFixture('zip', {
    id: 'alice/zip-skill',
    name: 'zip-skill',
    displayName: 'ZIP Skill',
  });
  const app = createApp({ registryRoot });

  try {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'alice@example.com',
        password: 'password123',
        displayName: 'Alice',
        publisher: 'alice',
      },
    });
    assert.equal(register.statusCode, 201);
    const token = register.json().token as string;
    assert.equal(register.json().user.roles.includes('admin'), true);

    const multipart = await multipartPayload({
      filePath: packageFixture.filePath,
      filename: packageFixture.filename,
      contentType: 'application/zip',
      fields: { releaseNotes: 'Initial zip release.' },
    });
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/publisher/submissions',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': multipart.contentType,
      },
      payload: multipart.payload,
    });
    assert.equal(upload.statusCode, 201);
    assert.equal(upload.json().submission.validation.valid, true);
    assert.equal(upload.json().submission.package.format, 'zip');

    const submissionId = upload.json().submission.id;
    const submit = await app.inject({
      method: 'POST',
      url: `/api/v1/publisher/submissions/${submissionId}/submit`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { changeNotes: 'Ready for review.' },
    });
    assert.equal(submit.statusCode, 200);
    assert.equal(submit.json().submission.status, 'pending_review');

    const reviews = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reviews',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(reviews.statusCode, 200, reviews.body);
    assert.equal(reviews.json().submissions.length, 1);

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reviews/${submissionId}/approve`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { reason: 'Looks good.' },
    });
    assert.equal(approve.statusCode, 200, approve.body);
    assert.equal(approve.json().submission.status, 'published');

    const detail = await app.inject('/api/v1/skills/alice/zip-skill');
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().latestVersion, '1.0.0');
    assert.equal(detail.json().versions[0].packageFormat, 'zip');

    const packageResponse = await app.inject('/api/v1/skills/alice/zip-skill/versions/1.0.0/package');
    assert.equal(packageResponse.statusCode, 200);
    assert.equal(packageResponse.headers['content-type'], 'application/zip');
    assert.equal(typeof packageResponse.headers['x-skill-sha256'], 'string');

    const feature = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/skills/alice/zip-skill/feature',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(feature.statusCode, 200, feature.body);
    const featured = await app.inject('/api/v1/featured-skills');
    assert.equal(featured.json().skills[0].id, 'alice/zip-skill');

    const remove = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/skills/alice/zip-skill/versions/1.0.0/remove',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { reason: 'Temporary removal.' },
    });
    assert.equal(remove.statusCode, 200, remove.body);
    const removedDetail = await app.inject('/api/v1/skills/alice/zip-skill');
    assert.equal(removedDetail.statusCode, 404);

    const restore = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/skills/alice/zip-skill/versions/1.0.0/restore',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(restore.statusCode, 200, restore.body);
    const restoredDetail = await app.inject('/api/v1/skills/alice/zip-skill');
    assert.equal(restoredDetail.statusCode, 200);
  } finally {
    await removeRegistryFixture(registryRoot);
    await removeRegistryFixture(packageFixture.root);
  }
});
