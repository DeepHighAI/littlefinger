import { createDeps } from '../_shared/runtime.ts';
import { createPromiseAmendRequestHandler } from './handler.ts';

Deno.serve(createPromiseAmendRequestHandler(createDeps()));
