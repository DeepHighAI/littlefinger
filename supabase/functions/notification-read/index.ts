import { createDeps } from '../_shared/runtime.ts';
import { createNotificationReadHandler } from './handler.ts';

Deno.serve(createNotificationReadHandler(createDeps()));
