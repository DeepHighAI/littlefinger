import { createDeps } from '../_shared/runtime.ts';
import { createNotificationReadAllHandler } from './handler.ts';

Deno.serve(createNotificationReadAllHandler(createDeps()));
