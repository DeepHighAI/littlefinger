import { ANDROID_PACKAGE_NAME } from '../../../packages/shared/src/app-links.ts';
import { createDeps, requireEnv } from '../_shared/runtime.ts';
import { createGooglePurchaseVerifier } from './google.ts';
import { createPurchaseVerifyHandler } from './handler.ts';

Deno.serve(
  createPurchaseVerifyHandler({
    ...createDeps(),
    verifyPurchase: createGooglePurchaseVerifier({
      serviceAccountJson: requireEnv('GOOGLE_PLAY_SERVICE_ACCOUNT'),
      packageName: ANDROID_PACKAGE_NAME,
    }),
  }),
);
