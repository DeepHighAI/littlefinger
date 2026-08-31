import { createDeps } from '../_shared/runtime.ts';
import { createPromisePendingDeleteHandler } from './handler.ts';

Deno.serve(createPromisePendingDeleteHandler(createDeps()));
