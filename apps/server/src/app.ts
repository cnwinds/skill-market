import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify, { type FastifyInstance } from 'fastify';
import {
  marketSkillListResponseSchema,
  marketSkillVersionsResponseSchema,
  semverSchema,
  skillManifestSchema,
  skillNameSchema,
} from '@qizhi/skill-spec';

import { RegistryNotFoundError, findPackageFile, findSkill, scanRegistry } from './registry.js';

export type AppOptions = {
  registryRoot?: string;
  logger?: boolean;
};

const appDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRegistryRoot = path.resolve(appDir, '../../..', 'registry');

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

export const createApp = (options: AppOptions = {}): FastifyInstance => {
  const app = Fastify({ logger: options.logger ?? false });
  const registryRoot = options.registryRoot ?? defaultRegistryRoot;

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/api/v1/skills', async () => {
    const snapshot = await scanRegistry(registryRoot);
    return marketSkillListResponseSchema.parse({
      skills: snapshot.skills.map((skill) => skill.summary),
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
      .type('application/gzip')
      .header('content-disposition', 'attachment; filename="package.tgz"')
      .header('content-length', String(packageFile.sizeBytes))
      .send(createReadStream(packageFile.path));
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RegistryNotFoundError) {
      return reply.code(404).send({ error: error.message });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return reply.code(400).send({ error: 'Invalid request or registry data' });
    }

    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  return app;
};
