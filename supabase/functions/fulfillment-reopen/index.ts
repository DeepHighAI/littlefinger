import { createDeps } from '../_shared/runtime.ts';
import { createFulfillmentReopenHandler } from './handler.ts';

Deno.serve(createFulfillmentReopenHandler(createDeps()));
