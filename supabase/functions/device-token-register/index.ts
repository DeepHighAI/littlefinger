import { createDeps } from '../_shared/runtime.ts';
import { createDeviceTokenRegisterHandler } from './handler.ts';

Deno.serve(createDeviceTokenRegisterHandler(createDeps()));
