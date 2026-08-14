import { createPushSendHandler } from './handler.ts';
import { createPushSendDeps } from './runtime.ts';

Deno.serve(createPushSendHandler(createPushSendDeps()));
