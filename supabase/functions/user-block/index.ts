import { createDeps } from '../_shared/runtime.ts';
import { createUserBlockHandler } from './handler.ts';

Deno.serve(createUserBlockHandler(createDeps()));
