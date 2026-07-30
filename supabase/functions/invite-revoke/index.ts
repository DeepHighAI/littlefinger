import { createDeps } from '../_shared/runtime.ts';
import { createInviteRevokeHandler } from './handler.ts';

Deno.serve(createInviteRevokeHandler(createDeps()));
