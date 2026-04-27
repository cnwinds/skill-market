import test from 'node:test';
import assert from 'node:assert/strict';

import { findPackageFile, findSkill, scanRegistry } from './registry.js';
import { makeRegistryFixture, removeRegistryFixture } from './test-utils.js';

test('scans registry skills and versions', async () => {
  const registryRoot = await makeRegistryFixture();
  try {
    const snapshot = await scanRegistry(registryRoot);

    assert.equal(snapshot.skills.length, 1);
    assert.equal(snapshot.skills[0]?.summary.id, 'official/hello');
    assert.equal(snapshot.skills[0]?.summary.latestVersion, '1.0.0');
    assert.equal(snapshot.skills[0]?.versions[0]?.checksumSha256?.length, 64);
  } finally {
    await removeRegistryFixture(registryRoot);
  }
});

test('finds skill details and package files', async () => {
  const registryRoot = await makeRegistryFixture();
  try {
    const skill = await findSkill(registryRoot, 'official', 'hello');
    const packageFile = await findPackageFile(registryRoot, 'official', 'hello', '1.0.0');

    assert.equal(skill.versions.length, 1);
    assert.equal(packageFile.sizeBytes, 'fixture package'.length);
  } finally {
    await removeRegistryFixture(registryRoot);
  }
});
