import { createAccountDeleteRetryHandler } from './handler.ts';
import { createAccountDeleteRetryDeps } from './runtime.ts';

Deno.serve(createAccountDeleteRetryHandler(createAccountDeleteRetryDeps()));
