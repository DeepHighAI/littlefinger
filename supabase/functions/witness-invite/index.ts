import { createDeps } from '../_shared/runtime.ts';
import { createWitnessInviteHandler } from './handler.ts';

Deno.serve(createWitnessInviteHandler(createDeps()));
