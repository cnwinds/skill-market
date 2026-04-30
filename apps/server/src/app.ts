import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import {
  type MarketAuthUser,
  type MarketDevRelease,
  type MarketDeveloperKey,
  type MarketEditWorkspace,
  type MarketPackageValidation,
  type MarketSkillSummary,
  type MarketSkillListQuery,
  marketDeveloperKeyListResponseSchema,
  marketDeveloperKeyResponseSchema,
  marketDevReleaseListResponseSchema,
  marketDevReleaseResponseSchema,
  marketEditWorkspaceListResponseSchema,
  marketEditWorkspaceResponseSchema,
  marketPublishKeyListResponseSchema,
  marketPublishKeyResponseSchema,
  marketSkillListResponseSchema,
  marketSkillListQuerySchema,
  marketSkillVersionsResponseSchema,
  marketPublisherSkillResponseSchema,
  marketPublisherSkillsResponseSchema,
  marketSubmissionListQuerySchema,
  marketSubmissionListResponseSchema,
  marketSubmissionResponseSchema,
  marketWorkspaceFileContentResponseSchema,
  marketWorkspaceFileListResponseSchema,
  semverSchema,
  skillManifestSchema,
  skillIdSchema,
  skillNameSchema,
  splitSkillId,
} from '@qizhi/skill-spec';

import { RegistryNotFoundError, findPackageFile, findSkill, scanRegistry } from './registry.js';
import {
  MarketStore,
  canPublishFor,
  getUserByPublishKey,
  hashDeveloperKey,
  hashPublishKey,
  publicSubmission,
  publicSubmissions,
  type StoredDevRelease,
  type StoredDeveloperKey,
  type StoredEditWorkspace,
  type StoredPublishKey,
} from './market-store.js';
import {
  packageExtensionFor,
  packageFormatFromFilename,
  validateSkillPackage,
} from './package-validator.js';
import {
  EditorArchiveError,
  collectWorkspaceFileEntries,
  createWorkspaceDirectory,
  deleteWorkspaceEntry,
  extractPackageToWorkspace,
  listWorkspaceDirectory,
  moveWorkspaceEntry,
  normalizeWorkspacePath,
  packWorkspaceToTgz,
  readWorkspaceTextFile,
  resolveWorkspacePath,
  workspaceBuildsRoot,
  workspaceFilesRoot,
  workspaceRoot,
  writeWorkspaceBinaryFile,
  writeWorkspaceTextFile,
} from './editor-archive.js';

export type AppOptions = {
  registryRoot?: string;
  dataRoot?: string;
  logger?: boolean;
  uploadMaxBytes?: number;
  corsOrigins?: string[] | boolean;
};

const appDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRegistryRoot = path.resolve(appDir, '../../..', 'registry');
const defaultUploadMaxBytes = 20 * 1024 * 1024;
const defaultCorsOrigins = [
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173',
];

class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

const parseSkillParams = (params: unknown): { publisher: string; name: string } => {
  const input = params as { publisher?: unknown; name?: unknown };
  return {
    publisher: skillNameSchema.parse(input.publisher),
    name: skillNameSchema.parse(input.name),
  };
};

const parseVersionParams = (params: unknown): { publisher: string; name: string; version: string } => {
  const input = params as { version?: unknown };
  return {
    ...parseSkillParams(params),
    version: semverSchema.parse(input.version),
  };
};

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80).optional(),
  publisher: skillNameSchema.optional(),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const notesBodySchema = z.object({
  releaseNotes: z.string().max(2000).optional(),
  changeNotes: z.string().max(2000).optional(),
}).default({});

const createWorkspaceBodySchema = z.object({
  sourceVersion: semverSchema.optional(),
  targetVersion: semverSchema.optional(),
  packageFormat: z.enum(['tgz']).optional(),
}).default({});

const patchWorkspaceBodySchema = z.object({
  targetVersion: semverSchema.optional(),
  baseRevision: z.number().int().nonnegative(),
});

const pathQuerySchema = z.object({
  path: z.string().optional(),
});

const writeFileBodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  baseRevision: z.number().int().nonnegative(),
});

const createFileBodySchema = z.object({
  path: z.string().min(1),
  kind: z.enum(['file', 'directory']),
  content: z.string().optional(),
  baseRevision: z.number().int().nonnegative(),
});

const moveFileBodySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
});

const createDevReleaseBodySchema = z.object({
  version: semverSchema.optional(),
  label: z.string().max(120).optional(),
  expiresAt: z.string().datetime().optional(),
}).default({});

const createDeveloperKeyBodySchema = z.object({
  name: z.string().min(1).max(120),
  skillId: skillIdSchema,
  expiresAt: z.string().datetime().optional(),
});

const createPublishKeyBodySchema = z.object({
  name: z.string().min(1).max(120),
  publisher: skillNameSchema,
  expiresAt: z.string().datetime().optional(),
});

const reasonBodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

const optionalReasonBodySchema = z.object({
  reason: z.string().max(2000).optional(),
}).default({});

const adminPublishBodySchema = z.object({
  releaseNotes: z.string().max(2000).optional(),
  changeNotes: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
}).default({});

const extractAuthToken = (request: { headers: Record<string, unknown> }): string | undefined => {
  const authorization = request.headers.authorization;
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice('bearer '.length).trim();
  }

  const tokenHeader = request.headers['x-session-token'];
  return typeof tokenHeader === 'string' ? tokenHeader : undefined;
};

const ensureDirectoryAbsent = async (target: string): Promise<void> => {
  try {
    await stat(target);
    throw new HttpError(409, 'Version already exists');
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
};

const directoryExists = async (target: string): Promise<boolean> => {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
};

const versionDir = (registryRoot: string, publisher: string, name: string, version: string): string =>
  path.join(registryRoot, 'skills', publisher, name, version);

const devReleaseDir = (dataRoot: string, publisher: string, name: string, version: string): string =>
  path.join(dataRoot, 'dev-releases', publisher, name, version);

const parseWorkspaceParams = (params: unknown): { workspaceId: string } => {
  const workspaceId = (params as { workspaceId?: unknown }).workspaceId;
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    throw new HttpError(400, 'Workspace id is required');
  }
  return { workspaceId };
};

const parseDeveloperKeyParams = (params: unknown): { keyId: string } => {
  const keyId = (params as { keyId?: unknown }).keyId;
  if (typeof keyId !== 'string' || keyId.length === 0) {
    throw new HttpError(400, 'Developer key id is required');
  }
  return { keyId };
};

const parseDevReleaseParams = (params: unknown): { devReleaseId: string } => {
  const devReleaseId = (params as { devReleaseId?: unknown }).devReleaseId;
  if (typeof devReleaseId !== 'string' || devReleaseId.length === 0) {
    throw new HttpError(400, 'Dev release id is required');
  }
  return { devReleaseId };
};

const bumpPatchVersion = (version: string): string => {
  const [major = '0', minor = '0', patch = '0'] = version.split(/[+-]/)[0]!.split('.');
  return `${Number(major)}.${Number(minor)}.${Number(patch) + 1}`;
};

const nowIso = (): string => new Date().toISOString();

const publicWorkspace = (workspace: StoredEditWorkspace): MarketEditWorkspace =>
  marketEditWorkspaceResponseSchema.shape.workspace.parse({
    ...workspace,
    ownerUserId: undefined,
    rootPath: undefined,
  });

const publicDevRelease = (release: StoredDevRelease): MarketDevRelease =>
  marketDevReleaseResponseSchema.shape.devRelease.parse({
    ...release,
    packagePath: undefined,
    manifestPath: undefined,
  });

const publicDeveloperKey = (key: StoredDeveloperKey): MarketDeveloperKey =>
  marketDeveloperKeyResponseSchema.shape.developerKey.parse({
    ...key,
    keyHash: undefined,
  });

const publicPublishKey = (key: StoredPublishKey, secret?: string) =>
  marketPublishKeyResponseSchema.shape.publishKey.parse({
    ...key,
    keyHash: undefined,
    secret: secret ?? key.secret,
  });

const isExpired = (expiresAt: string | undefined): boolean =>
  Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());

