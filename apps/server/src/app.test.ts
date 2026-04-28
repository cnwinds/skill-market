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

test('publisher can edit a skill, create a dev release, and download it with a developer key', async () => {
  const registryRoot = await makeRegistryFixture();
  const packageFixture = await makePackageFixture('tgz', {
    id: 'alice/edit-skill',
    name: 'edit-skill',
    displayName: 'Editable Skill',
  });
  const app = createApp({ registryRoot });

  try {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'alice-editor@example.com',
        password: 'password123',
        displayName: 'Alice Editor',
        publisher: 'alice',
      },
    });
    assert.equal(register.statusCode, 201);
    const token = register.json().token as string;

    const multipart = await multipartPayload({
      filePath: packageFixture.filePath,
      filename: packageFixture.filename,
      contentType: 'application/gzip',
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
    assert.equal(upload.statusCode, 201, upload.body);
    const submissionId = upload.json().submission.id;

    const submit = await app.inject({
      method: 'POST',
      url: `/api/v1/publisher/submissions/${submissionId}/submit`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {},
    });
    assert.equal(submit.statusCode, 200, submit.body);

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reviews/${submissionId}/approve`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { reason: 'Initial release.' },
    });
    assert.equal(approve.statusCode, 200, approve.body);

    const createWorkspace = await app.inject({
      method: 'POST',
      url: '/api/v1/publisher/skills/alice/edit-skill/edit-workspaces',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { sourceVersion: '1.0.0' },
    });
    assert.equal(createWorkspace.statusCode, 201, createWorkspace.body);
    const workspace = createWorkspace.json().workspace;
    assert.equal(workspace.targetVersion, '1.0.1');

    const fileList = await app.inject({
      method: 'GET',
      url: `/api/v1/publisher/edit-workspaces/${workspace.id}/files`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(fileList.statusCode, 200, fileList.body);
    assert.equal(fileList.json().entries.some((entry: { path: string }) => entry.path === 'SKILL.md'), true);

    const manifestFile = await app.inject({
      method: 'GET',
      url: `/api/v1/publisher/edit-workspaces/${workspace.id}/files/content?path=skill.json`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(manifestFile.statusCode, 200, manifestFile.body);
    assert.equal(JSON.parse(manifestFile.json().content).version, '1.0.1');

    const editReadme = await app.inject({
      method: 'PUT',
      url: `/api/v1/publisher/edit-workspaces/${workspace.id}/files/content`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {
        path: 'SKILL.md',
        content: '# Editable Skill\n\nDevelopment content.\n',
        baseRevision: workspace.revision,
      },
    });
    assert.equal(editReadme.statusCode, 200, editReadme.body);
    assert.equal(editReadme.json().workspace.revision, workspace.revision + 1);

    const validate = await app.inject({
      method: 'POST',
      url: `/api/v1/publisher/edit-workspaces/${workspace.id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(validate.statusCode, 200, validate.body);
    assert.equal(validate.json().validation.valid, true);

    const createKey = await app.inject({
      method: 'POST',
      url: '/api/v1/publisher/dev-keys',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {
        name: 'Local SkillChat',
        skillId: 'alice/edit-skill',
      },
    });
    assert.equal(createKey.statusCode, 201, createKey.body);
    const developerKey = createKey.json().developerKey;
    assert.match(developerKey.secret, /^skdev_/);

    const listKeys = await app.inject({
      method: 'GET',
      url: '/api/v1/publisher/dev-keys?skillId=alice/edit-skill',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(listKeys.statusCode, 200, listKeys.body);
    assert.equal(listKeys.json().developerKeys[0].secret, developerKey.secret);

    const createDev = await app.inject({
      method: 'POST',
      url: `/api/v1/publisher/edit-workspaces/${workspace.id}/dev-releases`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {},
    });
    assert.equal(createDev.statusCode, 201, createDev.body);
    assert.equal(createDev.json().devRelease.version, '1.0.1');

    const devManifestNoKey = await app.inject('/api/v1/dev/skills/alice/edit-skill/versions/dev/manifest');
    assert.equal(devManifestNoKey.statusCode, 401);

    const devManifest = await app.inject({
      method: 'GET',
      url: '/api/v1/dev/skills/alice/edit-skill/versions/dev/manifest',
      headers: { 'x-skill-dev-key': developerKey.secret },
    });
    assert.equal(devManifest.statusCode, 200, devManifest.body);
    assert.equal(devManifest.json().id, 'alice/edit-skill');
    assert.equal(devManifest.json().version, '1.0.1');

    const devPackage = await app.inject({
      method: 'GET',
      url: '/api/v1/dev/skills/alice/edit-skill/versions/dev/package',
      headers: { 'x-skill-dev-key': developerKey.secret },
    });
    assert.equal(devPackage.statusCode, 200, devPackage.body);
    assert.equal(devPackage.headers['x-skill-channel'], 'dev');
    assert.equal(devPackage.headers['x-skill-version'], '1.0.1');

    const publicVersions = await app.inject('/api/v1/skills/alice/edit-skill/versions');
    assert.equal(publicVersions.statusCode, 200, publicVersions.body);
    assert.deepEqual(
      publicVersions.json().versions.map((version: { version: string }) => version.version),
      ['1.0.0'],
    );

    const revokeKey = await app.inject({
      method: 'POST',
      url: `/api/v1/publisher/dev-keys/${developerKey.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(revokeKey.statusCode, 200, revokeKey.body);

    const revokedPackage = await app.inject({
      method: 'GET',
      url: '/api/v1/dev/skills/alice/edit-skill/versions/dev/package',
      headers: { 'x-skill-dev-key': developerKey.secret },
    });
    assert.equal(revokedPackage.statusCode, 403);
  } finally {
    await removeRegistryFixture(registryRoot);
    await removeRegistryFixture(packageFixture.root);
  }
});
