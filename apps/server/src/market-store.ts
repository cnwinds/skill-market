import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  type MarketAuthUser,
  type MarketDevRelease,
  type MarketDeveloperKey,
  type MarketEditWorkspace,
  type MarketPackageFileEntry,
  type MarketPackageInfo,
  type MarketPackageValidation,
  type MarketPublishKey,
  type MarketSubmission,
  type MarketSubmissionStatus,
  type MarketUserRole,
  type SkillManifest,
  marketAuthUserSchema,
  marketSubmissionSchema,
  skillNameSchema,
} from '@qizhi/skill-spec';

const scrypt = promisify(scryptCallback);

export type StoredUser = MarketAuthUser & {
  passwordHash: string;
  passwordSalt: string;
};

export type StoredSession = {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type StoredSubmission = Omit<MarketSubmission, 'user'> & {
  userId: string;
  packagePath?: string;
};

export type StoredEditWorkspace = MarketEditWorkspace & {
  ownerUserId: string;
  rootPath: string;
};

export type StoredDevRelease = MarketDevRelease & {
  packagePath: string;
  manifestPath: string;
};

export type StoredDeveloperKey = MarketDeveloperKey & {
  keyHash: string;
};

export type StoredPublishKey = Omit<MarketPublishKey, 'secret'> & {
  keyHash: string;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  createdAt: string;
};

export type MarketData = {
  users: StoredUser[];
  sessions: StoredSession[];
  submissions: StoredSubmission[];
  editWorkspaces: StoredEditWorkspace[];
  devReleases: StoredDevRelease[];
  developerKeys: StoredDeveloperKey[];
  publishKeys: StoredPublishKey[];
  featuredSkillIds: string[];
  auditLogs: AuditLogEntry[];
};

export type NewSubmissionInput = {
  userId: string;
  manifest?: SkillManifest;
  packageInfo?: MarketPackageInfo;
  packagePath?: string;
  fileEntries: MarketPackageFileEntry[];
  validation: MarketPackageValidation;
  releaseNotes?: string;
  changeNotes?: string;
};

const emptyData = (): MarketData => ({
  users: [],
  sessions: [],
  submissions: [],
  editWorkspaces: [],
  devReleases: [],
  developerKeys: [],
  publishKeys: [],
  featuredSkillIds: [],
  auditLogs: [],
});

const toIso = (date = new Date()): string => date.toISOString();

const sha256 = (input: string): string => createHash('sha256').update(input).digest('hex');

const hashPassword = async (password: string, salt = randomBytes(16).toString('hex')) => {
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString('hex') };
};

const normalizeData = (input: Partial<MarketData>): MarketData => ({
  users: input.users ?? [],
  sessions: input.sessions ?? [],
  submissions: input.submissions ?? [],
  editWorkspaces: input.editWorkspaces ?? [],
  devReleases: input.devReleases ?? [],
  developerKeys: input.developerKeys ?? [],
  publishKeys: input.publishKeys ?? [],
  featuredSkillIds: input.featuredSkillIds ?? [],
  auditLogs: input.auditLogs ?? [],
});

