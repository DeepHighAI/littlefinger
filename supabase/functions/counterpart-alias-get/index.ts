import { createDeps } from '../_shared/runtime.ts';
import { createCounterpartAliasGetHandler } from './handler.ts';

Deno.serve(createCounterpartAliasGetHandler(createDeps()));
