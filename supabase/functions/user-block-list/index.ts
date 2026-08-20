import { createDeps } from '../_shared/runtime.ts';
import { createUserBlockListHandler } from './handler.ts';

Deno.serve(createUserBlockListHandler(createDeps()));
