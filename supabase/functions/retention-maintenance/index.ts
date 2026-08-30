import { createDeps, requireEnv } from '../_shared/runtime.ts';
import { createStorage } from '../_shared/storage-runtime.ts';
import { createRetentionMaintenanceHandler } from './handler.ts';

Deno.serve(createRetentionMaintenanceHandler({
  ...createDeps(),
  storage: createStorage(),
  workerSecret: requireEnv('RETENTION_WORKER_SECRET'),
}));
