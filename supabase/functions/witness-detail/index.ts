import { createDeps } from '../_shared/runtime.ts';
import { createWitnessDetailHandler } from './handler.ts';

Deno.serve(createWitnessDetailHandler(createDeps()));
