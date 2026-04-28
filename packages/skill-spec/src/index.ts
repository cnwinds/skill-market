import { z } from 'zod';

export const SKILL_SPEC_VERSION = '1.0';

export const skillIdSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9-]{1,63}\/[a-z0-9][a-z0-9-]{1,63}$/, 'skill id must be publisher/name');

export const skillNameSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'skill name must be a lowercase slug');

export const semverSchema = z.string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/, 'version must be semver');

export const skillKindSchema = z.enum(['instruction', 'runtime', 'hybrid']);

export const filesystemPermissionSchema = z.enum([
  'session:read',
  'uploads:read',
  'outputs:read',
  'outputs:write',
  'shared:read',
  'tmp:write',
]);

export const skillPermissionsSchema = z.object({
  filesystem: z.array(filesystemPermissionSchema).default([]),
  network: z.union([
    z.boolean(),
    z.object({
      allowedHosts: z.array(z.string().min(1)).default([]),
    }),
  ]).default(false),
  scripts: z.boolean().default(false),
  secrets: z.array(z.string().min(1)).default([]),
});

export const skillRuntimeEntrypointSchema = z.object({
  name: z.string().min(1).default('main'),
  path: z.string().min(1),
  description: z.string().optional(),
});

export const skillRuntimeSchema = z.object({
  type: z.enum(['none', 'python', 'node', 'shell']).default('none'),
  entrypoints: z.array(skillRuntimeEntrypointSchema).default([]),
});

export const skillAuthorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  email: z.string().email().optional(),
});

export const skillCompatibilitySchema = z.object({
  skillchat: z.string().min(1).default('>=0.2.0'),
});

export const skillManifestSchema = z.object({
  skillSpecVersion: z.literal(SKILL_SPEC_VERSION).default(SKILL_SPEC_VERSION),
  id: skillIdSchema,
  name: skillNameSchema,
  displayName: z.string().min(1).max(80).optional(),
  version: semverSchema,
  kind: skillKindSchema,
  description: z.string().min(1).max(500),
  author: skillAuthorSchema,
  license: z.string().min(1).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  categories: z.array(z.string().min(1).max(40)).max(10).default([]),
  compatibility: skillCompatibilitySchema.default({ skillchat: '>=0.2.0' }),
  permissions: skillPermissionsSchema.default({
    filesystem: [],
    network: false,
    scripts: false,
    secrets: [],
  }),
  runtime: skillRuntimeSchema.default({
    type: 'none',
    entrypoints: [],
  }),
  starterPrompts: z.array(z.string().min(1).max(300)).max(12).default([]),
  assets: z.object({
    icon: z.string().optional(),
    screenshots: z.array(z.string()).max(8).default([]),
  }).default({
    screenshots: [],
  }),
});

