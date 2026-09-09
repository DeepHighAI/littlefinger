# ADR 0022: Enable exposure ads for launch

Date: 2026-09-07. Status: Accepted by PO.

## Decision

The PO explicitly authorized `ads_enabled=true` for the production launch and the
preceding ad QA. This supersedes the former requirement to reach 100 daily ACTIVE
confirmations before enabling exposure ads. The remote flag is authoritative;
the local fallback and migration seed remain `false` for safe configuration failure.

`rewarded_ads_enabled` remains independently enabled. Existing placement rules,
UMP consent checks, no-fill collapse, and the ban on exposure ads at trust moments
and anywhere on the acceptance web are unchanged. Reward grants still require
verified SSV; client earned events never grant benefits.

## Consequences

The flag affects existing supported installations, including open testing; it is
not scoped to the future production track. No new AAB is needed for this flag change.
Enabling requests does not guarantee AdMob fill or close UMP/SSV release gates.
The PO retains Play upload/release ownership. Production-track rollout was not
requested as part of this investigation.

Operational readback and outstanding QA are recorded in DEVELOPMENT_STATUS.md.
