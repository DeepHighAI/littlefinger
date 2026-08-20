import { createDeps } from '../_shared/runtime.ts';
import { createUserUnblockHandler } from './handler.ts';

Deno.serve(createUserUnblockHandler(createDeps()));
