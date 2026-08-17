import { createDeps } from '../_shared/runtime.ts';
import { createWitnessLeaveHandler } from './handler.ts';

Deno.serve(createWitnessLeaveHandler(createDeps()));
