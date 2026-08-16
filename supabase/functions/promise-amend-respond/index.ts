import { createDeps } from '../_shared/runtime.ts';
import { createPromiseAmendRespondHandler } from './handler.ts';

Deno.serve(createPromiseAmendRespondHandler(createDeps()));