const toPublicUser = (user: StoredUser): MarketAuthUser =>
  marketAuthUserSchema.parse({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    publishers: user.publishers,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

const baseSlug = (input: string): string => {
  const normalized = input
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const slug = normalized.length >= 2 ? normalized : `${normalized || 'user'}-publisher`;
  return skillNameSchema.safeParse(slug).success ? slug : 'user-publisher';
};

const uniquePublisherSlug = (requested: string | undefined, users: StoredUser[]): string => {
  const parsed = requested ? skillNameSchema.safeParse(requested) : undefined;
  const root = parsed?.success ? parsed.data : baseSlug(requested ?? 'user-publisher');
  const used = new Set(users.flatMap((user) => user.publishers));
  if (!used.has(root)) {
    return root;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${root}-${index}`;
    if (skillNameSchema.safeParse(candidate).success && !used.has(candidate)) {
      return candidate;
    }
  }

  return `${root}-${randomBytes(3).toString('hex')}`;
};

export class MarketStore {
  readonly dataRoot: string;
  readonly uploadsRoot: string;

  private readonly dataFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dataRoot: string) {
    this.dataRoot = dataRoot;
    this.uploadsRoot = path.join(dataRoot, 'uploads');
    this.dataFile = path.join(dataRoot, 'market.json');
  }

  async read(): Promise<MarketData> {
    try {
      return normalizeData(JSON.parse(await readFile(this.dataFile, 'utf8')) as Partial<MarketData>);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return emptyData();
      }
      throw error;
    }
  }

  async update<T>(mutator: (data: MarketData) => T | Promise<T>): Promise<T> {
    let result: T;
    const run = this.writeQueue.then(async () => {
      const data = await this.read();
      result = await mutator(data);
      await mkdir(this.uploadsRoot, { recursive: true });
      await writeFile(this.dataFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    });

    this.writeQueue = run.catch(() => undefined);
    await run;
    return result!;
  }

  async createUser(input: {
    email: string;
    password: string;
    displayName?: string;
    publisher?: string;
  }): Promise<{ user: MarketAuthUser; token: string }> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName?.trim() || email;
    const { salt, hash } = await hashPassword(input.password);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);

    const user = await this.update((data) => {
      if (data.users.some((existing) => existing.email === email)) {
        throw new Error('EMAIL_EXISTS');
      }

      const now = toIso();
      const roles: MarketUserRole[] = data.users.length === 0 ? ['publisher', 'admin'] : ['publisher'];
      const publisher = uniquePublisherSlug(input.publisher ?? email, data.users);
      const stored: StoredUser = {
        id: `user_${randomUUID()}`,
        email,
        displayName,
        roles,
        publishers: [publisher],
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        updatedAt: now,
      };

      data.users.push(stored);
      data.sessions.push({
        tokenHash,
        userId: stored.id,
        createdAt: now,
        expiresAt: toIso(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      });
      return toPublicUser(stored);
    });

    return { user, token };
  }

  async login(emailInput: string, password: string): Promise<{ user: MarketAuthUser; token: string } | null> {
    const email = emailInput.trim().toLowerCase();
    const data = await this.read();
    const found = data.users.find((user) => user.email === email);
    if (!found) {
      return null;
    }

    const { hash } = await hashPassword(password, found.passwordSalt);
    const left = Buffer.from(hash, 'hex');
    const right = Buffer.from(found.passwordHash, 'hex');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null;
    }

    return { user: toPublicUser(found), token: await this.createSession(found.id) };
  }

  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const now = toIso();
    await this.update((current) => {
      current.sessions.push({
        tokenHash,
        userId,
        createdAt: now,
        expiresAt: toIso(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      });
    });

    return token;
  }

  async getUserByToken(token: string | undefined): Promise<MarketAuthUser | null> {
    if (!token) {
      return null;
    }

    const data = await this.read();
    const tokenHash = sha256(token);
    const session = data.sessions.find((entry) => entry.tokenHash === tokenHash);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      return null;
    }

    const user = data.users.find((entry) => entry.id === session.userId);
    return user ? toPublicUser(user) : null;
  }

  async revokeToken(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = sha256(token);
    await this.update((data) => {
      data.sessions = data.sessions.filter((session) => session.tokenHash !== tokenHash);
    });
  }

  async getPublicUser(userId: string): Promise<MarketAuthUser | undefined> {
    const data = await this.read();
    const user = data.users.find((entry) => entry.id === userId);
    return user ? toPublicUser(user) : undefined;
  }

  async listPublicUsers(): Promise<Map<string, MarketAuthUser>> {
    const data = await this.read();
    return new Map(data.users.map((user) => [user.id, toPublicUser(user)]));
  }

  async createSubmission(input: NewSubmissionInput): Promise<StoredSubmission> {
    return this.update((data) => {
      const now = toIso();
      const [publisher, skillName] = input.manifest?.id.split('/') ?? [];
      const parsed = marketSubmissionSchema.omit({ user: true }).parse({
        id: `sub_${randomUUID()}`,
        status: 'draft',
        skillId: input.manifest?.id,
        publisher,
        name: skillName,
        version: input.manifest?.version,
        manifest: input.manifest,
        package: input.packageInfo,
        fileEntries: input.fileEntries,
        validation: input.validation,
        releaseNotes: input.releaseNotes,
        changeNotes: input.changeNotes,
        createdAt: now,
        updatedAt: now,
      });
      const submission: StoredSubmission = {
        ...parsed,
        userId: input.userId,
        packagePath: input.packagePath,
      };
      data.submissions.push(submission);
      return submission;
    });
  }

  async getSubmission(id: string): Promise<StoredSubmission | undefined> {
    const data = await this.read();
    return data.submissions.find((submission) => submission.id === id);
  }

  async listSubmissions(filter: {
    userId?: string;
    status?: MarketSubmissionStatus;
  } = {}): Promise<StoredSubmission[]> {
    const data = await this.read();
    return data.submissions
      .filter((submission) => !filter.userId || submission.userId === filter.userId)
      .filter((submission) => !filter.status || submission.status === filter.status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateSubmission(
    id: string,
    updater: (submission: StoredSubmission, data: MarketData) => void,
  ): Promise<StoredSubmission | undefined> {
    return this.update((data) => {
      const submission = data.submissions.find((entry) => entry.id === id);
      if (!submission) {
        return undefined;
      }
      updater(submission, data);
      submission.updatedAt = toIso();
      return submission;
    });
  }

  async addAuditLog(input: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
  }): Promise<void> {
    await this.update((data) => {
      data.auditLogs.push({
        id: `audit_${randomUUID()}`,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        createdAt: toIso(),
      });
    });
  }
}

export const publicSubmission = async (
  store: MarketStore,
  submission: StoredSubmission,
): Promise<MarketSubmission> => {
  const user = await store.getPublicUser(submission.userId);
  return marketSubmissionSchema.parse({
    ...submission,
    user,
    packagePath: undefined,
    userId: undefined,
  });
};

export const publicSubmissions = async (
  store: MarketStore,
  submissions: StoredSubmission[],
): Promise<MarketSubmission[]> => {
  const users = await store.listPublicUsers();
  return submissions.map((submission) => marketSubmissionSchema.parse({
    ...submission,
    user: users.get(submission.userId),
    packagePath: undefined,
    userId: undefined,
  }));
};

export const canPublishFor = (user: MarketAuthUser, publisher: string | undefined): boolean => {
  if (!publisher) {
    return false;
  }
  return user.roles.includes('admin') || user.publishers.includes(publisher);
};

export const hashDeveloperKey = (secret: string): string => sha256(secret);

export const hashPublishKey = (secret: string): string => sha256(secret);

export const getUserByPublishKey = async (
  store: MarketStore,
  secret: string | undefined,
): Promise<{ user: MarketAuthUser; key: StoredPublishKey } | null> => {
  if (!secret) {
    return null;
  }
  const data = await store.read();
  const keyHash = hashPublishKey(secret);
  const key = data.publishKeys.find((entry) => entry.keyHash === keyHash);
  if (!key || key.revokedAt) {
    return null;
  }
  if (key.expiresAt && Date.parse(key.expiresAt) <= Date.now()) {
    return null;
  }
  const user = data.users.find((entry) => entry.publishers.includes(key.publisher));
  if (!user) {
    return null;
  }
  await store.update((current) => {
    const stored = current.publishKeys.find((entry) => entry.id === key.id);
    if (stored) {
      stored.lastUsedAt = toIso();
    }
  });
  return { user: toPublicUser(user), key };
};
