import { createDeps } from '../_shared/runtime.ts';
import { createPromiseHideHandler } from './handler.ts';

Deno.serve(createPromiseHideHandler(createDeps()));
