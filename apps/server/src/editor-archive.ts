import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, rm, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

import { create as tarCreate, extract as tarExtract } from 'tar';
import type { MarketPackageFileEntry, MarketWorkspaceFileEntry } from '@qizhi/skill-spec';

const require = createRequire(import.meta.url);
const JSZip = require('jszip') as typeof import('jszip');

export class EditorArchiveError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'EditorArchiveError';
    this.statusCode = statusCode;
  }
}

const textExtensions = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const contentTypesByExtension = new Map<string, string>([
  ['.css', 'text/css'],
  ['.csv', 'text/csv'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.md', 'text/markdown'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ts', 'text/typescript'],
  ['.txt', 'text/plain'],
  ['.webp', 'image/webp'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
]);

export const normalizeWorkspacePath = (rawPath: string | undefined, allowEmpty = false): string => {
  const raw = rawPath ?? '';
  const normalized = raw
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  const cleanPath = normalized === '.' ? '' : normalized;

  if (cleanPath.length === 0) {
    if (allowEmpty) {
      return '';
    }
    throw new EditorArchiveError(400, 'File path is required');
  }

  if (
    cleanPath.startsWith('/')
    || /^[a-zA-Z]:\//.test(cleanPath)
    || cleanPath.split('/').includes('..')
  ) {
    throw new EditorArchiveError(400, 'Unsafe file path');
  }

  return cleanPath;
};

export const resolveWorkspacePath = (filesRoot: string, rawPath: string | undefined, allowEmpty = false): string => {
  const relativePath = normalizeWorkspacePath(rawPath, allowEmpty);
  const resolvedRoot = path.resolve(filesRoot);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new EditorArchiveError(400, 'Unsafe file path');
  }
  return resolved;
};

const isEditableByPath = (filePath: string): boolean => textExtensions.has(path.extname(filePath).toLowerCase());

const contentTypeForPath = (filePath: string): string =>
  contentTypesByExtension.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';

const toIso = (date: Date): string => date.toISOString();

