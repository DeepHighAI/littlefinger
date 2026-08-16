import { createDeps } from '../_shared/runtime.ts';
import { createPromiseAmendWithdrawHandler } from './handler.ts';

Deno.serve(createPromiseAmendWithdrawHandler(createDeps()));
