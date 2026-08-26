import { type PromiseHomeCard, type PromiseHomeTab } from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfChip } from '../components/LfChip';
import { LfEmpty } from '../components/LfEmpty';
import { LfIcon } from '../components/LfIcon';
import { PromiseListRow } from '../components/PromiseListRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { listHomePromises } from '../lib/home-promises-native.ts';
import { useLabels } from '../lib/locale-native';
import { createInitialHomeState, promiseHomeReducer } from '../screens/scr-a02-home-state.ts';
import { SCR_A09_LABEL } from '../screens/scr-a09-labels.ts';
import { colors, gutter, size, space } from '../theme/tokens';

/**
 * SCR-A09 지난 약속 히스토리 (PO 2026-08-26, ADR 0011).
 *
 * 종결 6개 상태를 판정 없이 네 묶음으로 보여준다 — 의견 불일치를 '불이행'에 넣지 않는
 * 것(협의 중단 탭)이 P1 의 요구다. 광고 슬롯은 없다(F-12 허용 지면은 A02·A07·A08 뿐).
 */
const HISTORY_TABS: readonly PromiseHomeTab[] = ['DONE', 'BROKEN', 'UNSETTLED', 'DECLINED'];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    paddingHorizontal: gutter.app,
  },
  tab: {
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  content: { flexGrow: 1, paddingTop: space[6], paddingBottom: space[9] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconButton: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingHorizontal: gutter.app, paddingVertical: space[9] },
  footer: { paddingVertical: space[7] },
});

function tabLabel(
  labels: (typeof SCR_A09_LABEL)['ko'],
  tab: PromiseHomeTab,
  count: number,
): string {
  if (tab === 'DONE') return labels.doneTab(count);
  if (tab === 'BROKEN') return labels.brokenTab(count);
  if (tab === 'UNSETTLED') return labels.unsettledTab(count);
  return labels.declinedTab(count);
}

export interface HistoryScreenProps {
  now?: Date;
}

export default function HistoryScreen({ now = new Date() }: HistoryScreenProps): React.JSX.Element {
  const LABEL = useLabels(SCR_A09_LABEL);
  const router = useRouter();
  const [state, dispatch] = useReducer(promiseHomeReducer, undefined, createInitialHomeState);
  const stateRef = useRef(state);
  const nextRequestId = useRef(0);
  const loadingTabs = useRef(new Set<PromiseHomeTab>());
  const pagingTabs = useRef(new Set<PromiseHomeTab>());
  stateRef.current = state;
  // 홈 리듀서의 초기 탭은 ACTIVE 다 — 히스토리는 첫 탭(완료)으로 시작한다.
  const selectedTab: PromiseHomeTab = (HISTORY_TABS as readonly string[]).includes(
    state.selectedTab,
  )
    ? state.selectedTab
    : 'DONE';

  const loadFirstPage = useCallback(async (tab: PromiseHomeTab, refresh: boolean) => {
    if (loadingTabs.current.has(tab)) return;
    loadingTabs.current.add(tab);
    const loadId = ++nextRequestId.current;
    dispatch({ type: 'LOAD_STARTED', tab, loadId, refresh });
    try {
      const result = await listHomePromises({ tab });
      dispatch({
        type: 'LOAD_SUCCEEDED',
        tab,
        loadId,
        items: result.items,
        pinned: result.pinned,
        counts: result.counts,
        nextCursor: result.next_cursor,
      });
    } catch {
      dispatch({ type: 'LOAD_FAILED', tab, loadId });
    } finally {
      loadingTabs.current.delete(tab);
    }
  }, []);

  const loadNextPage = useCallback(async (tab: PromiseHomeTab) => {
    const snapshot = stateRef.current.tabs[tab];
    if (snapshot.nextCursor === null || snapshot.pagePending || pagingTabs.current.has(tab)) return;
    pagingTabs.current.add(tab);
    const requestId = ++nextRequestId.current;
    const generation = snapshot.latestLoadId;
    dispatch({ type: 'PAGE_STARTED', tab, requestId, generation });
    try {
      const result = await listHomePromises({ tab, cursor: snapshot.nextCursor });
      dispatch({
        type: 'PAGE_SUCCEEDED',
        tab,
        requestId,
        generation,
        items: result.items,
        nextCursor: result.next_cursor,
      });
    } catch {
      dispatch({ type: 'PAGE_FAILED', tab, requestId, generation });
    } finally {
      pagingTabs.current.delete(tab);
    }
  }, []);

  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    const tab = stateRef.current.selectedTab;
    void loadFirstPage(
      (HISTORY_TABS as readonly string[]).includes(tab) ? tab : 'DONE',
      true,
    );
  }, [loadFirstPage]));

  const selected = state.tabs[selectedTab];
  useEffect(() => {
    if (selected.items === null && !selected.loading && !selected.loadFailed) {
      void loadFirstPage(selectedTab, false);
    }
  }, [loadFirstPage, selected.items, selected.loadFailed, selected.loading, selectedTab]);

  const openPromise = useCallback((item: PromiseHomeCard) => {
    router.push({ pathname: '/promise/[promise_id]', params: { promise_id: item.promise_id } });
  }, [router]);

  const pageFooter = selected.pagePending || selected.pageFailed ? (
    <View style={styles.footer}>
      {selected.pagePending ? <LfText align="center" secondary>{LABEL.loading}</LfText> : (
        <LfStack gap={3} center>
          <LfText variant="error">{LABEL.pageError}</LfText>
          <LfButton
            accessibilityLabel={LABEL.retryPageAccessibility}
            label={LABEL.retry}
            variant="text"
            onPress={() => void loadNextPage(selectedTab)}
          />
        </LfStack>
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABEL.back}
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <LfIcon name="arrow-back" />
          </Pressable>
        )}
      />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {HISTORY_TABS.map((tab) => {
          const label = tabLabel(LABEL, tab, state.counts[tab]);
          const active = selectedTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              style={styles.tab}
              onPress={() => dispatch({ type: 'TAB_SELECTED', tab })}
            >
              <LfChip label={label} tone={active ? 'ink' : 'outline'} size="md" />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>
        {selected.loading || selected.items === null ? (
          <View style={styles.centered}><LfText secondary>{LABEL.loading}</LfText></View>
        ) : selected.loadFailed && (selected.items ?? []).length === 0 ? (
          <LfStack grow center gap={4}>
            <LfText variant="error" align="center">{LABEL.loadError}</LfText>
            <LfButton
              accessibilityLabel={LABEL.retryListAccessibility}
              label={LABEL.retry}
              variant="text"
              onPress={() => void loadFirstPage(selectedTab, false)}
            />
          </LfStack>
        ) : (
          <FlatList
            testID="history-list"
            data={selected.items ?? []}
            keyExtractor={(item) => item.promise_id}
            renderItem={({ item }) => (
              <PromiseListRow item={item} now={now} onOpen={openPromise} />
            )}
            contentContainerStyle={styles.content}
            ListEmptyComponent={(
              <View style={styles.empty}>
                <LfEmpty title={LABEL.empty} description={LABEL.emptyDescription} />
              </View>
            )}
            ListFooterComponent={pageFooter}
            onEndReached={() => void loadNextPage(selectedTab)}
            onEndReachedThreshold={0.4}
            refreshControl={(
              <RefreshControl
                refreshing={selected.refreshing}
                onRefresh={() => void loadFirstPage(selectedTab, true)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
