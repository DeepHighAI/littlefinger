import { createDeps } from '../_shared/runtime.ts';
import { createPromiseHomeListHandler } from './handler.ts';

Deno.serve(createPromiseHomeListHandler(createDeps()));
