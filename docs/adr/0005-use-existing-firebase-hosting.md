# ADR 0005 — Host the acceptance web on the existing Firebase project

- Status: Accepted
- Date: 2026-08-18
- Supersedes: the Cloudflare Pages hosting choice in ADR 0002 and planning documents 03/04
- Deciders: PO (대표)

## Context

The product no longer uses Cloudflare Pages. The acceptance web still needs a stable public HTTPS
origin, direct navigation to `/i/*`, a correctly typed `/.well-known/assetlinks.json`, and hosting
whose free plan permits this ad-supported product. The repository already has a Firebase project,
`littlefinger-app-philwoo`, for Android and FCM, and the owner account already has deployment
access.

Vercel remains excluded by the existing commercial-use constraint. GitHub Pages would place a
project site below a repository path and needs additional 404 handling for client-side routes.
Adding another provider would create a second account and deployment boundary without improving
the required static-hosting capabilities.

## Decision

Use the existing Firebase project's default Hosting site at
`https://littlefinger-app-philwoo.web.app` on the no-cost Spark plan.

The committed `firebase.json` serves `apps/web/dist`, rewrites missing paths to `index.html`, and
sets an explicit JSON content type for Android Digital Asset Links. `.firebaserc` pins the existing
project so deployment cannot accidentally target another project owned by the same account.

The Android intent filter and invite links derive from `EXPO_PUBLIC_WEB_BASE_URL`; that value is now
the Firebase Hosting origin. Supabase Auth redirect allowlists remain Dashboard-owned and must
include the new origin before authenticated web acceptance is considered production-ready.

## Consequences

The acceptance web and FCM now share one Firebase project but remain independent products: Hosting
deploys only static files and does not move authentication, database, storage, batch, or Edge
Functions away from Supabase.

The default `web.app` domain provides HTTPS without buying a domain. A future custom domain changes
the environment value, Supabase redirect allowlist, Digital Asset Links host, and Android build; it
does not require another hosting architecture decision.
