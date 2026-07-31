import { createEvidenceDeps } from '../_shared/evidence-runtime.ts';
import { createEvidenceUploadHandler } from './handler.ts';

Deno.serve(createEvidenceUploadHandler(createEvidenceDeps()));
