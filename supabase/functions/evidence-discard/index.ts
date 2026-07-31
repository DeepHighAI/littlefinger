import { createEvidenceDeps } from '../_shared/evidence-runtime.ts';
import { createEvidenceDiscardHandler } from './handler.ts';

Deno.serve(createEvidenceDiscardHandler(createEvidenceDeps()));
