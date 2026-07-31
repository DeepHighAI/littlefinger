import { createDeps } from '../_shared/runtime.ts';
import { createPromiseFulfillmentDetailHandler } from './handler.ts';

Deno.serve(createPromiseFulfillmentDetailHandler(createDeps()));
