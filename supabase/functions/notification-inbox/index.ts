import { createDeps } from '../_shared/runtime.ts';
import { createNotificationInboxHandler } from './handler.ts';

Deno.serve(createNotificationInboxHandler(createDeps()));
