import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatSkillRef,
  marketSkillListResponseSchema,
  parseSkillManifest,
  splitSkillId,
} from './index.js';

test('parses a valid skill manifest with defaults', () => {
  const manifest = parseSkillManifest({
    id: 'official/hello',
    name: 'hello',
    version: '1.0.0',
    kind: 'instruction',
    description: 'A small fixture skill.',
    author: { name: 'Qizhi' },
  });

  assert.equal(manifest.skillSpecVersion, '1.0');
  assert.deepEqual(manifest.permissions.filesystem, []);
  assert.equal(manifest.runtime.type, 'none');
});

test('validates market list responses', () => {
  const parsed = marketSkillListResponseSchema.parse({
    skills: [
      {
        id: 'official/hello',
        name: 'hello',
        latestVersion: '1.0.0',
        kind: 'instruction',
        description: 'A small fixture skill.',
        author: { name: 'Qizhi' },
        updatedAt: '2026-04-27T00:00:00.000Z',
      },
    ],
  });

  assert.equal(parsed.skills[0]?.tags.length, 0);
});

test('formats and splits skill ids', () => {
  const id = 'official/hello';

  assert.deepEqual(splitSkillId(id), { publisher: 'official', name: 'hello' });
  assert.equal(formatSkillRef(id, '1.0.0'), 'official/hello@1.0.0');
});
