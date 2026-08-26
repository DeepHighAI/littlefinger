import { createDeps } from '../_shared/runtime.ts';
import { createSlotStatusHandler } from './handler.ts';

Deno.serve(createSlotStatusHandler(createDeps()));
