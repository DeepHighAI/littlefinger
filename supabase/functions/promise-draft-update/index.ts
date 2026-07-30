import { createDeps } from '../_shared/runtime.ts';
import { createPromiseDraftUpdateHandler } from './handler.ts';

Deno.serve(createPromiseDraftUpdateHandler(createDeps()));
