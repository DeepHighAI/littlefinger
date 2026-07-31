import { createEvidenceDeps } from '../_shared/evidence-runtime.ts';
import { createEvidenceSignUrlHandler } from './handler.ts';

Deno.serve(createEvidenceSignUrlHandler(createEvidenceDeps()));
