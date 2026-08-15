import { createDeps } from '../_shared/runtime.ts';
import { createPromiseDetailHandler } from './handler.ts';

Deno.serve(createPromiseDetailHandler(createDeps()));
