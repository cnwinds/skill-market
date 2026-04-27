import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const makeRegistryFixture = async (): Promise<string> => {
  const root = path.resolve(process.cwd(), '.tmp', `registry-${process.pid}-${Date.now()}`);
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
