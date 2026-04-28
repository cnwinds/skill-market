import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? '127.0.0.1';
const registryRoot = process.env.REGISTRY_ROOT;

const parseCorsOrigins = (): string[] | boolean | undefined => {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    return undefined;
  }
  if (raw === '*') {
    return true;
  }
  if (raw.toLowerCase() === 'false') {
    return false;
  }
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const app = createApp({ logger: true, registryRoot, corsOrigins: parseCorsOrigins() });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
