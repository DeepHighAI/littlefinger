import { createDeps } from '../_shared/runtime.ts';
import { createPromiseEntitlementsHandler } from './handler.ts';

Deno.serve(createPromiseEntitlementsHandler(createDeps()));
