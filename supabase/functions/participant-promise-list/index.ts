import { createDeps } from '../_shared/runtime.ts';
import { createParticipantPromiseListHandler } from './handler.ts';

Deno.serve(createParticipantPromiseListHandler(createDeps()));
