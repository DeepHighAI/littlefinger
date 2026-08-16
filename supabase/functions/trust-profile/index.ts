import { createDeps } from '../_shared/runtime.ts';
import { createTrustProfileHandler } from './handler.ts';

Deno.serve(createTrustProfileHandler(createDeps()));
