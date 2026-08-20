import {
  PROMISE_STATUS_LABEL,
  ddayFrom,
  formatDday,
  formatKstDate,
  type PromiseHomeCard,
  type PromiseHomeTab,
} from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfAdSlot } from '../components/LfAdSlot';
import { LfAvatar } from '../components/LfAvatar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfChip, type LfChipTone } from '../components/LfChip';
import { LfEmpty } from '../components/LfEmpty';
import { LfFab } from '../components/LfFab';
import { LfIcon } from '../components/LfIcon';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { deleteDraft, listHomePromises } from '../lib/home-promises-native.ts';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import {
  createInitialHomeState,
  promiseHomeReducer,
} from '../screens/scr-a02-home-state.ts';
import { SCR_A02_LABEL as HOME_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, gutter, size, space } from '../theme/tokens';

const TABS: readonly PromiseHomeTab[] = ['ACTIVE', 'WAITING', 'COMPLETED'];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: gutter.app,
  },
  tab: {
    flex: 1,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: gutter.app,
    paddingBottom: size.fabHeight + gutter.app + space[9],
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appBarAction: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { gap: space[5] },
  partyText: { flex: 1 },
  pinned: { gap: space[5], marginBottom: space[5] },
  footer: { paddingVertical: space[7] },
  listFooter: { gap: space[5] },
});

function tabLabel(tab: PromiseHomeTab, count: number): string {
  if (tab === 'ACTIVE') return HOME_LABEL.activeTab(count);
  if (tab === 'WAITING') return HOME_LABEL.waitingTab(count);
  return HOME_LABEL.completedTab(count);
}

function statusTone(status: PromiseHomeCard['status']): LfChipTone {
  if (status === 'CHECKING') return 'urgent';
  if (status === 'COMPLETED') return 'done';
  if (status === 'BROKEN') return 'broken';
  return status === 'ACTIVE' ? 'status' : 'neutral';
}

function counterpart(item: PromiseHomeCard): PromiseHomeCard['creator'] {
  if (item.my_role === 'CREATOR' && item.partner !== null) return item.partner;
  return item.creator;
}

interface HomeCardProps {
  item: PromiseHomeCard;
  now: Date;
  onOpen: (item: PromiseHomeCard) => void;
  onDelete: (item: PromiseHomeCard) => void;
  pinned?: boolean;
}

function PromiseCard({
  item,
  now,
  onOpen,
  onDelete,
  pinned = false,
}: HomeCardProps): React.JSX.Element {
  const partnerName = item.partner?.nickname ?? HOME_LABEL.partnerFallback;
  const other = counterpart(item);
  const content = (
    <LfCard variant={pinned ? 'container' : 'default'}>
      <View style={styles.cardBody}>
        <LfRow gap={4}>
          <LfChip label={PROMISE_STATUS_LABEL[item.status]} tone={statusTone(item.status)} />
          {item.end_date !== null && (
            <LfText variant={pinned ? 'containerAccent' : 'sectionTitle'}>
              {formatDday(ddayFrom(item.end_date, now))}
            </LfText>
          )}
        </LfRow>
        <LfText variant="subtitle">{item.title}</LfText>
        {item.end_date !== null && (
          <LfText secondary>{HOME_LABEL.endDate(formatKstDate(item.end_date))}</LfText>
        )}
        <LfRow gap={3}>
          <LfAvatar
            nickname={other.nickname}
            profileImageUrl={other.profile_image_url}
            accessibilityLabel={HOME_LABEL.profileImage(other.nickname)}
          />
          <View style={styles.partyText}>
            <LfText secondary>
              {HOME_LABEL.parties(item.creator.nickname, partnerName)}
            </LfText>
          </View>
          {item.has_witness && <LfChip label={HOME_LABEL.witness} tone="neutral" />}
        </LfRow>
        {item.status === 'CHECKING' && item.needs_response && (
          <LfStack gap={3}>
            <LfText variant="sectionTitle">{HOME_LABEL.needsResponse}</LfText>
            <LfButton
              label={HOME_LABEL.answerFulfillment}
              onPress={() => onOpen(item)}
              block
            />
          </LfStack>
        )}
        {item.status === 'DRAFT' && (
          <LfButton
            accessibilityLabel={HOME_LABEL.deleteDraft(item.title)}
            label={HOME_LABEL.delete}
            variant="text"
            onPress={() => onDelete(item)}
          />
        )}
      </View>
    </LfCard>
  );

  if (item.status === 'CHECKING' && item.needs_response) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={HOME_LABEL.open(item.title)}
      onPress={() => onOpen(item)}
    >
      {content}
    </Pressable>
  );
}

export interface HomeScreenProps {
  now?: Date;
}

