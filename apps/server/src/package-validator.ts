import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import { list as tarList, type ReadEntry } from 'tar';
import {
  type MarketPackageFileEntry,
  type MarketPackageFormat,
  type MarketPackageInfo,
  type MarketPackageValidation,
  type MarketValidationIssue,
  type SkillManifest,
  parseSkillManifest,
} from '@qizhi/skill-spec';

const require = createRequire(import.meta.url);
const JSZip = require('jszip') as typeof import('jszip');

export type PackageValidationReport = {
  manifest?: SkillManifest;
  packageInfo: MarketPackageInfo;
  fileEntries: MarketPackageFileEntry[];
  validation: MarketPackageValidation;
};

export type PackageValidationOptions = {
  maxFiles?: number;
  maxFileBytes?: number;
  maxManifestBytes?: number;
};

const defaultOptions = {
  maxFiles: 500,
  maxFileBytes: 10 * 1024 * 1024,
  maxManifestBytes: 512 * 1024,
};

const manifestCandidates = [
  'skill.json',
  'manifest.json',
  'package/skill.json',
  'package/manifest.json',
];

const sensitiveNames = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
]);

const sensitiveExtensions = ['.pem', '.key', '.p12', '.pfx'];

const contentTypeFor = (format: MarketPackageFormat): string =>
  format === 'zip' ? 'application/zip' : 'application/gzip';

export const packageExtensionFor = (format: MarketPackageFormat): string =>
  format === 'zip' ? 'zip' : 'tgz';

export const packageFormatFromFilename = (filename: string): MarketPackageFormat | undefined => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.zip')) {
    return 'zip';
  }
  if (lower.endsWith('.tgz') || lower.endsWith('.tar.gz')) {
    return 'tgz';
  }
  return undefined;
};

const issue = (code: string, message: string, filePath?: string): MarketValidationIssue => ({
  code,
  message,
  path: filePath,
});

const sha256 = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');

const normalizeArchivePath = (rawPath: string): string | undefined => {
  const normalized = rawPath.replaceAll('\\', '/').replace(/^\.\/+/, '');
  if (
    normalized.length === 0
    || normalized.startsWith('/')
    || /^[a-zA-Z]:\//.test(normalized)
    || normalized.split('/').includes('..')
  ) {
    return undefined;
  }
  return normalized;
};

const isSensitivePath = (archivePath: string): boolean => {
  const baseName = path.posix.basename(archivePath).toLowerCase();
  return sensitiveNames.has(baseName) || sensitiveExtensions.some((extension) => baseName.endsWith(extension));
};

const pickManifest = (files: Map<string, string>): { path?: string; raw?: string } => {
  for (const candidate of manifestCandidates) {
    const raw = files.get(candidate);
    if (raw) {
      return { path: candidate, raw };
    }
  }
  return {};
};

const parseManifest = (
  manifestPath: string | undefined,
  raw: string | undefined,
  errors: MarketValidationIssue[],
): SkillManifest | undefined => {
  if (!manifestPath || !raw) {
    errors.push(issue('manifest_missing', 'Package must contain skill.json or manifest.json.'));
    return undefined;
  }

  try {
    const manifest = parseSkillManifest(JSON.parse(raw));
    const [, name] = manifest.id.split('/');
    if (manifest.name !== name) {
      errors.push(issue('manifest_name_mismatch', 'manifest.name must match the name segment of manifest.id.', manifestPath));
    }
    return manifest;
  } catch (error) {
    errors.push(issue(
      'manifest_invalid',
      error instanceof Error ? error.message : 'Manifest JSON is invalid.',
      manifestPath,
    ));
    return undefined;
  }
};

const validateEntries = (
  entries: MarketPackageFileEntry[],
  errors: MarketValidationIssue[],
  warnings: MarketValidationIssue[],
  options: Required<PackageValidationOptions>,
): void => {
  if (entries.length > options.maxFiles) {
    errors.push(issue('too_many_files', `Package contains ${entries.length} files; maximum is ${options.maxFiles}.`));
  }

  if (!entries.some((entry) => ['SKILL.md', 'package/SKILL.md'].includes(entry.path))) {
    warnings.push(issue('skill_md_missing', 'Package should contain SKILL.md.'));
  }

  for (const entry of entries) {
    if ((entry.sizeBytes ?? 0) > options.maxFileBytes) {
      errors.push(issue('file_too_large', `File exceeds ${options.maxFileBytes} bytes.`, entry.path));
    }
    if (isSensitivePath(entry.path)) {
      errors.push(issue('sensitive_file', 'Package must not include secrets or private key files.', entry.path));
    }
  }
};

