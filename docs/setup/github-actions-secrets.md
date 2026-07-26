# GitHub Actions Secrets — setup

Both workflows in `.github/workflows/` are committed but **do nothing until these secrets exist**.
This has to be done by the PO: the `gh` CLI is not installed in the agent environment, and one of
the three values is a database password that should never pass through a chat transcript or a file
in this repo.

Repository: `DeepHighAI/littlefinger` →
**Settings › Secrets and variables › Actions › New repository secret**

## The three secrets

| Name | Used by | Where to find it |
|---|---|---|
| `SUPABASE_URL` | keep-alive | Supabase → Settings → API → **Project URL** |
| `SUPABASE_ANON_KEY` | keep-alive | Supabase → Settings → API → **`anon` `public`** |
| `SUPABASE_DB_URL` | weekly backup | Supabase → Settings → Database → **Connection string → URI** |

`SUPABASE_URL` is `https://vepnrrmxvsytguocicfe.supabase.co` and `SUPABASE_ANON_KEY` is the same
`anon public` key already in the local `.env`. Neither is really a secret — the anon key is designed
to ship inside the app bundle, and RLS is what actually protects the data. They live in Actions
secrets only so the workflow file does not hardcode them.

**`SUPABASE_DB_URL` is a genuine credential.** The connection URI embeds the database password and
grants full, RLS-bypassing access. Copy it straight from the Supabase dashboard into the GitHub
secret field — do not paste it into a chat, a file, or a commit. Supabase shows a
`[YOUR-PASSWORD]` placeholder in the URI; replace it with the database password, and reset that
password from the same page if it is not to hand.

## Why the keep-alive is not optional

Supabase Free **pauses a project after 7 days without activity**, and deletes it after 90 days
paused. The daily ping is what keeps the project alive across quiet stretches of development.

The workflow hits `GET /rest/v1/` rather than a specific table. PostgREST introspects the schema to
answer, so it counts as real database activity, and it works **even before any migration is
applied** — which matters, because migrations are deliberately held back until the Edge Functions
are written. Pointing the ping at a table would make it fail with 404 until then, and a failing
keep-alive is the same as no keep-alive.

## Checking it works

After adding the secrets: **Actions → `supabase keep-alive` → Run workflow**. A green run printing
`HTTP 200` means it is live. The step fails loudly on anything other than 200 — a paused project or
a rotated key should not pass silently.

The backup workflow can be triggered the same way; it uploads `schema.sql` and `data.sql` as a
run artifact with 90-day retention, since the free plan has no automatic backup.
