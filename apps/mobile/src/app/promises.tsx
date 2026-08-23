import { type PromiseHomeCard, type PromiseHomeTab } from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfChip } from '../components/LfChip';
import { LfEmpty } from '../components/LfEmpty';
import { LfIcon } from '../components/LfIcon';
import { PromiseListRow } from '../components/PromiseListRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { deleteDraft, listHomePromises } from '../lib/home-promises-native.ts';
import { useLabels } from '../lib/locale-native';
import { createInitialHomeState, promiseHomeReducer } from '../screens/scr-a02-home-state.ts';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, gutter, size, space } from '../theme/tokens';

const TABS: readonly PromiseHomeTab[] = ['ACTIVE', 'WAITING', 'COMPLETED'];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: space[3], paddingHorizontal: gutter.app },
  tab: {
    flex: 1,
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
  empty: { paddingHorizontal: gutter.app },
  footer: { paddingVertical: space[7] },
});

function tabLabel(
  labels: (typeof SCR_A02_LABEL)['ko'],
  tab: PromiseHomeTab,
  count: number,
): string {
  if (tab === 'ACTIVE') return labels.activeTab(count);
  if (tab === 'WAITING') return labels.waitingTab(count);
  return labels.completedTab(count);
}

export interface PromisesScreenProps {
  now?: Date;
}

export default function PromisesScreen({ now = new Date() }: PromisesScreenProps): React.JSX.Element {
  const LABEL = useLabels(SCR_A02_LABEL);
  const router = useRouter();
  const [state, dispatch] = useReducer(promiseHomeReducer, undefined, createInitialHomeState);
  const stateRef = useRef(state);
  const nextRequestId = useRef(0);
  const loadingTabs = useRef(new Set<PromiseHomeTab>());
  const pagingTabs = useRef(new Set<PromiseHomeTab>());
  stateRef.current = state;

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
    void loadFirstPage(stateRef.current.selectedTab, true);
  }, [loadFirstPage]));

  const selected = state.tabs[state.selectedTab];
  useEffect(() => {
    if (selected.items === null && !selected.loading && !selected.loadFailed) {
      void loadFirstPage(state.selectedTab, false);
    }
  }, [loadFirstPage, selected.items, selected.loadFailed, selected.loading, state.selectedTab]);

  const openPromise = useCallback((item: PromiseHomeCard) => {
    router.push(item.status === 'DRAFT'
      ? { pathname: '/promise/edit', params: { promise_id: item.promise_id } }
      : { pathname: '/promise/[promise_id]', params: { promise_id: item.promise_id } });
  }, [router]);

  const removeDraft = useCallback(async (item: PromiseHomeCard) => {
    await deleteDraft(item.promise_id);
    dispatch({ type: 'DRAFT_DELETED', promiseId: item.promise_id });
  }, []);

  const confirmDelete = useCallback((item: PromiseHomeCard) => {
    Alert.alert(LABEL.deleteFirstTitle, LABEL.deleteFirstBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.deleteContinue,
        onPress: () => Alert.alert(LABEL.deleteFinalTitle, LABEL.deleteFinalBody, [
          { text: LABEL.cancel, style: 'cancel' },
          {
            text: LABEL.delete,
            style: 'destructive',
            onPress: async () => await removeDraft(item),
          },
        ]),
      },
    ]);
  }, [LABEL, removeDraft]);

  const pageFooter = selected.pagePending || selected.pageFailed ? (
    <View style={styles.footer}>
      {selected.pagePending ? <LfText align="center" secondary>{LABEL.loading}</LfText> : (
        <LfStack gap={3} center>
          <LfText secondary>{LABEL.pageError}</LfText>
          <LfButton
            accessibilityLabel={LABEL.retryPageAccessibility}
            label={LABEL.retry}
            variant="text"
            onPress={() => void loadNextPage(state.selectedTab)}
          />
        </LfStack>
      )}
    </View>
  ) : null;

  const items = state.selectedTab === 'ACTIVE'
    ? [...selected.pinned, ...(selected.items ?? [])]
    : selected.items ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.allPromisesTitle}
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
        {TABS.map((tab) => {
          const label = tabLabel(LABEL, tab, state.counts[tab]);
          const active = state.selectedTab === tab;
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
        ) : selected.loadFailed && items.length === 0 ? (
          <LfStack grow center gap={4}>
            <LfText secondary align="center">{LABEL.loadError}</LfText>
            <LfButton
              accessibilityLabel={LABEL.retryListAccessibility}
              label={LABEL.retry}
              variant="text"
              onPress={() => void loadFirstPage(state.selectedTab, false)}
            />
          </LfStack>
        ) : (
          <FlatList
            testID="promises-list"
            data={items}
            keyExtractor={(item) => item.promise_id}
            renderItem={({ item }) => (
              <PromiseListRow item={item} now={now} onOpen={openPromise} onDelete={confirmDelete} />
            )}
            contentContainerStyle={styles.content}
            ListEmptyComponent={(
              <View style={styles.empty}>
                <LfEmpty title={LABEL.empty} description={LABEL.emptyDescription} />
              </View>
            )}
            ListFooterComponent={pageFooter}
            onEndReached={() => void loadNextPage(state.selectedTab)}
            onEndReachedThreshold={0.4}
            refreshControl={(
              <RefreshControl
                refreshing={selected.refreshing}
                onRefresh={() => void loadFirstPage(state.selectedTab, true)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
