import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOfficialDist = path.resolve(repoRoot, '..', 'official-skills', 'dist');
const officialDist = process.argv[2] ? path.resolve(process.argv[2]) : defaultOfficialDist;
const registryRoot = path.join(repoRoot, 'registry', 'skills');

const index = JSON.parse(await readFile(path.join(officialDist, 'index.json'), 'utf8'));
if (!Array.isArray(index.packages)) {
  throw new Error('official dist index.json must contain packages[]');
}

for (const item of index.packages) {
  if (!item?.manifest?.id || !item?.manifest?.version || !item?.filename) {
    throw new Error(`Invalid package entry: ${JSON.stringify(item)}`);
  }

  const [publisher, name] = item.manifest.id.split('/');
  if (!publisher || !name) {
    throw new Error(`Invalid skill id: ${item.manifest.id}`);
  }

  const versionDir = path.join(registryRoot, publisher, name, item.manifest.version);
  await mkdir(versionDir, { recursive: true });
  await writeFile(
    path.join(versionDir, 'manifest.json'),
    `${JSON.stringify(item.manifest, null, 2)}\n`,
    'utf8',
  );
  await copyFile(
    path.join(officialDist, item.filename),
    path.join(versionDir, 'package.tgz'),
  );
  console.log(`imported ${item.manifest.id}@${item.manifest.version}`);
}

console.log(`imported ${index.packages.length} package(s) from ${officialDist}`);

