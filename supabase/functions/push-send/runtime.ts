import { createAdminClient, requireEnv } from '../_shared/runtime.ts';
import type { PushSendDeps } from './handler.ts';

export function createPushSendDeps(): PushSendDeps {
  const admin = createAdminClient();
  return {
    secret: requireEnv('PUSH_SEND_SECRET'),
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      if (error !== null) throw new Error(error.message);
      return data;
    },
    fetch,
    now: () => new Date(),
    elapsedMs: () => performance.now(),
    log: {
      error: (message, detail) => console.error(JSON.stringify({ level: 'error', message, detail })),
    },
  };
}
