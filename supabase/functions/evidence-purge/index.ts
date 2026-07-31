import { createEvidencePurgeDeps } from '../_shared/evidence-runtime.ts';
import { createEvidencePurgeHandler } from './handler.ts';

Deno.serve(createEvidencePurgeHandler(createEvidencePurgeDeps()));
