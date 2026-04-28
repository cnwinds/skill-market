import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import {
  type MarketAuthUser,
  type MarketPackageValidation,
  type MarketSkillSummary,
  type MarketSkillListQuery,
  marketSkillListResponseSchema,
  marketSkillListQuerySchema,
  marketSkillVersionsResponseSchema,
  marketPublisherSkillResponseSchema,
  marketPublisherSkillsResponseSchema,
  marketSubmissionListQuerySchema,
  marketSubmissionListResponseSchema,
  marketSubmissionResponseSchema,
  semverSchema,
  skillManifestSchema,
  skillNameSchema,
  splitSkillId,
} from '@qizhi/skill-spec';

import { RegistryNotFoundError, findPackageFile, findSkill, scanRegistry } from './registry.js';
import { MarketStore, canPublishFor, publicSubmission, publicSubmissions } from './market-store.js';
import {
  packageExtensionFor,
  packageFormatFromFilename,
  validateSkillPackage,
} from './package-validator.js';

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

const reasonBodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

const optionalReasonBodySchema = z.object({
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

export const createApp = (options: AppOptions = {}): FastifyInstance => {
  const app = Fastify({ logger: options.logger ?? false });
  const registryRoot = options.registryRoot ?? defaultRegistryRoot;
  const store = new MarketStore(options.dataRoot ?? path.join(registryRoot, 'market-data'));
  const uploadMaxBytes = options.uploadMaxBytes ?? defaultUploadMaxBytes;

  app.register(cors, {
    origin: options.corsOrigins ?? defaultCorsOrigins,
    allowedHeaders: ['authorization', 'content-type', 'x-session-token'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.register(multipart, {
    limits: {
      fileSize: uploadMaxBytes,
      files: 1,
    },
  });

  const requireUser = async (request: { headers: Record<string, unknown> }): Promise<MarketAuthUser> => {
    const user = await store.getUserByToken(extractAuthToken(request));
    if (!user) {
      throw new HttpError(401, 'Authentication required');
    }
    return user;
  };

  const requireAdmin = async (request: { headers: Record<string, unknown> }): Promise<MarketAuthUser> => {
    const user = await requireUser(request);
    if (!user.roles.includes('admin')) {
      throw new HttpError(403, 'Admin role required');
    }
    return user;
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

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
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
