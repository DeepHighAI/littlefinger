# Operate featured promise suggestions

The 0.3.2 mobile client reads `public.app_configs` where `key = 'promise_featured_presets'`. Operators can change the first three reward and penalty suggestions without a restart or another app build. Code 26 (0.3.1) must first be updated to use this feature.

## Change the labels

In the production Supabase Dashboard SQL Editor, read and retain the current JSON for rollback:

```sql
select value, updated_at
from public.app_configs
where key = 'promise_featured_presets';
```

Edit the labels below and execute the single-row update. Array order determines the first-to-third display order.

```sql
update public.app_configs
set value = '{
  "reward": {
    "ko": ["다음 메뉴 선택권", "주말 계획 결정권", "칭찬 세 가지"],
    "en": ["Pick the next menu", "Decide the weekend plan", "Three compliments"]
  },
  "penalty": {
    "ko": ["설거지 1주일", "소원권 1장 주기", "노래방 한 곡"],
    "en": ["Dishes for a week", "Give one wish coupon", "Sing one karaoke song"]
  }
}'::jsonb,
updated_at = now()
where key = 'promise_featured_presets'
returning key, value, updated_at;
```

The result must contain one row. Both `reward` and `penalty` require `ko` and `en`, each containing exactly three distinct, nonempty strings. Each label must be at most 100 Unicode code points after normalization. Surrounding whitespace and control characters are removed and Korean text is normalized before validation. Avoid duplicating remaining built-in suggestions because displayed choices are deduplicated.

This configuration is publicly readable. Store labels only, never secrets or personal data. Client accounts cannot edit the row.

## Confirm the result

Keep the promise editor open on a 0.3.2 client while updating the row. Featured choices refresh through Realtime; switching languages displays the matching labels. Foregrounding the app or reconnecting also fetches current configuration.

Select a suggestion before an operator change and confirm the field retains the original text. Configuration edits change choices only, never selected fields, existing drafts, or saved promises. The remaining built-in choices follow the featured labels.

## Recovery

Missing, invalid, or unreachable configuration leaves the mounted editor's last valid labels intact. A newly opened editor starts with bundled defaults until a valid fetch succeeds. There is no guaranteed persistent offline cache of the last remote value.

Rollback by restoring the saved JSON with the same single-row update and refreshing `updated_at`. Do not delete the row for rollback: mounted clients intentionally keep their last valid labels when data is missing or invalid.

If changes do not arrive, check the installed client version, all four JSON arrays, and whether `public.app_configs` is included in the `supabase_realtime` publication. The feature migration enables that membership. Ordinary label updates need no Edge Function deployment.
