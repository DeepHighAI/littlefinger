import { INVITE_ACCOUNT_LABEL } from '@littlefinger/shared';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLabels } from '../lib/locale-native';
import { useInviteAccount } from '../lib/use-invite-account.ts';
import { logoutCurrentDeviceNative } from '../lib/trust-profile-native.ts';
import { clearPendingEntry } from '../lib/pending-entry.ts';
import { colors, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfCard } from './LfCard.tsx';
import { LfText } from './LfText.tsx';

export function InviteAccountGate({ children }: { children: ReactNode }): React.JSX.Element {
  const L = useLabels(INVITE_ACCOUNT_LABEL);
  const account = useInviteAccount();
  const [busy, setBusy] = useState(false);
  async function changeAccount(): Promise<void> {
    if (!account.session) return;
    setBusy(true);
    try { await logoutCurrentDeviceNative(account.session.user.id); }
    catch { account.setError(true); }
    finally { setBusy(false); }
  }
  if (!account.error && (account.session === null || account.confirmed)) return <>{children}</>;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <LfText variant="title">{L.title}</LfText>
        {account.error ? <LfText variant="error">{L.error}</LfText> : account.session !== undefined ? (
          <>
            <LfCard>
              <LfText variant="eyebrow">{L.provider[account.provider]}</LfText>
              <LfText variant="title">{account.nickname ?? L.fallback}</LfText>
            </LfCard>
            <LfText>{L.body}</LfText>
          </>
        ) : null}
        {account.error ? <LfButton label={L.retry} onPress={account.retry} /> : account.session !== undefined ? (
          <>
            <LfButton label={L.continue} disabled={busy || !account.ready} onPress={() => {
              clearPendingEntry();
              account.confirm();
            }} />
            <LfButton variant="outlined" label={L.change} disabled={busy} onPress={() => void changeAccount()} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, justifyContent: 'center', gap: space[6], padding: space[8] },
});
