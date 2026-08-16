import { createDeps } from '../_shared/runtime.ts';
import { createWitnessInviteListHandler } from './handler.ts';

Deno.serve(createWitnessInviteListHandler(createDeps()));
