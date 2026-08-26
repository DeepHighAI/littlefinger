import {
  ddayFrom,
  formatDday,
  formatKstDate,
  type PromiseHomeCard,
  type PromiseHomeTab,
} from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAdSlot } from '../components/LfAdSlot';
import { LfAppBar } from '../components/LfAppBar';
import { LfBottomNav } from '../components/LfBottomNav';
import { LfButton } from '../components/LfButton';
import { LfChip } from '../components/LfChip';
import { LfEmpty } from '../components/LfEmpty';
import { LfHero } from '../components/LfHero';
import { LfIcon } from '../components/LfIcon';
import { PromiseListRow } from '../components/PromiseListRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { LfTrustStrip } from '../components/LfTrustStrip';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { deleteDraft, listHomePromises } from '../lib/home-promises-native.ts';
import { useLabels } from '../lib/locale-native';
import { loadTrustProfile } from '../lib/trust-profile-native.ts';
import { createInitialHomeState, promiseHomeReducer } from '../screens/scr-a02-home-state.ts';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, gutter, radius, size, space } from '../theme/tokens';

// 홈은 진행·대기 두 탭만 가진다(PO 2026-08-26, ADR 0011). 종결은 SCR-A09 히스토리의 몫이다.
const HOME_TABS: readonly PromiseHomeTab[] = ['ACTIVE', 'WAITING'];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, backgroundColor: colors.background },
  list: { backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: space[9] },
  greeting: {
    paddingHorizontal: gutter.app,
    paddingTop: space[7],
    paddingBottom: space[7],
    gap: space[2],
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: gutter.app,
    paddingBottom: space[6],
    backgroundColor: colors.background,
  },
  tab: {
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArea: { paddingBottom: space[8], backgroundColor: colors.background },
  sectionHeader: {
    minHeight: size.touchMin,
    paddingHorizontal: gutter.app,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.record,
    borderTopRightRadius: radius.record,
  },
  sectionTitle: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter.app },
  empty: { minHeight: size.bottomNavContentHeight * 3, paddingVertical: space[9] },
  iconButton: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: space[6], paddingHorizontal: gutter.app, paddingTop: space[8] },
  pageFooter: { paddingVertical: space[7] },
});

function partiesOf(item: PromiseHomeCard, partnerFallback: string): string {
  return `${item.creator.nickname} — ${item.partner?.nickname ?? partnerFallback}`;
}

export interface HomeScreenProps {
  now?: Date;
}

export default function HomeScreen({ now = new Date() }: HomeScreenProps): React.JSX.Element {
  const LABEL = useLabels(SCR_A02_LABEL);
  const router = useRouter();
  const [state, dispatch] = useReducer(promiseHomeReducer, undefined, createInitialHomeState);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [trustRate, setTrustRate] = useState<number | null | undefined>(undefined);
  const stateRef = useRef(state);
  const nextRequestId = useRef(0);
  const loadingTabs = useRef(new Set<PromiseHomeTab>());
  const pagingTabs = useRef(new Set<PromiseHomeTab>());
  stateRef.current = state;

  useEffect(() => {
    let active = true;
    void readAdsEnabled().then((enabled) => {
      if (active) setAdsEnabled(enabled);
    });
    void loadTrustProfile()
      .then((profile) => {
        if (active) setTrustRate(profile.keep_rate);
      })
      .catch(() => {
        // 지킴율 보조 정보 실패가 핵심 약속 목록을 가리면 안 된다.
      });
    return () => { active = false; };
  }, []);

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

  const isActiveTab = state.selectedTab === 'ACTIVE';
  // 히어로는 진행 탭 전용이다 — 대기 탭은 임박·응답 개념이 없다.
  const hero = isActiveTab ? selected.pinned[0] ?? selected.items?.[0] ?? null : null;
  const heroId = hero?.promise_id;
  const rows = isActiveTab
    ? [...selected.pinned.slice(1), ...(selected.items ?? [])].filter(
        (item) => item.promise_id !== heroId,
      )
    : selected.items ?? [];

  const pageFooter = selected.pagePending || selected.pageFailed ? (
    <View style={styles.pageFooter}>
      {selected.pagePending ? <LfText align="center" secondary>{LABEL.loading}</LfText> : (
        <LfStack gap={3} center>
          <LfText variant="error">{LABEL.pageError}</LfText>
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

  const listHeader = (
    <>
      <View style={styles.greeting}>
        <LfText variant="headline">{LABEL.greeting}</LfText>
        <LfText secondary>{LABEL.greetingDescription}</LfText>
      </View>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {HOME_TABS.map((tab) => {
          const label = tab === 'ACTIVE'
            ? LABEL.activeTab(state.counts.ACTIVE)
            : LABEL.waitingTab(state.counts.WAITING);
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
      {hero !== null && (
        <View style={styles.heroArea}>
          <LfHero
            testID="home-hero"
            eyebrow={hero.needs_response ? LABEL.needsResponse : LABEL.closestPromise}
            title={hero.title}
            description={partiesOf(hero, LABEL.partnerFallback)}
            {...(hero.end_date === null
              ? {}
              : { dday: formatDday(ddayFrom(hero.end_date, now)) })}
            meta={hero.end_date === null
              ? LABEL.noEndDate
              : LABEL.endDate(formatKstDate(hero.end_date))}
            actionLabel={hero.needs_response ? LABEL.answerFulfillment : LABEL.viewPromise}
            onAction={() => openPromise(hero)}
          />
        </View>
      )}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <LfText variant="subtitle">
            {isActiveTab ? LABEL.activeSection : LABEL.waitingSection}
          </LfText>
        </View>
        <LfButton
          label={LABEL.history}
          variant="text"
          onPress={() => router.push('/history')}
        />
      </View>
    </>
  );

  const listFooter = (
    <View style={styles.footer}>
      {pageFooter}
      {trustRate !== undefined && (
        <LfTrustStrip rate={trustRate} onPress={() => router.replace('/profile')} />
      )}
      <LfAdSlot enabled={adsEnabled} />
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <LfAppBar
        title={LABEL.brand}
        brand
        action={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABEL.notifications}
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
          >
            <LfIcon name="notifications-none" size={size.appbarIcon} />
          </Pressable>
        )}
      />
      <View style={styles.body}>
        {selected.loading || selected.items === null ? (
          <View style={styles.centered}><LfText secondary>{LABEL.loading}</LfText></View>
        ) : selected.loadFailed && hero === null && rows.length === 0 ? (
          <LfStack grow center gap={4}>
            <LfText variant="error" align="center">{LABEL.loadError}</LfText>
            <LfButton
              accessibilityLabel={LABEL.retryListAccessibility}
              label={LABEL.retry}
              variant="text"
              onPress={() => void loadFirstPage(state.selectedTab, false)}
            />
          </LfStack>
        ) : (
          <FlatList
            testID="home-list"
            style={styles.list}
            data={rows}
            keyExtractor={(item) => item.promise_id}
            renderItem={({ item }) => (
              <PromiseListRow
                item={item}
                now={now}
                onOpen={openPromise}
                {...(isActiveTab ? {} : { onDelete: confirmDelete })}
              />
            )}
            contentContainerStyle={styles.content}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={hero === null ? (
              <View style={styles.empty}>
                <LfEmpty title={LABEL.empty} description={LABEL.emptyDescription} />
              </View>
            ) : null}
            ListFooterComponent={listFooter}
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
      <LfBottomNav
        active="home"
        onHomePress={() => undefined}
        onCreatePress={() => router.push('/promise/edit')}
        onProfilePress={() => router.replace('/profile')}
      />
    </SafeAreaView>
  );
}
