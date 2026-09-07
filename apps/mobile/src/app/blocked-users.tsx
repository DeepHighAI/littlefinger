import type { BlockedUserItem } from '@littlefinger/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfAvatar } from '../components/LfAvatar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfEmpty } from '../components/LfEmpty';
import { LfText } from '../components/LfText';
import {
  listBlockedUsersNative,
  unblockUserNative,
} from '../lib/account-safety-native.ts';
import { useLabels } from '../lib/locale-native';
import { BLOCKED_USERS_LABEL } from '../screens/blocked-users-labels.ts';
import { formatDetailInstant } from '../screens/scr-a05-detail-state.ts';
import { border, colors, gutter, size, space } from '../theme/tokens';

/** README 지원 화면 본문 상단 22 — 토큰 없음, ADR 0020 예외 */
const BODY_TOP = 22;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[5] },
  body: {
    paddingTop: BODY_TOP,
    paddingRight: space[8],
    paddingBottom: space[8],
    paddingLeft: gutter.app,
    gap: space[6],
  },
  // flat 카드 한 장 안의 목록 행 — 48 + 16 높이, 행 사이 점선 (`.lf-support-list__row`)
  row: {
    minHeight: size.touchMin + space[7],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
  },
  divided: { borderTopWidth: border.dashed, borderTopColor: colors.outline, borderStyle: 'dashed' },
  itemText: { flex: 1, minWidth: 0 },
});

// 참조 화면 목록(SCR-ID) 밖의 안전 기능 화면 — 02 §5 SCR-A08 의 "차단 목록 관리" 항목.
export default function BlockedUsersScreen(): React.JSX.Element {
  const LABEL = useLabels(BLOCKED_USERS_LABEL);
  const router = useRouter();
  const [items, setItems] = useState<readonly BlockedUserItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [unblockFailed, setUnblockFailed] = useState(false);

  async function refresh(): Promise<void> {
    setLoadFailed(false);
    try {
      const response = await listBlockedUsersNative();
      setItems(response.items);
    } catch {
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function performUnblock(item: BlockedUserItem): Promise<void> {
    setUnblockingId(item.target_user_id);
    setUnblockFailed(false);
    try {
      await unblockUserNative(item.target_user_id);
      setItems((current) =>
        current === null
          ? current
          : current.filter((entry) => entry.target_user_id !== item.target_user_id),
      );
    } catch {
      setUnblockFailed(true);
    } finally {
      setUnblockingId(null);
    }
  }

  function confirmUnblock(item: BlockedUserItem): void {
    Alert.alert(LABEL.unblockTitle, LABEL.unblockBody(item.nickname), [
      { text: LABEL.cancel, style: 'cancel' },
      { text: LABEL.unblockConfirm, onPress: () => void performUnblock(item) },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading="back"
        leadingAccessibilityLabel={LABEL.back}
        onLeadingPress={() => router.back()}
      />
      {items === null && !loadFailed ? (
        <View style={styles.centered}>
          <LfText secondary>{LABEL.loading}</LfText>
        </View>
      ) : loadFailed ? (
        <View style={styles.centered}>
          <LfText variant="error" align="center">{LABEL.loadError}</LfText>
          <LfButton label={LABEL.retry} variant="outlined" onPress={() => void refresh()} />
        </View>
      ) : items !== null && items.length === 0 ? (
        <LfEmpty title={LABEL.empty} description={LABEL.emptyDescription} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <LfText variant="meta" align="center">{LABEL.emptyDescription}</LfText>
          {unblockFailed && (
            <LfText variant="error" align="center">{LABEL.unblockError}</LfText>
          )}
          <LfCard shadow={false}>
            {(items ?? []).map((item, index) => (
              <View
                key={item.target_user_id}
                testID={`blocked-${item.target_user_id}`}
                style={[styles.row, index > 0 && styles.divided]}
              >
                <LfAvatar
                  size="md"
                  nickname={item.nickname}
                  profileImageUrl={item.profile_image_url}
                  accessibilityLabel={item.nickname}
                />
                <View style={styles.itemText}>
                  <LfText variant="bodyStrong">{item.nickname}</LfText>
                  <LfText variant="caption">{formatDetailInstant(item.blocked_at)}</LfText>
                </View>
                <LfButton
                  label={LABEL.unblock}
                  accessibilityLabel={LABEL.unblockAccessibility(item.nickname)}
                  variant="outlined"
                  size="compact"
                  disabled={unblockingId !== null}
                  onPress={() => confirmUnblock(item)}
                />
              </View>
            ))}
          </LfCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
