import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSkillPackage } from './package-validator.js';
import { makePackageFixture, removeRegistryFixture } from './test-utils.js';

test('validates tgz skill packages', async () => {
  const fixture = await makePackageFixture('tgz');
  try {
    const report = await validateSkillPackage(fixture.filePath, fixture.filename);

    assert.equal(report.validation.valid, true);
    assert.equal(report.manifest?.id, 'alice/example-skill');
    assert.equal(report.packageInfo.format, 'tgz');
    assert.equal(report.fileEntries.some((entry) => entry.path === 'skill.json'), true);
  } finally {
    await removeRegistryFixture(fixture.root);
  }
});

test('validates zip skill packages', async () => {
  const fixture = await makePackageFixture('zip');
  try {
    const report = await validateSkillPackage(fixture.filePath, fixture.filename);

    assert.equal(report.validation.valid, true);
    assert.equal(report.manifest?.id, 'alice/example-skill');
    assert.equal(report.packageInfo.format, 'zip');
    assert.equal(report.fileEntries.some((entry) => entry.path === 'SKILL.md'), true);
  } finally {
    await removeRegistryFixture(fixture.root);
  }
});
