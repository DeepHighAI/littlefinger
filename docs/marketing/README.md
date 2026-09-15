# Littlefinger marketing workspace

Updated: 2026-09-15. SEO → AEO → GEO, with research before implementation.

## Read in this order

1. [Core research findings](2026-09-15-research.md): dated primary-source evidence and live audit.
2. [Claude's independent findings](2026-09-15-claude-research.md): Korean discovery and critical review.
3. [Strategy and four-week board](strategy.md): audience, priorities, ownership and completion gates.
4. [Content batch](content-drafts.md): first guide published; two remaining ko/en drafts.
5. [Measurement runbook](measurement.md): console operations, attribution limits and weekly review.
6. [Batch 1 verification](verification.md): exact checks, environment workaround and release limits.
7. [Console execution](2026-09-15-console-execution.md): actual GSC observations and account/access blockers.

Working sheets: [weekly metrics](weekly-metrics.csv) · [AI observation panel](ai-observations.csv).
The metrics sheet contains the first partial-period GSC observation. The AI panel is still blank;
blank or unavailable fields must not be interpreted as zero.

## Core decision

Build useful, discoverable public answers and measure whether they lead to mutually confirmed
promises. Search visibility and AI citations are upstream observations. Neither proves install
or activation lift. Existing product north star: weekly confirmed promises.

Start with technical discovery, then a small number of original product guides, then repeatable
citation observations and transparent distribution. No paid acquisition budget or tracking SDK.
OAuth branding is explicitly deferred by the PO.

## Collaboration provenance

The existing adjacent Claude Code terminal was used, not a simulated review or replacement agent.
Orca Run: `run_9b30450d1404`; initial research Task: `task_aa0576ed4b9d`.
Codex owns synthesis and independent verification; Claude supplied independent evidence and review,
then took implementation Task `task_c5782167df3a`. Research completed before implementation.
Review dispositions are recorded in the strategy. Batch 1 is deployed as of 2026-09-15 10:27 KST.
The existing catalog failure is fixed: 2,229 Vitest and 972 Jest tests pass, as do typecheck,
build and 23 production HTTP checks. See verification for the release ID and exact scope.
Claude completed console inspection, submitted the Google sitemap and captured the first GSC
baseline. Its additional fetch-error diagnosis stopped at a session limit; the original terminal
is retained. The sitemap remains submitted with a fetch error, not successfully processed.

## Release boundary

Pre-existing homepage attribution and static privacy changes were reviewed and deployed with
the technical batch. Codex now proceeds solo, per PO instruction; the collaboration above is historical.
The [first guide](https://littlefinger-app.web.app/guides/promise-record) was published at
11:26 KST, with localized copy, static HTML, home/sitemap links and campaign attribution.
All 25 production HTTP checks passed. GSC live fetching of sitemap and guide passed at midday;
sitemap resubmission was accepted but its processing error remained visible. Guide indexing request
hit Google's daily quota; retry September 16. Bing/Naver are deferred. No community post or acquisition
outcome is claimed. Source remains uncommitted.
See [next actions](next-actions.md) for the short operator follow-up.

14:50 KST recheck: homepage indexing is confirmed directly in URL Inspection. The new guide
remains unindexed and the sitemap processing error remains visible. No same-day quota retry made.
