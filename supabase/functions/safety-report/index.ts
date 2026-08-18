import { createDeps } from '../_shared/runtime.ts';
import { createSafetyReportHandler } from './handler.ts';

Deno.serve(createSafetyReportHandler(createDeps()));
