import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { create as tarCreate } from 'tar';
import type { SkillManifest } from '@qizhi/skill-spec';

const require = createRequire(import.meta.url);
const JSZip = require('jszip') as typeof import('jszip');

export const makeRegistryFixture = async (): Promise<string> => {
  const root = path.resolve(process.cwd(), '.tmp', `registry-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const versionDir = path.join(root, 'skills', 'official', 'hello', '1.0.0');

  await mkdir(versionDir, { recursive: true });
  await writeFile(
    path.join(versionDir, 'manifest.json'),
    JSON.stringify(
      {
        id: 'official/hello',
        name: 'hello',
        displayName: 'Hello Skill',
        version: '1.0.0',
        kind: 'instruction',
        description: 'A small fixture skill.',
        author: { name: 'Qizhi' },
        tags: ['fixture'],
        categories: ['examples'],
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(versionDir, 'package.tgz'), 'fixture package');

  return root;
};

export const removeRegistryFixture = async (root: string): Promise<void> => {
  await rm(root, { recursive: true, force: true });
};

export const makePackageFixture = async (
  format: 'tgz' | 'zip',
  manifestPatch: Partial<SkillManifest> = {},
): Promise<{ root: string; filePath: string; filename: string; manifest: SkillManifest }> => {
  const root = path.resolve(process.cwd(), '.tmp', `package-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const sourceDir = path.join(root, 'source');
  await mkdir(sourceDir, { recursive: true });

  const manifest: SkillManifest = {
    skillSpecVersion: '1.0',
    id: 'alice/example-skill',
    name: 'example-skill',
    displayName: 'Example Skill',
    version: '1.0.0',
    kind: 'instruction',
    description: 'A package fixture skill.',
    author: { name: 'Alice' },
    tags: ['fixture'],
    categories: ['examples'],
    compatibility: { skillchat: '>=0.2.0' },
    permissions: {
      filesystem: [],
      network: false,
      scripts: false,
      secrets: [],
    },
    runtime: {
      type: 'none',
      entrypoints: [],
    },
    starterPrompts: [],
    assets: {
      screenshots: [],
    },
    ...manifestPatch,
  };

  await writeFile(path.join(sourceDir, 'skill.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(path.join(sourceDir, 'SKILL.md'), '# Example Skill\n', 'utf8');

  if (format === 'tgz') {
    const filename = 'package.tgz';
    const filePath = path.join(root, filename);
    await tarCreate({ cwd: sourceDir, file: filePath, gzip: true }, ['skill.json', 'SKILL.md']);
    return { root, filePath, filename, manifest };
  }

  const filename = 'package.zip';
  const filePath = path.join(root, filename);
  const zip = new JSZip();
  zip.file('skill.json', `${JSON.stringify(manifest, null, 2)}\n`);
  zip.file('SKILL.md', '# Example Skill\n');
  await writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
  return { root, filePath, filename, manifest };
};