const addValidationError = (
  validation: MarketPackageValidation,
  code: string,
  message: string,
  filePath?: string,
): MarketPackageValidation => ({
  ...validation,
  valid: false,
  errors: [
    ...validation.errors,
    { code, message, path: filePath },
  ],
});

const readMultipartField = (fields: unknown, name: string): string | undefined => {
  if (!fields || typeof fields !== 'object') {
    return undefined;
  }

  const value = (fields as Record<string, unknown>)[name];
  const field = Array.isArray(value) ? value[0] : value;
  if (field && typeof field === 'object' && 'value' in field && typeof field.value === 'string') {
    return field.value;
  }
  return undefined;
};

const filterSkillSummaries = (skills: MarketSkillSummary[], query: MarketSkillListQuery) => {
  const loweredQuery = query.query?.trim().toLowerCase();
  const loweredTag = query.tag?.trim().toLowerCase();
  const loweredCategory = query.category?.trim().toLowerCase();

  const filtered = skills
    .filter((skill) => !query.publisher || skill.id.startsWith(`${query.publisher}/`))
    .filter((skill) => !query.kind || skill.kind === query.kind)
    .filter((skill) => !loweredTag || skill.tags.some((tag) => tag.toLowerCase() === loweredTag))
    .filter((skill) => !loweredCategory || skill.categories.some((category) => category.toLowerCase() === loweredCategory))
    .filter((skill) => {
      if (!loweredQuery) {
        return true;
      }
      const haystack = [
        skill.id,
        skill.name,
        skill.displayName,
        skill.description,
        skill.author.name,
        ...skill.tags,
        ...skill.categories,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(loweredQuery);
    });

  filtered.sort((left, right) => {
    if (query.sort === 'name') {
      return (left.displayName ?? left.id).localeCompare(right.displayName ?? right.id);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return filtered.slice(0, query.limit);
};

const aggregateValues = (
  skills: MarketSkillSummary[],
  picker: (skill: MarketSkillSummary) => string[],
): Array<{ name: string; count: number }> => {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    for (const value of picker(skill)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
};

export const generateMarketMd = (baseUrl: string): string => `---
skillmarket: "1.0"
baseUrl: "${baseUrl}"
apiVersion: "v1"
---

# SkillMarket

This is a SkillMarket instance. Tools can use this file to discover endpoints for installing and publishing Skills.

Tools should parse fenced code blocks with language \`skill-market\`. Human-readable prose explains the expected workflow and safety checks.

## Install

\`\`\`skill-market
action: install
baseUrl: ${baseUrl}
api:
  list:    GET /api/v1/skills
  detail:  GET /api/v1/skills/{publisher}/{name}
  package: GET /api/v1/skills/{publisher}/{name}/versions/{version}/package
query:
  list: [query, kind, tag, category, publisher, sort, limit]
packageHeaders:
  skillId: X-Skill-Id
  version: X-Skill-Version
  sha256: X-Skill-Sha256
\`\`\`

## Tool Install Workflow

1. If the user provides a keyword, call \`GET /api/v1/skills?query=...\` and ask the user to confirm the intended Skill.
2. If the user provides \`publisher/name\`, call \`GET /api/v1/skills/{publisher}/{name}\` directly.
3. Resolve the version to install. Use the latest version unless the user asks for a specific version.
4. Download the package with \`GET /api/v1/skills/{publisher}/{name}/versions/{version}/package\`.
5. Verify the downloaded file with the \`X-Skill-Sha256\` response header.
6. Install the package into the local Skill directory supported by the current tool or SkillChat. If the tool does not know the target directory, ask the user before writing files.

## Development Install

\`\`\`skill-market
action: dev-install
baseUrl: ${baseUrl}
auth:
  devKey:
    header: X-Skill-Dev-Key
    format: "{key}"
api:
  list:    GET /api/v1/dev/skills/{publisher}/{name}
  versions: GET /api/v1/dev/skills/{publisher}/{name}/versions
  manifest: GET /api/v1/dev/skills/{publisher}/{name}/versions/{version}/manifest
  package: GET /api/v1/dev/skills/{publisher}/{name}/versions/{version}/package
versionAliases: [dev, latest-dev]
packageHeaders:
  skillId: X-Skill-Id
  version: X-Skill-Version
  sha256: X-Skill-Sha256
  channel: X-Skill-Channel
\`\`\`

## Tool Development Install Workflow

1. Development versions require \`X-Skill-Dev-Key: skdev_...\`.
2. Use a specific dev version when provided. Otherwise \`dev\` or \`latest-dev\` resolves to the newest active development version.
3. Verify \`X-Skill-Sha256\` after downloading.
4. Treat development packages as unsafe for production. Install into a temporary or development Skill directory and do not overwrite a public version unless the user explicitly confirms.

## Publish

\`\`\`skill-market
action: publish
baseUrl: ${baseUrl}
auth:
  apiKey:
    header: Authorization
    format: "Bearer {key}"
    manageUrl: ${baseUrl}/publisher/keys
  login:
    endpoint: POST /api/v1/auth/login
    body: { email, password }
    tokenPath: token
api:
  upload: POST /api/v1/publisher/submissions
  submit: POST /api/v1/publisher/submissions/{id}/submit
  status: GET /api/v1/publisher/submissions/{id}
package:
  field: file
  formats: [package.tgz, package.tar.gz, package.zip]
\`\`\`

## Authentication

To publish a Skill, you need a bearer token. Two methods are supported:

**API Key (recommended for CI/CD and automated tools)**

Generate a Publish Key at [${baseUrl}/publisher/keys](${baseUrl}/publisher/keys), then use it as a bearer token:

\`\`\`
Authorization: Bearer skpub_...
\`\`\`

**Login (interactive)**

\`\`\`http
POST ${baseUrl}/api/v1/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "..." }
\`\`\`

The response includes a \`token\` field. Use it as \`Authorization: Bearer <token>\`.

## Tool Publish Workflow

1. Read the \`action: publish\` block and choose an authentication method. Prefer Publish Key for tools and CI/CD.
2. Upload package: \`POST /api/v1/publisher/submissions\` with \`multipart/form-data\`; the file field must be named \`file\`.
3. Inspect the returned validation result. If \`validation.errors\` is not empty, stop and report the errors.
4. Submit for review: \`POST /api/v1/publisher/submissions/{id}/submit\`.
5. Check status: \`GET /api/v1/publisher/submissions/{id}\`. Publishing is not complete until the submission reaches \`published\`.

## Human Workflow

- Install manually: search the web UI, open the Skill detail page, download the package, and import it into the target tool.
- Publish manually: log in, open \`${baseUrl}/publish\`, upload a package, review validation results, and submit it for human review.
`;

export const createApp = (options: AppOptions = {}): FastifyInstance => {
  const app = Fastify({ logger: options.logger ?? false });
  const registryRoot = options.registryRoot ?? defaultRegistryRoot;
  const store = new MarketStore(options.dataRoot ?? path.join(registryRoot, 'market-data'));
  const uploadMaxBytes = options.uploadMaxBytes ?? defaultUploadMaxBytes;

  app.register(cors, {
    origin: options.corsOrigins ?? defaultCorsOrigins,
    allowedHeaders: ['authorization', 'content-type', 'x-session-token', 'x-skill-dev-key'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.register(multipart, {
    limits: {
      fileSize: uploadMaxBytes,
      files: 1,
    },
  });

  const requireUser = async (request: { headers: Record<string, unknown> }): Promise<MarketAuthUser> => {
    const token = extractAuthToken(request);
    const user = await store.getUserByToken(token);
    if (user) {
      return user;
    }
    const publishKeyResult = await getUserByPublishKey(store, token);
    if (publishKeyResult) {
      return publishKeyResult.user;
    }
    throw new HttpError(401, 'Authentication required');
  };

  const requireAdmin = async (request: { headers: Record<string, unknown> }): Promise<MarketAuthUser> => {
    const user = await requireUser(request);
    if (!user.roles.includes('admin')) {
      throw new HttpError(403, 'Admin role required');
    }
    return user;
  };

  const getWorkspace = async (workspaceId: string): Promise<StoredEditWorkspace> => {
    const data = await store.read();
    const workspace = data.editWorkspaces.find((entry) => entry.id === workspaceId);
    if (!workspace) {
      throw new HttpError(404, 'Workspace not found');
    }
    return workspace;
  };

  const assertWorkspaceAccess = (user: MarketAuthUser, workspace: StoredEditWorkspace): void => {
    if (workspace.ownerUserId !== user.id && !canPublishFor(user, workspace.publisher)) {
      throw new HttpError(403, 'Workspace access denied');
    }
  };

  const assertMutableWorkspace = (workspace: StoredEditWorkspace, baseRevision?: number): void => {
    if (!['draft', 'ready'].includes(workspace.status)) {
      throw new HttpError(409, 'Workspace is not editable');
    }
    if (baseRevision !== undefined && workspace.revision !== baseRevision) {
      throw new HttpError(409, `Workspace revision is ${workspace.revision}`);
    }
  };

  const markWorkspaceEdited = async (workspaceId: string): Promise<StoredEditWorkspace> => {
    const updated = await store.update((data) => {
      const workspace = data.editWorkspaces.find((entry) => entry.id === workspaceId);
      if (!workspace) {
        throw new HttpError(404, 'Workspace not found');
      }
      workspace.revision += 1;
      workspace.status = 'draft';
      workspace.validation = undefined;
      workspace.lastValidatedAt = undefined;
      workspace.updatedAt = nowIso();
      return workspace;
    });
    return updated;
  };

  const activeDevReleases = async (publisher: string, name: string): Promise<StoredDevRelease[]> => {
    const data = await store.read();
    return data.devReleases
      .filter((release) => release.publisher === publisher && release.name === name)
      .filter((release) => release.status === 'active' && !isExpired(release.expiresAt))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  };

  const latestDevVersion = async (publisher: string, name: string): Promise<string | undefined> =>
    (await activeDevReleases(publisher, name))[0]?.version;

  const makePackageUrl = (publisher: string, name: string, version: string): string =>
    `/api/v1/dev/skills/${publisher}/${name}/versions/${version}/package`;

  const validateWorkspaceBuild = async (input: {
    workspace: StoredEditWorkspace;
    targetVersion: string;
    channel: 'public' | 'dev';
  }) => {
    const buildId = `build_${randomUUID()}`;
    const buildDir = path.join(workspaceBuildsRoot(store.dataRoot, input.workspace.id), buildId);
    const packagePath = path.join(buildDir, 'package.tgz');
    await packWorkspaceToTgz({
      filesRoot: workspaceFilesRoot(store.dataRoot, input.workspace.id),
      packagePath,
    });

    const report = await validateSkillPackage(packagePath, 'package.tgz');
    let validation = report.validation;
    const manifest = report.manifest;
    if (manifest) {
      if (manifest.id !== input.workspace.skillId) {
        validation = addValidationError(
          validation,
          'manifest_id_changed',
          'manifest.id cannot be changed when editing an existing Skill.',
          'skill.json',
        );
      }
      if (manifest.name !== input.workspace.name) {
        validation = addValidationError(
          validation,
          'manifest_name_changed',
          'manifest.name must match the original Skill name.',
          'skill.json',
        );
      }
      if (manifest.version !== input.targetVersion) {
        validation = addValidationError(
          validation,
          'manifest_version_mismatch',
          'manifest.version must match the requested target version.',
          'skill.json',
        );
      }
      if (manifest.version === input.workspace.sourceVersion) {
        validation = addValidationError(
          validation,
          'version_unchanged',
          'Target version must be different from the source version.',
          'skill.json',
        );
      }
      if (await directoryExists(versionDir(registryRoot, input.workspace.publisher, input.workspace.name, manifest.version))) {
        validation = addValidationError(
          validation,
          'version_exists',
          'This publisher/name/version already exists and cannot be overwritten.',
        );
      }
      if (input.channel === 'dev') {
        const activeDev = await activeDevReleases(input.workspace.publisher, input.workspace.name);
        if (activeDev.some((release) => release.version === manifest.version)) {
          validation = addValidationError(
            validation,
            'dev_version_exists',
            'This development version already exists and cannot be overwritten.',
          );
        }
      }
    }

    await writeFile(path.join(buildDir, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
    if (manifest) {
      await writeFile(path.join(buildDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    }

    return {
      buildId,
      buildDir,
      packagePath,
      report: {
        ...report,
        validation,
      },
    };
  };

  const storeWorkspaceValidation = async (
    workspaceId: string,
    build: Awaited<ReturnType<typeof validateWorkspaceBuild>>,
  ): Promise<StoredEditWorkspace> => {
    const updated = await store.update((data) => {
      const workspace = data.editWorkspaces.find((entry) => entry.id === workspaceId);
      if (!workspace) {
        throw new HttpError(404, 'Workspace not found');
      }
      workspace.latestBuildId = build.buildId;
      workspace.validation = build.report.validation;
      workspace.fileEntries = build.report.fileEntries;
      workspace.lastValidatedAt = nowIso();
      workspace.status = build.report.validation.valid ? 'ready' : 'draft';
      workspace.updatedAt = nowIso();
      return workspace;
    });
    return updated;
  };

  const findDeveloperKeyBySecret = async (secret: string | undefined): Promise<StoredDeveloperKey | undefined> => {
    if (!secret) {
      return undefined;
    }
    const data = await store.read();
    return data.developerKeys.find((key) => key.keyHash === hashDeveloperKey(secret));
  };

  const assertDevKeyAccess = async (
    request: { headers: Record<string, unknown> },
    publisher: string,
    name: string,
  ): Promise<StoredDeveloperKey> => {
    const rawHeader = request.headers['x-skill-dev-key'];
    const secret = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const key = await findDeveloperKeyBySecret(typeof secret === 'string' ? secret : undefined);
    if (!key) {
      throw new HttpError(401, 'Developer key required');
    }
    if (key.revokedAt || isExpired(key.expiresAt)) {
      throw new HttpError(403, 'Developer key is not active');
    }
    if (!key.scopes.includes('dev:read')) {
      throw new HttpError(403, 'Developer key scope denied');
    }
    const skillId = `${publisher}/${name}`;
    if (key.skillId && key.skillId !== skillId) {
      throw new HttpError(403, 'Developer key scope denied');
    }
    if (key.publisher && key.publisher !== publisher) {
      throw new HttpError(403, 'Developer key scope denied');
    }

    await store.update((data) => {
      const stored = data.developerKeys.find((entry) => entry.id === key.id);
      if (stored) {
        stored.lastUsedAt = nowIso();
      }
    });
    return key;
  };

  const resolveDevRelease = async (
    publisher: string,
    name: string,
    versionOrAlias: string,
  ): Promise<StoredDevRelease> => {
    const active = await activeDevReleases(publisher, name);
    const resolved = versionOrAlias === 'dev' || versionOrAlias === 'latest-dev'
      ? active[0]
      : active.find((release) => release.version === versionOrAlias);
    if (!resolved) {
      throw new HttpError(404, 'Development version not found');
    }
    return resolved;
  };

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/api/v1/skills', async (request) => {
    const query = marketSkillListQuerySchema.parse(request.query);
    const snapshot = await scanRegistry(registryRoot);
    return marketSkillListResponseSchema.parse({
      skills: filterSkillSummaries(snapshot.skills.map((skill) => skill.summary), query),
    });
  });

  app.get('/api/v1/categories', async () => {
    const snapshot = await scanRegistry(registryRoot);
    return { categories: aggregateValues(snapshot.skills.map((skill) => skill.summary), (skill) => skill.categories) };
  });

  app.get('/api/v1/tags', async () => {
    const snapshot = await scanRegistry(registryRoot);
    return { tags: aggregateValues(snapshot.skills.map((skill) => skill.summary), (skill) => skill.tags) };
  });

  app.get('/api/v1/featured-skills', async () => {
    const [snapshot, data] = await Promise.all([scanRegistry(registryRoot), store.read()]);
    const byId = new Map(snapshot.skills.map((skill) => [skill.summary.id, skill.summary]));
    return marketSkillListResponseSchema.parse({
      skills: data.featuredSkillIds.map((id) => byId.get(id)).filter((skill): skill is MarketSkillSummary => Boolean(skill)),
    });
  });

  app.get('/api/v1/skills/:publisher/:name', async (request) => {
    const { publisher, name } = parseSkillParams(request.params);
    return findSkill(registryRoot, publisher, name);
  });

  app.get('/api/v1/skills/:publisher/:name/versions', async (request) => {
    const { publisher, name } = parseSkillParams(request.params);
    const skill = await findSkill(registryRoot, publisher, name);
    return marketSkillVersionsResponseSchema.parse({ versions: skill.versions });
  });

  app.get('/api/v1/skills/:publisher/:name/versions/:version/manifest', async (request) => {
    const { publisher, name, version } = parseVersionParams(request.params);
    const skill = await findSkill(registryRoot, publisher, name);
    const found = skill.versions.find((entry) => entry.version === version);
    if (!found) {
      throw new RegistryNotFoundError('Version not found');
    }

    return skillManifestSchema.parse(found.manifest);
  });

  app.get('/api/v1/skills/:publisher/:name/versions/:version/package', async (request, reply) => {
    const { publisher, name, version } = parseVersionParams(request.params);
    const packageFile = await findPackageFile(registryRoot, publisher, name, version);

    return reply
      .type(packageFile.contentType)
      .header('content-disposition', `attachment; filename="package.${packageExtensionFor(packageFile.format)}"`)
      .header('content-length', String(packageFile.sizeBytes))
      .header('x-skill-id', `${publisher}/${name}`)
      .header('x-skill-version', version)
      .header('x-skill-sha256', packageFile.checksumSha256)
      .send(createReadStream(packageFile.path));
  });

  app.post('/api/v1/auth/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    try {
      const result = await store.createUser(body);
      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
        return reply.code(409).send({ error: 'Email already exists' });
      }
      throw error;
    }
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await store.login(body.email, body.password);
    if (!result) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    return result;
  });

  app.post('/api/v1/auth/logout', async (request) => {
    await store.revokeToken(extractAuthToken(request));
    return { ok: true };
  });

  app.get('/api/v1/auth/me', async (request) => ({
    user: await store.getUserByToken(extractAuthToken(request)),
  }));

  app.post('/api/v1/auth/refresh', async (request) => {
    const user = await requireUser(request);
    await store.revokeToken(extractAuthToken(request));
    return {
      user,
      token: await store.createSession(user.id),
    };
  });

  app.post('/api/v1/publisher/skills/:publisher/:name/edit-workspaces', async (request, reply) => {
    const user = await requireUser(request);
    const { publisher, name } = parseSkillParams(request.params);
    if (!canPublishFor(user, publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }

    const body = createWorkspaceBodySchema.parse(request.body ?? {});
    const detail = await findSkill(registryRoot, publisher, name);
    const sourceVersion = body.sourceVersion ?? detail.versions[0]?.version;
    if (!sourceVersion) {
      throw new HttpError(404, 'Source version not found');
    }
    if (!detail.versions.some((version) => version.version === sourceVersion)) {
      throw new HttpError(404, 'Source version not found');
    }

    const sourcePackage = await findPackageFile(registryRoot, publisher, name, sourceVersion);
    const workspaceId = `ws_${randomUUID()}`;
    const rootPath = workspaceRoot(store.dataRoot, workspaceId);
    const filesRoot = workspaceFilesRoot(store.dataRoot, workspaceId);
    const targetVersion = body.targetVersion ?? bumpPatchVersion(sourceVersion);
    await mkdir(rootPath, { recursive: true });
    await copyFile(
      sourcePackage.path,
      path.join(rootPath, `source-package.${packageExtensionFor(sourcePackage.format)}`),
    );
    await extractPackageToWorkspace({
      packagePath: sourcePackage.path,
      format: sourcePackage.format,
      filesRoot,
    });
    for (const manifestPath of ['skill.json', 'manifest.json', 'package/skill.json', 'package/manifest.json']) {
      try {
        const target = resolveWorkspacePath(filesRoot, manifestPath);
        const manifest = JSON.parse(await readFile(target, 'utf8')) as { version?: string };
        manifest.version = targetVersion;
        await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        break;
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }
    }
    const fileEntries = await collectWorkspaceFileEntries(filesRoot);

    const now = nowIso();
    const workspace = await store.update((data) => {
      const stored: StoredEditWorkspace = {
        id: workspaceId,
        status: 'draft',
        ownerUserId: user.id,
        publisher,
        name,
        skillId: `${publisher}/${name}`,
        sourceVersion,
        targetVersion,
        revision: 1,
        rootPath,
        fileEntries,
        devReleaseIds: [],
        createdAt: now,
        updatedAt: now,
      };
      data.editWorkspaces.push(stored);
      return stored;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_create',
      targetType: 'workspace',
      targetId: workspace.id,
    });

    return reply.code(201).send(marketEditWorkspaceResponseSchema.parse({
      workspace: publicWorkspace(workspace),
    }));
  });

  app.get('/api/v1/publisher/edit-workspaces', async (request) => {
    const user = await requireUser(request);
    const query = z.object({
      skillId: skillIdSchema.optional(),
      status: z.enum(['draft', 'validating', 'ready', 'submitted', 'published', 'discarded']).optional(),
    }).parse(request.query);
    const data = await store.read();
    const workspaces = data.editWorkspaces
      .filter((workspace) => workspace.ownerUserId === user.id || canPublishFor(user, workspace.publisher))
      .filter((workspace) => !query.skillId || workspace.skillId === query.skillId)
      .filter((workspace) => !query.status || workspace.status === query.status)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(publicWorkspace);
    return marketEditWorkspaceListResponseSchema.parse({ workspaces });
  });

  app.get('/api/v1/publisher/edit-workspaces/:workspaceId', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(workspace) });
  });

  app.patch('/api/v1/publisher/edit-workspaces/:workspaceId', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = patchWorkspaceBodySchema.parse(request.body);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    assertMutableWorkspace(workspace, body.baseRevision);

    const updated = await store.update((data) => {
      const current = data.editWorkspaces.find((entry) => entry.id === workspaceId);
      if (!current) {
        throw new HttpError(404, 'Workspace not found');
      }
      if (body.targetVersion) {
        current.targetVersion = body.targetVersion;
      }
      current.revision += 1;
      current.status = 'draft';
      current.validation = undefined;
      current.lastValidatedAt = undefined;
      current.updatedAt = nowIso();
      return current;
    });
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(updated) });
  });

  app.get('/api/v1/publisher/edit-workspaces/:workspaceId/files', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const query = pathQuerySchema.parse(request.query);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    const relativePath = normalizeWorkspacePath(query.path, true);
    return marketWorkspaceFileListResponseSchema.parse({
      path: relativePath,
      entries: await listWorkspaceDirectory(workspaceFilesRoot(store.dataRoot, workspace.id), relativePath),
      revision: workspace.revision,
    });
  });

  app.get('/api/v1/publisher/edit-workspaces/:workspaceId/files/content', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const query = pathQuerySchema.parse(request.query);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    const filePath = normalizeWorkspacePath(query.path);
    return marketWorkspaceFileContentResponseSchema.parse({
      path: filePath,
      encoding: 'utf8',
      content: await readWorkspaceTextFile(workspaceFilesRoot(store.dataRoot, workspace.id), filePath),
      revision: workspace.revision,
    });
  });

  app.get('/api/v1/publisher/edit-workspaces/:workspaceId/files/download', async (request, reply) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const query = pathQuerySchema.parse(request.query);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    const filePath = normalizeWorkspacePath(query.path);
    const absolutePath = resolveWorkspacePath(workspaceFilesRoot(store.dataRoot, workspace.id), filePath);
    const fileStats = await stat(absolutePath);
    if (!fileStats.isFile()) {
      throw new HttpError(400, 'Path is not a file');
    }
    return reply
      .header('content-disposition', `attachment; filename="${path.basename(filePath)}"`)
      .header('content-length', String(fileStats.size))
      .send(createReadStream(absolutePath));
  });

  app.put('/api/v1/publisher/edit-workspaces/:workspaceId/files/content', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = writeFileBodySchema.parse(request.body);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    assertMutableWorkspace(workspace, body.baseRevision);
    await writeWorkspaceTextFile({
      filesRoot: workspaceFilesRoot(store.dataRoot, workspace.id),
      filePath: body.path,
      content: body.content,
    });
    const updated = await markWorkspaceEdited(workspace.id);
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_update_file',
      targetType: 'workspace',
      targetId: `${workspace.id}:${body.path}`,
    });
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(updated) });
  });

  app.post('/api/v1/publisher/edit-workspaces/:workspaceId/files', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = createFileBodySchema.parse(request.body);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    assertMutableWorkspace(workspace, body.baseRevision);
    if (body.kind === 'directory') {
      await createWorkspaceDirectory(workspaceFilesRoot(store.dataRoot, workspace.id), body.path);
    } else {
      await writeWorkspaceTextFile({
        filesRoot: workspaceFilesRoot(store.dataRoot, workspace.id),
        filePath: body.path,
        content: body.content ?? '',
        createOnly: true,
      });
    }
    const updated = await markWorkspaceEdited(workspace.id);
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_update_file',
      targetType: 'workspace',
      targetId: `${workspace.id}:${body.path}`,
    });
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(updated) });
  });

  app.post('/api/v1/publisher/edit-workspaces/:workspaceId/files/upload', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const upload = await request.file();
    if (!upload) {
      throw new HttpError(400, 'File is required');
    }
    const filePath = readMultipartField(upload.fields, 'path') ?? upload.filename;
    const baseRevisionRaw = readMultipartField(upload.fields, 'baseRevision');
    const baseRevision = Number(baseRevisionRaw);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new HttpError(400, 'baseRevision is required');
    }
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    assertMutableWorkspace(workspace, baseRevision);
    await writeWorkspaceBinaryFile({
      filesRoot: workspaceFilesRoot(store.dataRoot, workspace.id),
      filePath,
      buffer: await upload.toBuffer(),
    });
    const updated = await markWorkspaceEdited(workspace.id);
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_update_file',
      targetType: 'workspace',
      targetId: `${workspace.id}:${filePath}`,
    });
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(updated) });
  });

  app.patch('/api/v1/publisher/edit-workspaces/:workspaceId/files/move', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = moveFileBodySchema.parse(request.body);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    assertMutableWorkspace(workspace, body.baseRevision);
    await moveWorkspaceEntry({
      filesRoot: workspaceFilesRoot(store.dataRoot, workspace.id),
      from: body.from,
      to: body.to,
    });
    const updated = await markWorkspaceEdited(workspace.id);
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_update_file',
      targetType: 'workspace',
      targetId: `${workspace.id}:${body.from}->${body.to}`,
    });
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(updated) });
  });

  app.delete('/api/v1/publisher/edit-workspaces/:workspaceId/files', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const query = pathQuerySchema.parse(request.query);
    const baseRevision = Number((request.query as { baseRevision?: unknown }).baseRevision);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new HttpError(400, 'baseRevision is required');
    }
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    assertMutableWorkspace(workspace, baseRevision);
    const filePath = normalizeWorkspacePath(query.path);
    await deleteWorkspaceEntry(workspaceFilesRoot(store.dataRoot, workspace.id), filePath);
    const updated = await markWorkspaceEdited(workspace.id);
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_delete_file',
      targetType: 'workspace',
      targetId: `${workspace.id}:${filePath}`,
    });
    return marketEditWorkspaceResponseSchema.parse({ workspace: publicWorkspace(updated) });
  });

  app.post('/api/v1/publisher/edit-workspaces/:workspaceId/validate', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    const build = await validateWorkspaceBuild({
      workspace,
      targetVersion: workspace.targetVersion,
      channel: 'public',
    });
    const updated = await storeWorkspaceValidation(workspace.id, build);
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_validate',
      targetType: 'workspace',
      targetId: workspace.id,
    });
    return {
      workspace: publicWorkspace(updated),
      validation: build.report.validation,
      manifest: build.report.manifest,
      fileEntries: build.report.fileEntries,
    };
  });

  app.post('/api/v1/publisher/edit-workspaces/:workspaceId/submit', async (request, reply) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = notesBodySchema.parse(request.body ?? {});
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    if (!canPublishFor(user, workspace.publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }

    const build = await validateWorkspaceBuild({
      workspace,
      targetVersion: workspace.targetVersion,
      channel: 'public',
    });
    const updatedWorkspace = await storeWorkspaceValidation(workspace.id, build);
    if (!build.report.validation.valid || !build.report.manifest) {
      return reply.code(400).send({
        error: 'Workspace validation must pass before review',
        workspace: publicWorkspace(updatedWorkspace),
        validation: build.report.validation,
      });
    }

    const submission = await store.createSubmission({
      userId: user.id,
      manifest: build.report.manifest,
      packageInfo: build.report.packageInfo,
      packagePath: build.packagePath,
      fileEntries: build.report.fileEntries,
      validation: build.report.validation,
      releaseNotes: body.releaseNotes,
      changeNotes: body.changeNotes,
    });
    const submitted = await store.updateSubmission(submission.id, (current) => {
      current.status = 'pending_review';
      current.submittedAt = nowIso();
    });
    const finalWorkspace = await store.update((data) => {
      const current = data.editWorkspaces.find((entry) => entry.id === workspace.id);
      if (!current) {
        throw new HttpError(404, 'Workspace not found');
      }
      current.status = 'submitted';
      current.submissionId = submission.id;
      current.updatedAt = nowIso();
      return current;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'edit_workspace_submit',
      targetType: 'workspace',
      targetId: workspace.id,
    });
    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, submitted!),
      workspace: publicWorkspace(finalWorkspace),
    });
  });

  app.get('/api/v1/publisher/edit-workspaces/:workspaceId/dev-releases', async (request) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    const data = await store.read();
    return marketDevReleaseListResponseSchema.parse({
      devReleases: data.devReleases
        .filter((release) => release.sourceWorkspaceId === workspace.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicDevRelease),
    });
  });

  app.post('/api/v1/publisher/edit-workspaces/:workspaceId/dev-releases', async (request, reply) => {
    const user = await requireUser(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = createDevReleaseBodySchema.parse(request.body ?? {});
    const workspace = await getWorkspace(workspaceId);
    assertWorkspaceAccess(user, workspace);
    if (!canPublishFor(user, workspace.publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }

    const targetVersion = body.version ?? workspace.targetVersion;
    const build = await validateWorkspaceBuild({
      workspace,
      targetVersion,
      channel: 'dev',
    });
    const updatedWorkspace = await storeWorkspaceValidation(workspace.id, build);
    if (!build.report.validation.valid || !build.report.manifest) {
      return reply.code(400).send({
        error: 'Workspace validation must pass before creating a development version',
        workspace: publicWorkspace(updatedWorkspace),
        validation: build.report.validation,
      });
    }

    const targetDir = devReleaseDir(store.dataRoot, workspace.publisher, workspace.name, targetVersion);
    await ensureDirectoryAbsent(targetDir);
    await mkdir(targetDir, { recursive: true });
    const targetPackagePath = path.join(targetDir, 'package.tgz');
    const targetManifestPath = path.join(targetDir, 'manifest.json');
    await copyFile(build.packagePath, targetPackagePath);
    await writeFile(targetManifestPath, `${JSON.stringify(build.report.manifest, null, 2)}\n`, 'utf8');

    const expiresAt = body.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const now = nowIso();
    const release = await store.update((data) => {
      const stored: StoredDevRelease = {
        id: `dev_${randomUUID()}`,
        status: 'active',
        skillId: workspace.skillId,
        publisher: workspace.publisher,
        name: workspace.name,
        version: targetVersion,
        sourceWorkspaceId: workspace.id,
        sourceVersion: workspace.sourceVersion,
        package: {
          ...build.report.packageInfo,
          filename: 'package.tgz',
        },
        packageUrl: makePackageUrl(workspace.publisher, workspace.name, targetVersion),
        validation: build.report.validation,
        fileEntries: build.report.fileEntries,
        createdBy: user.id,
        createdAt: now,
        expiresAt,
        packagePath: targetPackagePath,
        manifestPath: targetManifestPath,
      };
      data.devReleases.push(stored);
      const current = data.editWorkspaces.find((entry) => entry.id === workspace.id);
      if (current) {
        current.devReleaseIds.push(stored.id);
        current.updatedAt = now;
      }
      return stored;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'dev_release_create',
      targetType: 'dev_release',
      targetId: release.id,
    });

    return reply.code(201).send(marketDevReleaseResponseSchema.parse({
      devRelease: publicDevRelease(release),
      latestDevVersion: await latestDevVersion(workspace.publisher, workspace.name),
    }));
  });

  app.post('/api/v1/publisher/dev-releases/:devReleaseId/revoke', async (request) => {
    const user = await requireUser(request);
    const { devReleaseId } = parseDevReleaseParams(request.params);
    const body = optionalReasonBodySchema.parse(request.body ?? {});
    const data = await store.read();
    const release = data.devReleases.find((entry) => entry.id === devReleaseId);
    if (!release) {
      throw new HttpError(404, 'Development version not found');
    }
    if (!canPublishFor(user, release.publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }
    const updated = await store.update((currentData) => {
      const current = currentData.devReleases.find((entry) => entry.id === devReleaseId);
      if (!current) {
        throw new HttpError(404, 'Development version not found');
      }
      current.status = 'revoked';
      current.revokedAt = nowIso();
      current.revokeReason = body.reason;
      return current;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'dev_release_revoke',
      targetType: 'dev_release',
      targetId: updated.id,
      reason: body.reason,
    });
    return marketDevReleaseResponseSchema.parse({
      devRelease: publicDevRelease(updated),
      latestDevVersion: await latestDevVersion(updated.publisher, updated.name),
    });
  });

  app.post('/api/v1/publisher/dev-keys', async (request, reply) => {
    const user = await requireUser(request);
    const body = createDeveloperKeyBodySchema.parse(request.body);
    const { publisher, name } = splitSkillId(body.skillId);
    if (!canPublishFor(user, publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }
    await findSkill(registryRoot, publisher, name);

    const secret = `skdev_${randomBytes(32).toString('base64url')}`;
    const now = nowIso();
    const key = await store.update((data) => {
      const stored: StoredDeveloperKey = {
        id: `devkey_${randomUUID()}`,
        name: body.name,
        secret,
        keyHash: hashDeveloperKey(secret),
        scopes: ['dev:read'],
        skillId: body.skillId,
        createdBy: user.id,
        createdAt: now,
        expiresAt: body.expiresAt,
      };
      data.developerKeys.push(stored);
      return stored;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'dev_key_create',
      targetType: 'developer_key',
      targetId: key.id,
    });

    return reply.code(201).send(marketDeveloperKeyResponseSchema.parse({
      developerKey: publicDeveloperKey(key),
    }));
  });

  app.get('/api/v1/publisher/dev-keys', async (request) => {
    const user = await requireUser(request);
    const query = z.object({ skillId: skillIdSchema.optional() }).parse(request.query);
    const data = await store.read();
    const keys = data.developerKeys
      .filter((key) => !query.skillId || key.skillId === query.skillId)
      .filter((key) => {
        if (key.skillId) {
          return canPublishFor(user, splitSkillId(key.skillId).publisher);
        }
        return key.publisher ? canPublishFor(user, key.publisher) : user.roles.includes('admin');
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(publicDeveloperKey);
    return marketDeveloperKeyListResponseSchema.parse({ developerKeys: keys });
  });

  app.post('/api/v1/publisher/dev-keys/:keyId/revoke', async (request) => {
    const user = await requireUser(request);
    const { keyId } = parseDeveloperKeyParams(request.params);
    const data = await store.read();
    const key = data.developerKeys.find((entry) => entry.id === keyId);
    if (!key) {
      throw new HttpError(404, 'Developer key not found');
    }
    const keyPublisher = key.skillId ? splitSkillId(key.skillId).publisher : key.publisher;
    if (!canPublishFor(user, keyPublisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }
    const updated = await store.update((currentData) => {
      const current = currentData.developerKeys.find((entry) => entry.id === keyId);
      if (!current) {
        throw new HttpError(404, 'Developer key not found');
      }
      current.revokedAt = nowIso();
      return current;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'dev_key_revoke',
      targetType: 'developer_key',
      targetId: updated.id,
    });
    return marketDeveloperKeyResponseSchema.parse({ developerKey: publicDeveloperKey(updated) });
  });

  app.get('/api/v1/dev/skills/:publisher/:name', async (request) => {
    const { publisher, name } = parseSkillParams(request.params);
    await assertDevKeyAccess(request, publisher, name);
    const active = await activeDevReleases(publisher, name);
    return marketDevReleaseListResponseSchema.parse({
      devReleases: active.map(publicDevRelease),
    });
  });

  app.get('/api/v1/dev/skills/:publisher/:name/versions', async (request) => {
    const { publisher, name } = parseSkillParams(request.params);
    await assertDevKeyAccess(request, publisher, name);
    const active = await activeDevReleases(publisher, name);
    return marketDevReleaseListResponseSchema.parse({
      devReleases: active.map(publicDevRelease),
    });
  });

  app.get('/api/v1/dev/skills/:publisher/:name/versions/:version/manifest', async (request) => {
    const { publisher, name } = parseSkillParams(request.params);
    const version = (request.params as { version?: string }).version;
    if (!version) {
      throw new HttpError(400, 'Version is required');
    }
    await assertDevKeyAccess(request, publisher, name);
    const release = await resolveDevRelease(publisher, name, version);
    return skillManifestSchema.parse(JSON.parse(await readFile(release.manifestPath, 'utf8')));
  });

  app.get('/api/v1/dev/skills/:publisher/:name/versions/:version/package', async (request, reply) => {
    const { publisher, name } = parseSkillParams(request.params);
    const version = (request.params as { version?: string }).version;
    if (!version) {
      throw new HttpError(400, 'Version is required');
    }
    await assertDevKeyAccess(request, publisher, name);
    const release = await resolveDevRelease(publisher, name, version);
    return reply
      .type(release.package.contentType)
      .header('content-disposition', 'attachment; filename="package.tgz"')
      .header('content-length', String(release.package.sizeBytes))
      .header('x-skill-id', `${publisher}/${name}`)
      .header('x-skill-version', release.version)
      .header('x-skill-sha256', release.package.checksumSha256)
      .header('x-skill-channel', 'dev')
      .send(createReadStream(release.packagePath));
  });

  app.post('/api/v1/publisher/submissions', async (request, reply) => {
    const user = await requireUser(request);
    const upload = await request.file();
    if (!upload) {
      return reply.code(400).send({ error: 'Package file is required' });
    }

    const filename = path.basename(upload.filename);
    const format = packageFormatFromFilename(filename) ?? 'tgz';
    const submissionId = `upload_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const submissionDir = path.join(store.uploadsRoot, submissionId);
    await mkdir(submissionDir, { recursive: true });
    const packagePath = path.join(submissionDir, `package.${packageExtensionFor(format)}`);
    const buffer = await upload.toBuffer();
    await writeFile(packagePath, buffer);

    const report = await validateSkillPackage(packagePath, filename);
    let validation = report.validation;
    if (report.manifest) {
      const { publisher, name } = splitSkillId(report.manifest.id);
      if (!canPublishFor(user, publisher)) {
        validation = addValidationError(
          validation,
          'publisher_permission_denied',
          `User is not allowed to publish under publisher "${publisher}".`,
        );
      }
      if (await directoryExists(versionDir(registryRoot, publisher, name, report.manifest.version))) {
        validation = addValidationError(
          validation,
          'version_exists',
          'This publisher/name/version already exists and cannot be overwritten.',
        );
      }
    }

    const submission = await store.createSubmission({
      userId: user.id,
      manifest: report.manifest,
      packageInfo: report.packageInfo,
      packagePath,
      fileEntries: report.fileEntries,
      validation,
      releaseNotes: readMultipartField(upload.fields, 'releaseNotes'),
      changeNotes: readMultipartField(upload.fields, 'changeNotes'),
    });

    return reply.code(201).send(marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, submission),
    }));
  });

  app.get('/api/v1/publisher/submissions', async (request) => {
    const user = await requireUser(request);
    const query = marketSubmissionListQuerySchema.parse(request.query);
    const submissions = await store.listSubmissions({ userId: user.id, status: query.status });
    return marketSubmissionListResponseSchema.parse({
      submissions: await publicSubmissions(store, submissions),
    });
  });

  app.get('/api/v1/publisher/submissions/:submissionId', async (request) => {
    const user = await requireUser(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    if (submission.userId !== user.id && !user.roles.includes('admin')) {
      throw new HttpError(403, 'Submission access denied');
    }
    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, submission),
    });
  });

  app.post('/api/v1/publisher/submissions/:submissionId/submit', async (request) => {
    const user = await requireUser(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const body = notesBodySchema.parse(request.body ?? {});
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    if (submission.userId !== user.id) {
      throw new HttpError(403, 'Submission access denied');
    }
    if (!['draft', 'rejected'].includes(submission.status)) {
      throw new HttpError(409, 'Only draft or rejected submissions can be submitted');
    }
    if (!submission.validation.valid || !submission.manifest || !submission.publisher || !submission.name || !submission.version) {
      throw new HttpError(400, 'Submission validation must pass before review');
    }
    if (!canPublishFor(user, submission.publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }
    if (await directoryExists(versionDir(registryRoot, submission.publisher, submission.name, submission.version))) {
      throw new HttpError(409, 'Version already exists');
    }

    const updated = await store.updateSubmission(submission.id, (current) => {
      current.status = 'pending_review';
      current.releaseNotes = body.releaseNotes ?? current.releaseNotes;
      current.changeNotes = body.changeNotes ?? current.changeNotes;
      current.reviewReason = undefined;
      current.reviewedAt = undefined;
      current.reviewedBy = undefined;
      current.submittedAt = new Date().toISOString();
    });

    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, updated!),
    });
  });

  app.post('/api/v1/publisher/submissions/:submissionId/withdraw', async (request) => {
    const user = await requireUser(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    if (submission.userId !== user.id) {
      throw new HttpError(403, 'Submission access denied');
    }
    if (submission.status !== 'pending_review') {
      throw new HttpError(409, 'Only pending submissions can be withdrawn');
    }

    const updated = await store.updateSubmission(submission.id, (current) => {
      current.status = 'withdrawn';
    });
    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, updated!),
    });
  });

  app.delete('/api/v1/publisher/submissions/:submissionId', async (request) => {
    const user = await requireUser(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    if (submission.userId !== user.id) {
      throw new HttpError(403, 'Submission access denied');
    }
    if (!['draft', 'rejected', 'withdrawn'].includes(submission.status)) {
      throw new HttpError(409, 'Only draft, rejected, or withdrawn submissions can be deleted');
    }

    await store.update((data) => {
      data.submissions = data.submissions.filter((entry) => entry.id !== submission.id);
    });
    if (submission.packagePath) {
      await rm(path.dirname(submission.packagePath), { recursive: true, force: true });
    }
    return { ok: true };
  });

  app.get('/api/v1/publisher/skills', async (request) => {
    const user = await requireUser(request);
    const [snapshot, submissions] = await Promise.all([
      scanRegistry(registryRoot),
      store.listSubmissions({ userId: user.id }),
    ]);
    return marketPublisherSkillsResponseSchema.parse({
      skills: snapshot.skills
        .map((skill) => skill.summary)
        .filter((skill) => user.roles.includes('admin') || user.publishers.includes(skill.id.split('/')[0] ?? '')),
      submissions: await publicSubmissions(store, submissions),
    });
  });

  app.get('/api/v1/publisher/skills/:publisher/:name', async (request) => {
    const user = await requireUser(request);
    const { publisher, name } = parseSkillParams(request.params);
    if (!canPublishFor(user, publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }

    let detail = null;
    try {
      detail = await findSkill(registryRoot, publisher, name);
    } catch (error) {
      if (!(error instanceof RegistryNotFoundError)) {
        throw error;
      }
    }

    const submissions = (await store.listSubmissions({ userId: user.id }))
      .filter((submission) => submission.skillId === `${publisher}/${name}`);
    return marketPublisherSkillResponseSchema.parse({
      skill: detail,
      submissions: await publicSubmissions(store, submissions),
    });
  });

  app.post('/api/v1/admin/edit-workspaces/:workspaceId/publish', async (request, reply) => {
    const admin = await requireAdmin(request);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const body = adminPublishBodySchema.parse(request.body ?? {});
    const workspace = await getWorkspace(workspaceId);

    const build = await validateWorkspaceBuild({
      workspace,
      targetVersion: workspace.targetVersion,
      channel: 'public',
    });
    const updatedWorkspace = await storeWorkspaceValidation(workspace.id, build);
    if (!build.report.validation.valid || !build.report.manifest) {
      return reply.code(400).send({
        error: 'Workspace validation must pass before publishing',
        workspace: publicWorkspace(updatedWorkspace),
        validation: build.report.validation,
      });
    }

    const targetDir = versionDir(registryRoot, workspace.publisher, workspace.name, workspace.targetVersion);
    await ensureDirectoryAbsent(targetDir);
    await mkdir(targetDir, { recursive: true });
    await writeFile(
      path.join(targetDir, 'manifest.json'),
      `${JSON.stringify(build.report.manifest, null, 2)}\n`,
      'utf8',
    );
    await copyFile(
      build.packagePath,
      path.join(targetDir, `package.${packageExtensionFor(build.report.packageInfo.format)}`),
    );

    const submission = await store.createSubmission({
      userId: admin.id,
      manifest: build.report.manifest,
      packageInfo: build.report.packageInfo,
      packagePath: build.packagePath,
      fileEntries: build.report.fileEntries,
      validation: build.report.validation,
      releaseNotes: body.releaseNotes,
      changeNotes: body.changeNotes,
    });
    const now = nowIso();
    const published = await store.updateSubmission(submission.id, (current) => {
      current.status = 'published';
      current.reviewReason = body.reason;
      current.reviewedBy = admin.id;
      current.reviewedAt = now;
      current.publishedAt = now;
    });
    await store.update((data) => {
      const current = data.editWorkspaces.find((entry) => entry.id === workspace.id);
      if (current) {
        current.status = 'published';
        current.submissionId = submission.id;
        current.updatedAt = now;
      }
    });
    await store.addAuditLog({
      actorUserId: admin.id,
      action: 'edit_workspace_publish',
      targetType: 'workspace',
      targetId: workspace.id,
      reason: body.reason,
    });
    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, published!),
    });
  });

  app.get('/api/v1/admin/reviews', async (request) => {
    await requireAdmin(request);
    const query = marketSubmissionListQuerySchema.parse(request.query);
    const submissions = await store.listSubmissions({ status: query.status ?? 'pending_review' });
    return marketSubmissionListResponseSchema.parse({
      submissions: await publicSubmissions(store, submissions),
    });
  });

  app.get('/api/v1/admin/reviews/:submissionId', async (request) => {
    await requireAdmin(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, submission),
    });
  });

  app.post('/api/v1/admin/reviews/:submissionId/approve', async (request) => {
    const admin = await requireAdmin(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const body = optionalReasonBodySchema.parse(request.body ?? {});
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    if (submission.status !== 'pending_review') {
      throw new HttpError(409, 'Only pending submissions can be approved');
    }
    if (!submission.validation.valid || !submission.manifest || !submission.package || !submission.packagePath) {
      throw new HttpError(400, 'Submission validation must pass before approval');
    }

    const { publisher, name } = splitSkillId(submission.manifest.id);
    const targetDir = versionDir(registryRoot, publisher, name, submission.manifest.version);
    await ensureDirectoryAbsent(targetDir);
    await mkdir(targetDir, { recursive: true });
    await writeFile(
      path.join(targetDir, 'manifest.json'),
      `${JSON.stringify(submission.manifest, null, 2)}\n`,
      'utf8',
    );
    await copyFile(
      submission.packagePath,
      path.join(targetDir, `package.${packageExtensionFor(submission.package.format)}`),
    );

    const now = new Date().toISOString();
    const updated = await store.updateSubmission(submission.id, (current) => {
      current.status = 'published';
      current.reviewReason = body.reason;
      current.reviewedBy = admin.id;
      current.reviewedAt = now;
      current.publishedAt = now;
    });
    await store.addAuditLog({
      actorUserId: admin.id,
      action: 'approve',
      targetType: 'submission',
      targetId: submission.id,
      reason: body.reason,
    });

    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, updated!),
    });
  });

  app.post('/api/v1/admin/reviews/:submissionId/reject', async (request) => {
    const admin = await requireAdmin(request);
    const submissionId = (request.params as { submissionId?: string }).submissionId;
    const body = reasonBodySchema.parse(request.body);
    const submission = submissionId ? await store.getSubmission(submissionId) : undefined;
    if (!submission) {
      throw new HttpError(404, 'Submission not found');
    }
    if (submission.status !== 'pending_review') {
      throw new HttpError(409, 'Only pending submissions can be rejected');
    }

    const now = new Date().toISOString();
    const updated = await store.updateSubmission(submission.id, (current) => {
      current.status = 'rejected';
      current.reviewReason = body.reason;
      current.reviewedBy = admin.id;
      current.reviewedAt = now;
    });
    await store.addAuditLog({
      actorUserId: admin.id,
      action: 'reject',
      targetType: 'submission',
      targetId: submission.id,
      reason: body.reason,
    });

    return marketSubmissionResponseSchema.parse({
      submission: await publicSubmission(store, updated!),
    });
  });

  app.post('/api/v1/admin/skills/:publisher/:name/versions/:version/remove', async (request) => {
    const admin = await requireAdmin(request);
    const { publisher, name, version } = parseVersionParams(request.params);
    const body = reasonBodySchema.parse(request.body);
    const targetDir = versionDir(registryRoot, publisher, name, version);
    if (!(await directoryExists(targetDir))) {
      throw new HttpError(404, 'Version not found');
    }

    const now = new Date().toISOString();
    await writeFile(
      path.join(targetDir, 'removed.json'),
      `${JSON.stringify({ reason: body.reason, removedBy: admin.id, removedAt: now }, null, 2)}\n`,
      'utf8',
    );
    await store.update((data) => {
      for (const submission of data.submissions) {
        if (submission.skillId === `${publisher}/${name}` && submission.version === version && submission.status === 'published') {
          submission.status = 'removed';
          submission.removedAt = now;
          submission.reviewReason = body.reason;
          submission.updatedAt = now;
        }
      }
    });
    await store.addAuditLog({
      actorUserId: admin.id,
      action: 'remove',
      targetType: 'version',
      targetId: `${publisher}/${name}@${version}`,
      reason: body.reason,
    });
    return { ok: true };
  });

  app.post('/api/v1/admin/skills/:publisher/:name/versions/:version/restore', async (request) => {
    const admin = await requireAdmin(request);
    const { publisher, name, version } = parseVersionParams(request.params);
    const targetDir = versionDir(registryRoot, publisher, name, version);
    if (!(await directoryExists(targetDir))) {
      throw new HttpError(404, 'Version not found');
    }

    await unlink(path.join(targetDir, 'removed.json')).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }
      throw error;
    });
    const now = new Date().toISOString();
    await store.update((data) => {
      for (const submission of data.submissions) {
        if (submission.skillId === `${publisher}/${name}` && submission.version === version && submission.status === 'removed') {
          submission.status = 'published';
          submission.updatedAt = now;
          submission.removedAt = undefined;
        }
      }
    });
    await store.addAuditLog({
      actorUserId: admin.id,
      action: 'restore',
      targetType: 'version',
      targetId: `${publisher}/${name}@${version}`,
    });
    return { ok: true };
  });

  app.post('/api/v1/admin/skills/:publisher/:name/feature', async (request) => {
    await requireAdmin(request);
    const { publisher, name } = parseSkillParams(request.params);
    await findSkill(registryRoot, publisher, name);
    await store.update((data) => {
      const id = `${publisher}/${name}`;
      if (!data.featuredSkillIds.includes(id)) {
        data.featuredSkillIds.push(id);
      }
    });
    return { ok: true };
  });

  app.post('/api/v1/admin/skills/:publisher/:name/unfeature', async (request) => {
    await requireAdmin(request);
    const { publisher, name } = parseSkillParams(request.params);
    await store.update((data) => {
      data.featuredSkillIds = data.featuredSkillIds.filter((id) => id !== `${publisher}/${name}`);
    });
    return { ok: true };
  });

  // Publish Keys

  app.post('/api/v1/publisher/publish-keys', async (request, reply) => {
    const user = await requireUser(request);
    const body = createPublishKeyBodySchema.parse(request.body);
    if (!canPublishFor(user, body.publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }

    const secret = `skpub_${randomBytes(32).toString('base64url')}`;
    const now = nowIso();
    const key = await store.update((data) => {
      const stored: StoredPublishKey = {
        id: `pubkey_${randomUUID()}`,
        name: body.name,
        secret,
        keyHash: hashPublishKey(secret),
        publisher: body.publisher,
        createdBy: user.id,
        createdAt: now,
        expiresAt: body.expiresAt,
      };
      data.publishKeys.push(stored);
      return stored;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'publish_key_create',
      targetType: 'publish_key',
      targetId: key.id,
    });

    return reply.code(201).send(marketPublishKeyResponseSchema.parse({
      publishKey: publicPublishKey(key, secret),
    }));
  });

  app.get('/api/v1/publisher/publish-keys', async (request) => {
    const user = await requireUser(request);
    const query = z.object({ publisher: skillNameSchema.optional() }).parse(request.query);
    const data = await store.read();
    const keys = data.publishKeys
      .filter((key) => !query.publisher || key.publisher === query.publisher)
      .filter((key) => canPublishFor(user, key.publisher))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((key) => publicPublishKey(key));
    return marketPublishKeyListResponseSchema.parse({ publishKeys: keys });
  });

  app.post('/api/v1/publisher/publish-keys/:keyId/revoke', async (request) => {
    const user = await requireUser(request);
    const keyId = (request.params as { keyId?: string }).keyId;
    if (!keyId) {
      throw new HttpError(400, 'Key id is required');
    }
    const data = await store.read();
    const key = data.publishKeys.find((entry) => entry.id === keyId);
    if (!key) {
      throw new HttpError(404, 'Publish key not found');
    }
    if (!canPublishFor(user, key.publisher)) {
      throw new HttpError(403, 'Publisher access denied');
    }
    const updated = await store.update((current) => {
      const stored = current.publishKeys.find((entry) => entry.id === keyId);
      if (!stored) {
        throw new HttpError(404, 'Publish key not found');
      }
      stored.revokedAt = nowIso();
      return stored;
    });
    await store.addAuditLog({
      actorUserId: user.id,
      action: 'publish_key_revoke',
      targetType: 'publish_key',
      targetId: updated.id,
    });
    return marketPublishKeyResponseSchema.parse({ publishKey: publicPublishKey(updated) });
  });

  // skill-market discovery endpoint

  app.get('/.well-known/skill-market.md', async (request, reply) => {
    const host = request.headers.host ?? 'localhost:3100';
    const proto = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const baseUrl = `${proto}://${host}`;

    const content = generateMarketMd(baseUrl);
    return reply
      .type('text/markdown; charset=utf-8')
      .header('cache-control', 'public, max-age=60')
      .send(content);
  });

  app.get('/market.md', async (_request, reply) => {
    return reply.redirect('/.well-known/skill-market.md', 301);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }

    if (error instanceof EditorArchiveError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }

    if (error instanceof RegistryNotFoundError) {
      return reply.code(404).send({ error: error.message });
    }

    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Invalid request or registry data', details: error.issues });
    }

    if (error instanceof Error && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ error: `Package exceeds ${uploadMaxBytes} bytes` });
    }

    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  return app;
};