const readTgz = async (
  filePath: string,
  errors: MarketValidationIssue[],
  options: Required<PackageValidationOptions>,
): Promise<{ entries: MarketPackageFileEntry[]; manifests: Map<string, string> }> => {
  const entries: MarketPackageFileEntry[] = [];
  const manifests = new Map<string, string>();
  const manifestReads: Promise<void>[] = [];

  await tarList({
    file: filePath,
    gzip: true,
    onentry: (entry: ReadEntry) => {
      const archivePath = normalizeArchivePath(entry.path);
      if (!archivePath) {
        errors.push(issue('unsafe_path', 'Package contains an unsafe path.', entry.path));
        entry.resume();
        return;
      }

      if (entry.type !== 'File') {
        if (entry.type === 'SymbolicLink' || entry.type === 'Link') {
          errors.push(issue('unsafe_link', 'Package must not include symbolic or hard links.', archivePath));
        }
        entry.resume();
        return;
      }

      entries.push({ path: archivePath, sizeBytes: entry.size });
      if (manifestCandidates.includes(archivePath)) {
        if (entry.size > options.maxManifestBytes) {
          errors.push(issue('manifest_too_large', 'Manifest file is too large.', archivePath));
          entry.resume();
          return;
        }

        const chunks: Buffer[] = [];
        manifestReads.push(new Promise((resolve, reject) => {
          entry.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          entry.on('end', () => {
            manifests.set(archivePath, Buffer.concat(chunks).toString('utf8'));
            resolve();
          });
          entry.on('error', reject);
        }));
        return;
      }

      entry.resume();
    },
  });

  await Promise.all(manifestReads);
  return { entries, manifests };
};

const readZip = async (
  buffer: Buffer,
  errors: MarketValidationIssue[],
  options: Required<PackageValidationOptions>,
): Promise<{ entries: MarketPackageFileEntry[]; manifests: Map<string, string> }> => {
  const zip = await JSZip.loadAsync(buffer);
  const entries: MarketPackageFileEntry[] = [];
  const manifests = new Map<string, string>();

  for (const item of Object.values(zip.files)) {
    const unsafeName = (item as { unsafeOriginalName?: string }).unsafeOriginalName ?? item.name;
    const archivePath = normalizeArchivePath(unsafeName);
    if (!archivePath) {
      errors.push(issue('unsafe_path', 'Package contains an unsafe path.', unsafeName));
      continue;
    }

    if (item.dir) {
      continue;
    }

    const sizeBytes = (item as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    entries.push({ path: archivePath, sizeBytes });
    if (manifestCandidates.includes(archivePath)) {
      if ((sizeBytes ?? 0) > options.maxManifestBytes) {
        errors.push(issue('manifest_too_large', 'Manifest file is too large.', archivePath));
        continue;
      }
      manifests.set(archivePath, await item.async('string'));
    }
  }

  return { entries, manifests };
};

export const validateSkillPackage = async (
  filePath: string,
  filename: string,
  options: PackageValidationOptions = {},
): Promise<PackageValidationReport> => {
  const mergedOptions: Required<PackageValidationOptions> = {
    ...defaultOptions,
    ...options,
  };
  const errors: MarketValidationIssue[] = [];
  const warnings: MarketValidationIssue[] = [];
  const format = packageFormatFromFilename(filename);
  const buffer = await readFile(filePath);

  if (!format) {
    errors.push(issue('unsupported_package_format', 'Package must be .tgz, .tar.gz, or .zip.'));
  }

  let fileEntries: MarketPackageFileEntry[] = [];
  let manifests = new Map<string, string>();
  if (format === 'tgz') {
    try {
      const result = await readTgz(filePath, errors, mergedOptions);
      fileEntries = result.entries;
      manifests = result.manifests;
    } catch (error) {
      errors.push(issue('archive_invalid', error instanceof Error ? error.message : 'Unable to read tgz package.'));
    }
  } else if (format === 'zip') {
    try {
      const result = await readZip(buffer, errors, mergedOptions);
      fileEntries = result.entries;
      manifests = result.manifests;
    } catch (error) {
      errors.push(issue('archive_invalid', error instanceof Error ? error.message : 'Unable to read zip package.'));
    }
  }

  validateEntries(fileEntries, errors, warnings, mergedOptions);
  const picked = pickManifest(manifests);
  const manifest = parseManifest(picked.path, picked.raw, errors);

  return {
    manifest,
    packageInfo: {
      filename,
      format: format ?? 'tgz',
      contentType: contentTypeFor(format ?? 'tgz'),
      sizeBytes: buffer.length,
      checksumSha256: sha256(buffer),
    },
    fileEntries,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
  };
};
