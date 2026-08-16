import { createDeps } from '../_shared/runtime.ts';
import { createWitnessSignHandler } from './handler.ts';

Deno.serve(createWitnessSignHandler(createDeps()));