export default function HomeScreen({ now = new Date() }: HomeScreenProps): React.JSX.Element {
  const router = useRouter();
  const [state, dispatch] = useReducer(promiseHomeReducer, undefined, createInitialHomeState);
  const [adsEnabled, setAdsEnabled] = useState(false);
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
    return () => {
      active = false;
    };
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
    if (
      snapshot.nextCursor === null ||
      snapshot.pagePending ||
      pagingTabs.current.has(tab)
    ) return;
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

  // 상세·작성 화면에서 상태를 바꾸고 돌아온 경우를 위해 재포커스마다 현재 탭을 새로고침한다.
  // 첫 포커스는 아래 mount 로딩과 겹치므로 건너뛴다.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      void loadFirstPage(stateRef.current.selectedTab, true);
    }, [loadFirstPage]),
  );

  const selected = state.tabs[state.selectedTab];
  useEffect(() => {
    if (selected.items === null && !selected.loading && !selected.loadFailed) {
      void loadFirstPage(state.selectedTab, false);
    }
  }, [loadFirstPage, selected.items, selected.loadFailed, selected.loading, state.selectedTab]);

  const openPromise = useCallback((item: PromiseHomeCard) => {
    if (item.status === 'DRAFT') {
      router.push({ pathname: '/promise/edit', params: { promise_id: item.promise_id } });
    } else {
      router.push({
        pathname: '/promise/[promise_id]',
        params: { promise_id: item.promise_id },
      });
    }
  }, [router]);

  const removeDraft = useCallback(async (item: PromiseHomeCard) => {
    await deleteDraft(item.promise_id);
    dispatch({ type: 'DRAFT_DELETED', promiseId: item.promise_id });
  }, []);

  const confirmDelete = useCallback((item: PromiseHomeCard) => {
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
              onPress: async () => await removeDraft(item),
            },
          ]);
        },
      },
    ]);
  }, [removeDraft]);

  const renderCard = useCallback(
    ({ item }: { item: PromiseHomeCard }) => (
      <PromiseCard item={item} now={now} onOpen={openPromise} onDelete={confirmDelete} />
    ),
    [confirmDelete, now, openPromise],
  );

  const pinnedHeader = state.selectedTab === 'ACTIVE' && selected.pinned.length > 0 ? (
    <View style={styles.pinned}>
      <LfText variant="sectionTitle">{HOME_LABEL.pinnedTitle}</LfText>
      {selected.pinned.map((item) => (
        <PromiseCard
          key={item.promise_id}
          item={item}
          now={now}
          onOpen={openPromise}
          onDelete={confirmDelete}
          pinned
        />
      ))}
    </View>
  ) : null;

  const pageFooter = selected.pagePending || selected.pageFailed ? (
    <View style={styles.footer}>
      {selected.pagePending ? (
        <LfText align="center" secondary>{HOME_LABEL.loading}</LfText>
      ) : (
        <LfStack gap={3} center>
          <LfText secondary>{HOME_LABEL.pageError}</LfText>
          <LfButton
            accessibilityLabel={HOME_LABEL.retryPageAccessibility}
            label={HOME_LABEL.retry}
            variant="text"
            onPress={() => void loadNextPage(state.selectedTab)}
          />
        </LfStack>
      )}
    </View>
  ) : null;

  const listFooter = pageFooter === null && !adsEnabled ? null : (
    <View style={styles.listFooter}>
      {pageFooter}
      <LfAdSlot enabled={adsEnabled} />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={HOME_LABEL.brand}
        brand
        action={(
          <LfRow gap={1}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={HOME_LABEL.notifications}
              style={styles.appBarAction}
              onPress={() => router.push('/notifications')}
            >
              <LfIcon name="notifications-none" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={HOME_LABEL.profile}
              style={styles.appBarAction}
              onPress={() => router.push('/profile')}
            >
              <LfIcon name="person-outline" />
            </Pressable>
          </LfRow>
        )}
      />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map((tab) => {
          const selectedTab = state.selectedTab === tab;
          const label = tabLabel(tab, state.counts[tab]);
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: selectedTab }}
              style={styles.tab}
              onPress={() => dispatch({ type: 'TAB_SELECTED', tab })}
            >
              <LfChip label={label} tone={selectedTab ? 'urgent' : 'neutral'} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>
        {selected.loading || selected.items === null ? (
          <View style={styles.centered}>
            <LfText secondary>{HOME_LABEL.loading}</LfText>
          </View>
        ) : selected.loadFailed && selected.items.length === 0 && selected.pinned.length === 0 ? (
          <LfStack grow center gap={4}>
            <LfText secondary align="center">{HOME_LABEL.loadError}</LfText>
            <LfButton
              accessibilityLabel={HOME_LABEL.retryListAccessibility}
              label={HOME_LABEL.retry}
              variant="text"
              onPress={() => void loadFirstPage(state.selectedTab, false)}
            />
          </LfStack>
        ) : (
          <FlatList
            testID="home-list"
            data={selected.items}
            keyExtractor={(item) => item.promise_id}
            renderItem={renderCard}
            ItemSeparatorComponent={() => <View style={{ height: space[5] }} />}
            contentContainerStyle={styles.content}
            ListHeaderComponent={pinnedHeader}
            ListEmptyComponent={selected.pinned.length === 0 ? (
              <LfEmpty title={HOME_LABEL.empty} description={HOME_LABEL.emptyDescription} />
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
      <LfFab label={HOME_LABEL.create} onPress={() => router.push('/promise/edit')} />
    </SafeAreaView>
  );
}
