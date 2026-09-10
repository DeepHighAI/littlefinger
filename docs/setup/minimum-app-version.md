# Minimum app version

## Code 30 release

The PO confirmed Play currently serves **0.3.2 / code 29** on September 11, 2026.
The replacement candidate is **0.3.3 / code 30**. It includes the Android system-bar
fix and supersedes the unuploaded 0.3.2 / code 30 candidate.

Existing clients compare `Constants.expoConfig.version` with the JSON string in
`public.app_configs.min_app_version`. They do not send or compare Android
`versionCode`. Setting the minimum to 0.3.2 therefore permits both code 29 and the
earlier code 30 candidate. There is no installed `expo-updates` channel to change
that behavior remotely. Increasing the replacement's version name to 0.3.3 makes
the existing client gate sufficient to require an update from 0.3.2.

## Activation order

1. PO uploads `dist/littlefinger-production-v0.3.3-code30.aab` and publishes it to
   the intended Play track. Uploading a draft or waiting for review is insufficient.
2. Confirm affected users can install 0.3.3 / code 30 from Play. A global minimum
   should not be enabled while the replacement is available only to some users.
3. Apply the already requested minimum-version change **after availability is
   confirmed**. The observed live value before this release was `"0.2.0"`:

   ```sql
   update public.app_configs
   set value = to_jsonb('0.3.3'::text)
   where key = 'min_app_version'
     and value = to_jsonb('0.2.0'::text)
   returning key, value;
   ```

   Require exactly one returned row. If none is returned, read the current value
   before making another change; do not overwrite a concurrent setting blindly.
4. Re-read the row through the same anonymous Data API path as the app and verify
   cold launches: 0.3.2 requires updating; 0.3.3 enters normally. Follow the update
   button to the installed user's Play listing.

Do not use `supabase config push`. This is a data setting, not an auth or schema
deployment. The packaging step leaves the live minimum unchanged.

## Existing behavior and limits

- The check runs at startup and precedes onboarding and protected app routes.
  An already running app does not continuously recheck the setting.
- A missing/invalid setting or failed network read permits entry, as implemented
  by EC-I04. This is an app update gate, not server-side API version enforcement.
- The acceptance web does not use this mobile startup gate.
- The shipped comparator was exercised against 0.3.1, 0.3.2 and 0.3.3, including
  the equal-version case. Minimum 0.3.3 blocks 0.3.2 and permits 0.3.3.

For operational rollback, restore the exact previous JSON value only after
checking the current value. Lowering the minimum does not downgrade installed
apps or remove the replacement from Play.
