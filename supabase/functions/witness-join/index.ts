import { createDeps } from '../_shared/runtime.ts';
import { createWitnessJoinHandler } from './handler.ts';

Deno.serve(createWitnessJoinHandler(createDeps()));
