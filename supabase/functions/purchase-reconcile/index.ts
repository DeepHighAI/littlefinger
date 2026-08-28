import { ANDROID_PACKAGE_NAME } from '../../../packages/shared/src/app-links.ts';
import { createDeps, requireEnv } from '../_shared/runtime.ts';
import { createGoogleVoidedPurchaseLister } from './google.ts';
import { createPurchaseReconcileHandler } from './handler.ts';

Deno.serve(
  createPurchaseReconcileHandler({
    ...createDeps(),
    reconcileSecret: requireEnv('PURCHASE_RECONCILE_SECRET'),
    listVoidedPurchases: createGoogleVoidedPurchaseLister({
      serviceAccountJson: requireEnv('GOOGLE_PLAY_SERVICE_ACCOUNT'),
      packageName: ANDROID_PACKAGE_NAME,
    }),
  }),
);
