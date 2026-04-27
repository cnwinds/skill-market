import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  type MarketSkillDetail,
  type MarketSkillSummary,
  type MarketSkillVersion,
  type SkillManifest,
  marketSkillDetailSchema,
  marketSkillSummarySchema,
  marketSkillVersionSchema,
  parseSkillManifest,
} from '@qizhi/skill-spec';

export class RegistryNotFoundError extends Error {
  constructor(message = 'Skill not found') {
    super(message);
    this.name = 'RegistryNotFoundError';
  }
}

export type RegistrySkill = {
  summary: MarketSkillSummary;
  versions: MarketSkillVersion[];
};

export type RegistrySnapshot = {
  skills: RegistrySkill[];
};

export type PackageFile = {
  path: string;
  sizeBytes: number;
};

const toIso = (date: Date): string => date.toISOString();

const isDirectory = async (target: string): Promise<boolean> => {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
};

const readDirectories = async (target: string): Promise<string[]> => {
  if (!(await isDirectory(target))) {
    return [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const compareSemver = (left: string, right: string): number => {
  const parse = (version: string) => version.split(/[.+-]/).slice(0, 3).map((part) => Number(part));
  const leftParts = parse(left);
  const rightParts = parse(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return left.localeCompare(right);
};

const sha256File = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const makePackageUrl = (manifest: SkillManifest): string => {
  const [publisher, name] = manifest.id.split('/');
  return `/api/v1/skills/${publisher}/${name}/versions/${manifest.version}/package`;
};

const readVersion = async (versionDir: string): Promise<MarketSkillVersion> => {
  const manifestPath = path.join(versionDir, 'manifest.json');
  const packagePath = path.join(versionDir, 'package.tgz');
  const [manifestFile, packageStats] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    stat(packagePath),
  ]);
  const manifest = parseSkillManifest(JSON.parse(manifestFile));

  return marketSkillVersionSchema.parse({
    id: manifest.id,
    version: manifest.version,
    manifest,
    packageUrl: makePackageUrl(manifest),
    checksumSha256: await sha256File(packagePath),
    sizeBytes: packageStats.size,
    publishedAt: toIso(packageStats.mtime),
  });
};

const toSummary = (latest: MarketSkillVersion, versions: MarketSkillVersion[]): MarketSkillSummary => {
  const updatedAt = versions
    .map((version) => version.publishedAt)
    .sort()
    .at(-1) ?? latest.publishedAt;

  return marketSkillSummarySchema.parse({
    id: latest.manifest.id,
    name: latest.manifest.name,
    displayName: latest.manifest.displayName,
    latestVersion: latest.manifest.version,
    kind: latest.manifest.kind,
    description: latest.manifest.description,
    author: latest.manifest.author,
    tags: latest.manifest.tags,
    categories: latest.manifest.categories,
    updatedAt,
  });
};

export const scanRegistry = async (registryRoot: string): Promise<RegistrySnapshot> => {
  const skillsRoot = path.join(registryRoot, 'skills');
  const publishers = await readDirectories(skillsRoot);
  const skills: RegistrySkill[] = [];

  for (const publisher of publishers) {
    const publisherDir = path.join(skillsRoot, publisher);
    const names = await readDirectories(publisherDir);

    for (const name of names) {
      const skillDir = path.join(publisherDir, name);
      const versionNames = await readDirectories(skillDir);
      const versions: MarketSkillVersion[] = [];

      for (const versionName of versionNames) {
        const version = await readVersion(path.join(skillDir, versionName));
        if (version.manifest.id !== `${publisher}/${name}`) {
          throw new Error(`Manifest id ${version.manifest.id} does not match ${publisher}/${name}`);
        }
        if (version.manifest.version !== versionName) {
          throw new Error(`Manifest version ${version.manifest.version} does not match ${versionName}`);
        }
        versions.push(version);
      }

      if (versions.length > 0) {
        versions.sort((left, right) => compareSemver(right.version, left.version));
        skills.push({
          summary: toSummary(versions[0] as MarketSkillVersion, versions),
          versions,
        });
      }
    }
  }

  skills.sort((left, right) => left.summary.id.localeCompare(right.summary.id));
  return { skills };
};

export const findSkill = async (
  registryRoot: string,
  publisher: string,
  name: string,
): Promise<MarketSkillDetail> => {
  const snapshot = await scanRegistry(registryRoot);
  const found = snapshot.skills.find((skill) => skill.summary.id === `${publisher}/${name}`);
  if (!found) {
    throw new RegistryNotFoundError();
  }

  return marketSkillDetailSchema.parse({
    ...found.summary,
    versions: found.versions,
  });
};

export const findPackageFile = async (
  registryRoot: string,
  publisher: string,
  name: string,
  version: string,
): Promise<PackageFile> => {
  await findSkill(registryRoot, publisher, name);
  const packagePath = path.join(registryRoot, 'skills', publisher, name, version, 'package.tgz');

  try {
    const packageStats = await stat(packagePath);
    if (!packageStats.isFile()) {
      throw new RegistryNotFoundError('Package not found');
    }
    return { path: packagePath, sizeBytes: packageStats.size };
  } catch (error) {
    if (error instanceof RegistryNotFoundError) {
      throw error;
    }
    throw new RegistryNotFoundError('Package not found');
  }
};
