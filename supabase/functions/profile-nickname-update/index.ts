import { createDeps } from '../_shared/runtime.ts';
import { createProfileNicknameUpdateHandler } from './handler.ts';

Deno.serve(createProfileNicknameUpdateHandler(createDeps()));