const ensureAbsent = async (target: string): Promise<void> => {
  try {
    await stat(target);
    throw new EditorArchiveError(409, 'File already exists');
  } catch (error) {
    if (error instanceof EditorArchiveError) {
      throw error;
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
};

export const workspaceRoot = (dataRoot: string, workspaceId: string): string =>
  path.join(dataRoot, 'edit-workspaces', workspaceId);

export const workspaceFilesRoot = (dataRoot: string, workspaceId: string): string =>
  path.join(workspaceRoot(dataRoot, workspaceId), 'files');

export const workspaceBuildsRoot = (dataRoot: string, workspaceId: string): string =>
  path.join(workspaceRoot(dataRoot, workspaceId), 'builds');

export const extractPackageToWorkspace = async (input: {
  packagePath: string;
  format: 'tgz' | 'zip';
  filesRoot: string;
}): Promise<void> => {
  await rm(input.filesRoot, { recursive: true, force: true });
  await mkdir(input.filesRoot, { recursive: true });

  if (input.format === 'tgz') {
    const errors: string[] = [];
    await tarExtract({
      cwd: input.filesRoot,
      file: input.packagePath,
      gzip: true,
      filter: (archivePath, entry) => {
        try {
          normalizeWorkspacePath(archivePath, true);
        } catch {
          errors.push(archivePath);
          return false;
        }
        const entryType = (entry as { type?: string }).type;
        if (entryType === 'SymbolicLink' || entryType === 'Link') {
          errors.push(archivePath);
          return false;
        }
        return true;
      },
    });
    if (errors.length > 0) {
      throw new EditorArchiveError(400, `Package contains unsafe entries: ${errors.slice(0, 5).join(', ')}`);
    }
    return;
  }

  const buffer = await readFile(input.packagePath);
  const zip = await JSZip.loadAsync(buffer);
  for (const item of Object.values(zip.files)) {
    const unsafeName = (item as { unsafeOriginalName?: string }).unsafeOriginalName ?? item.name;
    const archivePath = normalizeWorkspacePath(unsafeName);
    const target = resolveWorkspacePath(input.filesRoot, archivePath);
    if (item.dir) {
      await mkdir(target, { recursive: true });
      continue;
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await item.async('nodebuffer'));
  }
};

export const listWorkspaceDirectory = async (
  filesRoot: string,
  rawPath: string | undefined,
): Promise<MarketWorkspaceFileEntry[]> => {
  const relativePath = normalizeWorkspacePath(rawPath, true);
  const directory = resolveWorkspacePath(filesRoot, relativePath, true);
  const directoryStats = await stat(directory);
  if (!directoryStats.isDirectory()) {
    throw new EditorArchiveError(400, 'Path is not a directory');
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const result: MarketWorkspaceFileEntry[] = [];
  for (const entry of entries) {
    const childPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    const entryStats = await stat(fullPath);
    const kind = entry.isDirectory() ? 'directory' : 'file';
    result.push({
      path: childPath,
      name: entry.name,
      kind,
      sizeBytes: kind === 'file' ? entryStats.size : undefined,
      contentType: kind === 'file' ? contentTypeForPath(entry.name) : undefined,
      editable: kind === 'file' && isEditableByPath(entry.name) && entryStats.size <= 1024 * 1024,
      updatedAt: toIso(entryStats.mtime),
    });
  }

  return result.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
};

export const readWorkspaceTextFile = async (
  filesRoot: string,
  rawPath: string | undefined,
): Promise<string> => {
  const target = resolveWorkspacePath(filesRoot, rawPath);
  const targetStats = await stat(target);
  if (!targetStats.isFile()) {
    throw new EditorArchiveError(400, 'Path is not a file');
  }
  if (targetStats.size > 1024 * 1024) {
    throw new EditorArchiveError(413, 'File is too large for inline editing');
  }
  const buffer = await readFile(target);
  if (buffer.includes(0)) {
    throw new EditorArchiveError(409, 'Binary file cannot be edited as text');
  }
  return buffer.toString('utf8');
};

export const writeWorkspaceTextFile = async (input: {
  filesRoot: string;
  filePath: string;
  content: string;
  createOnly?: boolean;
}): Promise<void> => {
  const target = resolveWorkspacePath(input.filesRoot, input.filePath);
  if (input.createOnly) {
    await ensureAbsent(target);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.content, 'utf8');
};

export const createWorkspaceDirectory = async (filesRoot: string, rawPath: string): Promise<void> => {
  const target = resolveWorkspacePath(filesRoot, rawPath);
  await ensureAbsent(target);
  await mkdir(target, { recursive: true });
};

export const writeWorkspaceBinaryFile = async (input: {
  filesRoot: string;
  filePath: string;
  buffer: Buffer;
}): Promise<void> => {
  const target = resolveWorkspacePath(input.filesRoot, input.filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.buffer);
};

export const moveWorkspaceEntry = async (input: {
  filesRoot: string;
  from: string;
  to: string;
}): Promise<void> => {
  const from = resolveWorkspacePath(input.filesRoot, input.from);
  const to = resolveWorkspacePath(input.filesRoot, input.to);
  await ensureAbsent(to);
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
};

export const deleteWorkspaceEntry = async (filesRoot: string, rawPath: string): Promise<void> => {
  const relativePath = normalizeWorkspacePath(rawPath);
  const target = resolveWorkspacePath(filesRoot, relativePath);
  await rm(target, { recursive: true, force: true });
};

const collectFiles = async (filesRoot: string, relativePath = ''): Promise<MarketPackageFileEntry[]> => {
  const directory = path.join(filesRoot, relativePath);
  const entries = await readdir(directory, { withFileTypes: true });
  const result: MarketPackageFileEntry[] = [];
  for (const entry of entries) {
    const childPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectFiles(filesRoot, childPath));
    } else if (entry.isFile()) {
      const fileStats = await stat(fullPath);
      result.push({ path: childPath, sizeBytes: fileStats.size });
    }
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
};

export const collectWorkspaceFileEntries = async (filesRoot: string): Promise<MarketPackageFileEntry[]> =>
  collectFiles(filesRoot);

export const packWorkspaceToTgz = async (input: {
  filesRoot: string;
  packagePath: string;
}): Promise<void> => {
  await mkdir(path.dirname(input.packagePath), { recursive: true });
  const entries = (await readdir(input.filesRoot)).sort();
  if (entries.length === 0) {
    throw new EditorArchiveError(400, 'Workspace is empty');
  }
  await tarCreate({
    cwd: input.filesRoot,
    file: input.packagePath,
    gzip: true,
    portable: true,
  }, entries);
};
