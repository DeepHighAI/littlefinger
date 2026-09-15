import { createDeps } from '../_shared/runtime.ts';
import { createInviteDeclinePublicHandler } from './handler.ts';

Deno.serve(createInviteDeclinePublicHandler(createDeps()));
