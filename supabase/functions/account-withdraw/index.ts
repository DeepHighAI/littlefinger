import { createAccountWithdrawHandler } from './handler.ts';
import { createAccountWithdrawDeps } from './runtime.ts';

Deno.serve(createAccountWithdrawHandler(createAccountWithdrawDeps()));
