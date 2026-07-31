import { createDeps } from '../_shared/runtime.ts';
import { createFulfillmentSubmitHandler } from './handler.ts';

Deno.serve(createFulfillmentSubmitHandler(createDeps()));
