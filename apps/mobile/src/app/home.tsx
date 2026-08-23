import {
  ddayFrom,
  formatDday,
  formatKstDate,
  type PromiseHomeCard,
} from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAdSlot } from '../components/LfAdSlot';
import { LfAppBar } from '../components/LfAppBar';
import { LfBottomNav } from '../components/LfBottomNav';
import { LfButton } from '../components/LfButton';
import { LfEmpty } from '../components/LfEmpty';
import { LfHero } from '../components/LfHero';
import { LfIcon } from '../components/LfIcon';
import { PromiseListRow } from '../components/PromiseListRow';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { LfTrustStrip } from '../components/LfTrustStrip';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { listHomePromises } from '../lib/home-promises-native.ts';
import { useLabels } from '../lib/locale-native';
import { loadTrustProfile } from '../lib/trust-profile-native.ts';
import { createInitialHomeState, promiseHomeReducer } from '../screens/scr-a02-home-state.ts';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, gutter, radius, size, space } from '../theme/tokens';

const ACTIVE_TAB = 'ACTIVE' as const;

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
  const loading = useRef(false);
  const paging = useRef(false);
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

  const loadFirstPage = useCallback(async (refresh: boolean) => {
    if (loading.current) return;
    loading.current = true;
    const loadId = ++nextRequestId.current;
    dispatch({ type: 'LOAD_STARTED', tab: ACTIVE_TAB, loadId, refresh });
    try {
      const result = await listHomePromises({ tab: ACTIVE_TAB });
      dispatch({
        type: 'LOAD_SUCCEEDED',
        tab: ACTIVE_TAB,
        loadId,
        items: result.items,
        pinned: result.pinned,
        counts: result.counts,
        nextCursor: result.next_cursor,
      });
    } catch {
      dispatch({ type: 'LOAD_FAILED', tab: ACTIVE_TAB, loadId });
    } finally {
      loading.current = false;
    }
  }, []);

  const loadNextPage = useCallback(async () => {
    const snapshot = stateRef.current.tabs.ACTIVE;
    if (snapshot.nextCursor === null || snapshot.pagePending || paging.current) return;
    paging.current = true;
    const requestId = ++nextRequestId.current;
    const generation = snapshot.latestLoadId;
    dispatch({ type: 'PAGE_STARTED', tab: ACTIVE_TAB, requestId, generation });
    try {
      const result = await listHomePromises({ tab: ACTIVE_TAB, cursor: snapshot.nextCursor });
      dispatch({
        type: 'PAGE_SUCCEEDED',
        tab: ACTIVE_TAB,
        requestId,
        generation,
        items: result.items,
        nextCursor: result.next_cursor,
      });
    } catch {
      dispatch({ type: 'PAGE_FAILED', tab: ACTIVE_TAB, requestId, generation });
    } finally {
      paging.current = false;
    }
  }, []);

  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    void loadFirstPage(true);
  }, [loadFirstPage]));

  const active = state.tabs.ACTIVE;
  useEffect(() => {
    if (active.items === null && !active.loading && !active.loadFailed) void loadFirstPage(false);
  }, [active.items, active.loadFailed, active.loading, loadFirstPage]);

  const openPromise = useCallback((item: PromiseHomeCard) => {
    router.push({ pathname: '/promise/[promise_id]', params: { promise_id: item.promise_id } });
  }, [router]);

  const hero = active.pinned[0] ?? active.items?.[0] ?? null;
  const heroId = hero?.promise_id;
  const rows = [...active.pinned.slice(1), ...(active.items ?? [])].filter(
    (item) => item.promise_id !== heroId,
  );

  const pageFooter = active.pagePending || active.pageFailed ? (
    <View style={styles.pageFooter}>
      {active.pagePending ? <LfText align="center" secondary>{LABEL.loading}</LfText> : (
        <LfStack gap={3} center>
          <LfText secondary>{LABEL.pageError}</LfText>
          <LfButton
            accessibilityLabel={LABEL.retryPageAccessibility}
            label={LABEL.retry}
            variant="text"
            onPress={() => void loadNextPage()}
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
        <View style={styles.sectionTitle}><LfText variant="subtitle">{LABEL.activeSection}</LfText></View>
        <LfButton
          accessibilityLabel={LABEL.allPromisesAccessibility}
          label={LABEL.allPromises}
          variant="text"
          onPress={() => router.push('/promises')}
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
        {active.loading || active.items === null ? (
          <View style={styles.centered}><LfText secondary>{LABEL.loading}</LfText></View>
        ) : active.loadFailed && hero === null && rows.length === 0 ? (
          <LfStack grow center gap={4}>
            <LfText secondary align="center">{LABEL.loadError}</LfText>
            <LfButton
              accessibilityLabel={LABEL.retryListAccessibility}
              label={LABEL.retry}
              variant="text"
              onPress={() => void loadFirstPage(false)}
            />
          </LfStack>
        ) : (
          <FlatList
            testID="home-list"
            style={styles.list}
            data={rows}
            keyExtractor={(item) => item.promise_id}
            renderItem={({ item }) => (
              <PromiseListRow item={item} now={now} onOpen={openPromise} />
            )}
            contentContainerStyle={styles.content}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={hero === null ? (
              <View style={styles.empty}>
                <LfEmpty title={LABEL.empty} description={LABEL.emptyDescription} />
              </View>
            ) : null}
            ListFooterComponent={listFooter}
            onEndReached={() => void loadNextPage()}
            onEndReachedThreshold={0.4}
            refreshControl={(
              <RefreshControl refreshing={active.refreshing} onRefresh={() => void loadFirstPage(true)} />
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
