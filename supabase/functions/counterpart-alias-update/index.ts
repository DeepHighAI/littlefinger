import { createDeps } from '../_shared/runtime.ts';
import { createCounterpartAliasUpdateHandler } from './handler.ts';

Deno.serve(createCounterpartAliasUpdateHandler(createDeps()));
