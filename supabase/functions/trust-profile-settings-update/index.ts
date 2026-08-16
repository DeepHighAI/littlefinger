import { createDeps } from '../_shared/runtime.ts';
import { createTrustProfileSettingsUpdateHandler } from './handler.ts';

Deno.serve(createTrustProfileSettingsUpdateHandler(createDeps()));
