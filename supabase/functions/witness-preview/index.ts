import { createDeps } from '../_shared/runtime.ts';
import { createWitnessPreviewHandler } from './handler.ts';

Deno.serve(createWitnessPreviewHandler(createDeps()));
