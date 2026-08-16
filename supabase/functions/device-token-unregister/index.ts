import { createDeps } from '../_shared/runtime.ts';
import { createDeviceTokenUnregisterHandler } from './handler.ts';

Deno.serve(createDeviceTokenUnregisterHandler(createDeps()));