export const marketSkillSummarySchema = z.object({
  id: skillIdSchema,
  name: skillNameSchema,
  displayName: z.string().optional(),
  latestVersion: semverSchema,
  kind: skillKindSchema,
  description: z.string(),
  author: skillAuthorSchema,
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export const marketSkillVersionSchema = z.object({
  id: skillIdSchema,
  version: semverSchema,
  manifest: skillManifestSchema,
  packageUrl: z.string(),
  packageFormat: z.enum(['tgz', 'zip']).default('tgz'),
  packageContentType: z.string().optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  publishedAt: z.string(),
});

export const marketSkillDetailSchema = marketSkillSummarySchema.extend({
  versions: z.array(marketSkillVersionSchema),
});

export const marketSkillListResponseSchema = z.object({
  skills: z.array(marketSkillSummarySchema),
});

export const marketSkillVersionsResponseSchema = z.object({
  versions: z.array(marketSkillVersionSchema),
});

export const marketSkillListSortInputSchema = z.enum(['latest', 'newest', 'updated', 'name']);

export const marketSkillListQuerySchema = z.object({
  query: z.string().optional(),
  kind: skillKindSchema.optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  publisher: skillNameSchema.optional(),
  sort: marketSkillListSortInputSchema.default('latest').transform((value) => {
    if (value === 'newest' || value === 'updated') {
      return 'latest';
    }
    return value;
  }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const installSkillRequestSchema = z.object({
  marketBaseUrl: z.string().url(),
  id: skillIdSchema,
  version: semverSchema.optional(),
});

export const installedSkillRecordSchema = z.object({
  id: skillIdSchema,
  version: semverSchema,
  manifest: skillManifestSchema,
  installPath: z.string(),
  sourceMarketUrl: z.string().url(),
  status: z.enum(['installed', 'disabled', 'failed']),
  installedAt: z.string(),
  updatedAt: z.string(),
});

export const marketUserRoleSchema = z.enum(['publisher', 'admin']);

export const marketAuthUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  roles: z.array(marketUserRoleSchema).default(['publisher']),
  publishers: z.array(skillNameSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const marketPackageFormatSchema = z.enum(['tgz', 'zip']);

export const marketPackageInfoSchema = z.object({
  filename: z.string().min(1),
  format: marketPackageFormatSchema,
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const marketPackageFileEntrySchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const marketValidationIssueSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().min(1).optional(),
});

export const marketPackageValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(marketValidationIssueSchema).default([]),
  warnings: z.array(marketValidationIssueSchema).default([]),
});

export const marketSubmissionStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'published',
  'withdrawn',
  'removed',
]);

export const marketSubmissionSchema = z.object({
  id: z.string().min(1),
  status: marketSubmissionStatusSchema,
  user: marketAuthUserSchema.optional(),
  skillId: skillIdSchema.optional(),
  publisher: skillNameSchema.optional(),
  name: skillNameSchema.optional(),
  version: semverSchema.optional(),
  manifest: skillManifestSchema.optional(),
  package: marketPackageInfoSchema.optional(),
  fileEntries: z.array(marketPackageFileEntrySchema).default([]),
  validation: marketPackageValidationSchema,
  releaseNotes: z.string().optional(),
  changeNotes: z.string().optional(),
  reviewReason: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  removedAt: z.string().optional(),
});

export const marketSubmissionListResponseSchema = z.object({
  submissions: z.array(marketSubmissionSchema),
});

export const marketSubmissionResponseSchema = z.object({
  submission: marketSubmissionSchema,
});

export const marketSubmissionListQuerySchema = z.object({
  status: marketSubmissionStatusSchema.optional(),
});

export const marketEditWorkspaceStatusSchema = z.enum([
  'draft',
  'validating',
  'ready',
  'submitted',
  'published',
  'discarded',
]);

export const marketEditWorkspaceSchema = z.object({
  id: z.string().min(1),
  status: marketEditWorkspaceStatusSchema,
  skillId: skillIdSchema,
  publisher: skillNameSchema,
  name: skillNameSchema,
  sourceVersion: semverSchema,
  targetVersion: semverSchema,
  revision: z.number().int().nonnegative(),
  validation: marketPackageValidationSchema.optional(),
  fileEntries: z.array(marketPackageFileEntrySchema).default([]),
  latestBuildId: z.string().optional(),
  devReleaseIds: z.array(z.string()).default([]),
  submissionId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastValidatedAt: z.string().optional(),
  discardedAt: z.string().optional(),
});

export const marketEditWorkspaceResponseSchema = z.object({
  workspace: marketEditWorkspaceSchema,
});

export const marketEditWorkspaceListResponseSchema = z.object({
  workspaces: z.array(marketEditWorkspaceSchema),
});

export const marketWorkspaceFileEntrySchema = z.object({
  path: z.string(),
  name: z.string().min(1),
  kind: z.enum(['file', 'directory']),
  sizeBytes: z.number().int().nonnegative().optional(),
  contentType: z.string().optional(),
  editable: z.boolean().default(false),
  updatedAt: z.string(),
});

export const marketWorkspaceFileListResponseSchema = z.object({
  path: z.string(),
  entries: z.array(marketWorkspaceFileEntrySchema),
  revision: z.number().int().nonnegative(),
});

export const marketWorkspaceFileContentResponseSchema = z.object({
  path: z.string().min(1),
  encoding: z.literal('utf8'),
  content: z.string(),
  revision: z.number().int().nonnegative(),
});

export const marketDevReleaseStatusSchema = z.enum(['active', 'revoked', 'expired']);

export const marketDevReleaseSchema = z.object({
  id: z.string().min(1),
  status: marketDevReleaseStatusSchema,
  skillId: skillIdSchema,
  publisher: skillNameSchema,
  name: skillNameSchema,
  version: semverSchema,
  sourceWorkspaceId: z.string().min(1),
  sourceVersion: semverSchema,
  package: marketPackageInfoSchema,
  packageUrl: z.string(),
  validation: marketPackageValidationSchema,
  fileEntries: z.array(marketPackageFileEntrySchema).default([]),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
  revokeReason: z.string().optional(),
});

export const marketDevReleaseResponseSchema = z.object({
  devRelease: marketDevReleaseSchema,
  latestDevVersion: semverSchema.optional(),
});

export const marketDevReleaseListResponseSchema = z.object({
  devReleases: z.array(marketDevReleaseSchema),
});

export const marketDeveloperKeySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  secret: z.string().min(1),
  scopes: z.array(z.enum(['dev:read'])).default(['dev:read']),
  publisher: skillNameSchema.optional(),
  skillId: skillIdSchema.optional(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
});

export const marketDeveloperKeyResponseSchema = z.object({
  developerKey: marketDeveloperKeySchema,
});

export const marketDeveloperKeyListResponseSchema = z.object({
  developerKeys: z.array(marketDeveloperKeySchema),
});

export const marketPublisherSkillsResponseSchema = z.object({
  skills: z.array(marketSkillSummarySchema),
  submissions: z.array(marketSubmissionSchema),
});

export const marketPublisherSkillResponseSchema = z.object({
  skill: marketSkillDetailSchema.nullable(),
  submissions: z.array(marketSubmissionSchema),
});

export const marketAuthResponseSchema = z.object({
  user: marketAuthUserSchema,
  token: z.string().min(1).optional(),
});

export const marketMeResponseSchema = z.object({
  user: marketAuthUserSchema.nullable(),
});

export const marketCategoryListResponseSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
  })),
});

