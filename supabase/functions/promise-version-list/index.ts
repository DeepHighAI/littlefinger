import { createDeps } from '../_shared/runtime.ts';
import { createPromiseVersionListHandler } from './handler.ts';

Deno.serve(createPromiseVersionListHandler(createDeps()));
