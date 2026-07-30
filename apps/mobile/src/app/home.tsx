import { PROMISE_STATUS_LABEL } from '@littlefinger/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfChip } from '../components/LfChip';
import { LfEmpty } from '../components/LfEmpty';
import { LfFab } from '../components/LfFab';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import {
  deleteDraft,
  listWaitingPromises,
  type WaitingPromiseSummary,
} from '../lib/home-promises-native.ts';
import { colors, gutter, size, space } from '../theme/tokens';

const HOME_LABEL = {
  brand: '리틀핑거',
  activeTab: '진행 중 0',
  completedTab: '완료 0',
  waitingTab: (count: number) => `대기 ${count}`,
  empty: '아직 약속이 없어요. 첫 약속을 만들어보세요',
  emptyDescription: '소중한 사람과 새끼손가락 걸고 지킬 약속을 만들어보세요',
  create: '약속 만들기',
  loading: '약속을 불러오는 중이에요',
  loadError: '약속을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  delete: '삭제',
  deleteFirstTitle: '초안을 삭제할까요?',
  deleteFirstBody: '삭제한 초안은 되돌릴 수 없어요.',
  deleteContinue: '계속',
  deleteFinalTitle: '정말 삭제할까요?',
  deleteFinalBody: '약속 내용이 기기와 서버에서 모두 사라져요.',
  cancel: '취소',
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    minHeight: size.tabHeight,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceChrome,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  body: {
    flexGrow: 1,
    padding: gutter.app,
    paddingBottom: size.fabHeight + gutter.app + space[9],
  },
  list: { gap: space[5] },
  cardTitle: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const [promises, setPromises] = useState<WaitingPromiseSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void listWaitingPromises()
      .then((rows) => {
        if (active) setPromises(rows);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function removeDraft(promiseId: string): Promise<void> {
    try {
      await deleteDraft(promiseId);
      setPromises((rows) => rows?.filter((row) => row.id !== promiseId) ?? []);
    } catch {
      setLoadFailed(true);
    }
  }

  function confirmDelete(item: WaitingPromiseSummary): void {
    Alert.alert(HOME_LABEL.deleteFirstTitle, HOME_LABEL.deleteFirstBody, [
      { text: HOME_LABEL.cancel, style: 'cancel' },
      {
        text: HOME_LABEL.deleteContinue,
        onPress: () => {
          Alert.alert(HOME_LABEL.deleteFinalTitle, HOME_LABEL.deleteFinalBody, [
            { text: HOME_LABEL.cancel, style: 'cancel' },
            {
              text: HOME_LABEL.delete,
              style: 'destructive',
              onPress: async () => await removeDraft(item.id),
            },
          ]);
        },
      },
    ]);
  }

  function openPromise(item: WaitingPromiseSummary): void {
    if (item.status === 'DRAFT') {
      router.push({ pathname: '/promise/edit', params: { promise_id: item.id } });
    } else {
      router.push({ pathname: '/invite', params: { promise_id: item.id } });
    }
  }

  const waitingCount = promises?.length ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar brand title={HOME_LABEL.brand} />
      <View style={styles.tabs} accessibilityRole="tablist">
        <LfText variant="caption">{HOME_LABEL.activeTab}</LfText>
        <LfText variant="caption">{HOME_LABEL.waitingTab(waitingCount)}</LfText>
        <LfText variant="caption">{HOME_LABEL.completedTab}</LfText>
      </View>

      {loadFailed ? (
        <View style={styles.centered}>
          <LfText secondary align="center">
            {HOME_LABEL.loadError}
          </LfText>
        </View>
      ) : promises === null ? (
        <View style={styles.centered}>
          <LfText secondary>{HOME_LABEL.loading}</LfText>
        </View>
      ) : promises.length === 0 ? (
        <LfEmpty title={HOME_LABEL.empty} description={HOME_LABEL.emptyDescription} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.list}>
            {promises.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 열기`}
                onPress={() => openPromise(item)}
              >
                <LfCard>
                  <LfStack gap={4}>
                    <LfChip label={PROMISE_STATUS_LABEL[item.status]} tone="status" />
                    <LfRow gap={4}>
                      <View style={styles.cardTitle}>
                        <LfText variant="subtitle">{item.title}</LfText>
                      </View>
                      {item.status === 'DRAFT' && (
                        <LfButton
                          variant="text"
                          size="compact"
                          label={HOME_LABEL.delete}
                          accessibilityLabel={`${item.title} 초안 삭제`}
                          onPress={() => confirmDelete(item)}
                        />
                      )}
                    </LfRow>
                  </LfStack>
                </LfCard>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <LfFab label={HOME_LABEL.create} onPress={() => router.push('/promise/edit')} />
    </SafeAreaView>
  );
}