export const marketTagListResponseSchema = z.object({
  tags: z.array(z.object({
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
  })),
});

export type SkillId = z.infer<typeof skillIdSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type SkillKind = z.infer<typeof skillKindSchema>;
export type SkillPermissions = z.infer<typeof skillPermissionsSchema>;
export type MarketSkillSummary = z.infer<typeof marketSkillSummarySchema>;
export type MarketSkillVersion = z.infer<typeof marketSkillVersionSchema>;
export type MarketSkillDetail = z.infer<typeof marketSkillDetailSchema>;
export type MarketSkillListResponse = z.infer<typeof marketSkillListResponseSchema>;
export type MarketSkillVersionsResponse = z.infer<typeof marketSkillVersionsResponseSchema>;
export type MarketSkillListSortInput = z.input<typeof marketSkillListSortInputSchema>;
export type MarketSkillListQuery = z.infer<typeof marketSkillListQuerySchema>;
export type InstallSkillRequest = z.infer<typeof installSkillRequestSchema>;
export type InstalledSkillRecord = z.infer<typeof installedSkillRecordSchema>;
export type MarketUserRole = z.infer<typeof marketUserRoleSchema>;
export type MarketAuthUser = z.infer<typeof marketAuthUserSchema>;
export type MarketPackageFormat = z.infer<typeof marketPackageFormatSchema>;
export type MarketPackageInfo = z.infer<typeof marketPackageInfoSchema>;
export type MarketPackageFileEntry = z.infer<typeof marketPackageFileEntrySchema>;
export type MarketValidationIssue = z.infer<typeof marketValidationIssueSchema>;
export type MarketPackageValidation = z.infer<typeof marketPackageValidationSchema>;
export type MarketSubmissionStatus = z.infer<typeof marketSubmissionStatusSchema>;
export type MarketSubmission = z.infer<typeof marketSubmissionSchema>;
export type MarketSubmissionListResponse = z.infer<typeof marketSubmissionListResponseSchema>;
export type MarketSubmissionResponse = z.infer<typeof marketSubmissionResponseSchema>;
export type MarketSubmissionListQuery = z.infer<typeof marketSubmissionListQuerySchema>;
export type MarketEditWorkspaceStatus = z.infer<typeof marketEditWorkspaceStatusSchema>;
export type MarketEditWorkspace = z.infer<typeof marketEditWorkspaceSchema>;
export type MarketEditWorkspaceResponse = z.infer<typeof marketEditWorkspaceResponseSchema>;
export type MarketEditWorkspaceListResponse = z.infer<typeof marketEditWorkspaceListResponseSchema>;
export type MarketWorkspaceFileEntry = z.infer<typeof marketWorkspaceFileEntrySchema>;
export type MarketWorkspaceFileListResponse = z.infer<typeof marketWorkspaceFileListResponseSchema>;
export type MarketWorkspaceFileContentResponse = z.infer<typeof marketWorkspaceFileContentResponseSchema>;
export type MarketDevReleaseStatus = z.infer<typeof marketDevReleaseStatusSchema>;
export type MarketDevRelease = z.infer<typeof marketDevReleaseSchema>;
export type MarketDevReleaseResponse = z.infer<typeof marketDevReleaseResponseSchema>;
export type MarketDevReleaseListResponse = z.infer<typeof marketDevReleaseListResponseSchema>;
export type MarketDeveloperKey = z.infer<typeof marketDeveloperKeySchema>;
export type MarketDeveloperKeyResponse = z.infer<typeof marketDeveloperKeyResponseSchema>;
export type MarketDeveloperKeyListResponse = z.infer<typeof marketDeveloperKeyListResponseSchema>;
export type MarketPublisherSkillsResponse = z.infer<typeof marketPublisherSkillsResponseSchema>;
export type MarketPublisherSkillResponse = z.infer<typeof marketPublisherSkillResponseSchema>;
export type MarketAuthResponse = z.infer<typeof marketAuthResponseSchema>;
export type MarketMeResponse = z.infer<typeof marketMeResponseSchema>;

export const parseSkillManifest = (input: unknown): SkillManifest =>
  skillManifestSchema.parse(input);

export const splitSkillId = (id: SkillId) => {
  const [publisher, name] = id.split('/') as [string, string];
  return { publisher, name };
};

export const formatSkillRef = (id: SkillId, version: string) => `${id}@${version}`;
