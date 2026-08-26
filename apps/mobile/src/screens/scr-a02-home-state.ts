import type {
  PromiseHomeCard,
  PromiseHomeCursor,
  PromiseHomeTab,
} from '@littlefinger/shared';

export interface PromiseHomeTabState {
  items: readonly PromiseHomeCard[] | null;
  pinned: readonly PromiseHomeCard[];
  nextCursor: PromiseHomeCursor | null;
  latestLoadId: number;
  loading: boolean;
  refreshing: boolean;
  loadFailed: boolean;
  pagePending: boolean;
  pageFailed: boolean;
  pageRequestId: number | null;
  pageGeneration: number | null;
}

export interface PromiseHomeState {
  selectedTab: PromiseHomeTab;
  /** 서버 counts 는 요청 탭 패밀리의 키만 싣는다(ADR 0011) — 도착분을 병합해 쌓는다. */
  counts: Record<PromiseHomeTab, number>;
  latestCountsLoadId: number;
  tabs: Record<PromiseHomeTab, PromiseHomeTabState>;
}

export type PromiseHomeAction =
  | { type: 'TAB_SELECTED'; tab: PromiseHomeTab }
  | { type: 'LOAD_STARTED'; tab: PromiseHomeTab; loadId: number; refresh: boolean }
  | {
      type: 'LOAD_SUCCEEDED';
      tab: PromiseHomeTab;
      loadId: number;
      items: readonly PromiseHomeCard[];
      pinned: readonly PromiseHomeCard[];
      counts: Readonly<Partial<Record<PromiseHomeTab, number>>>;
      nextCursor: PromiseHomeCursor | null;
    }
  | { type: 'LOAD_FAILED'; tab: PromiseHomeTab; loadId: number }
  | {
      type: 'PAGE_STARTED';
      tab: PromiseHomeTab;
      requestId: number;
      generation: number;
    }
  | {
      type: 'PAGE_SUCCEEDED';
      tab: PromiseHomeTab;
      requestId: number;
      generation: number;
      items: readonly PromiseHomeCard[];
      nextCursor: PromiseHomeCursor | null;
    }
  | {
      type: 'PAGE_FAILED';
      tab: PromiseHomeTab;
      requestId: number;
      generation: number;
    }
  | { type: 'DRAFT_DELETED'; promiseId: string };

function initialTabState(): PromiseHomeTabState {
  return {
    items: null,
    pinned: [],
    nextCursor: null,
    latestLoadId: 0,
    loading: false,
    refreshing: false,
    loadFailed: false,
    pagePending: false,
    pageFailed: false,
    pageRequestId: null,
    pageGeneration: null,
  };
}

export function createInitialHomeState(): PromiseHomeState {
  return {
    selectedTab: 'ACTIVE',
    counts: {
      ACTIVE: 0,
      WAITING: 0,
      COMPLETED: 0,
      DONE: 0,
      BROKEN: 0,
      UNSETTLED: 0,
      DECLINED: 0,
    },
    latestCountsLoadId: 0,
    tabs: {
      ACTIVE: initialTabState(),
      WAITING: initialTabState(),
      COMPLETED: initialTabState(),
      DONE: initialTabState(),
      BROKEN: initialTabState(),
      UNSETTLED: initialTabState(),
      DECLINED: initialTabState(),
    },
  };
}

function replaceTab(
  state: PromiseHomeState,
  tab: PromiseHomeTab,
  value: PromiseHomeTabState,
): PromiseHomeState {
  return { ...state, tabs: { ...state.tabs, [tab]: value } };
}

function uniqueCards(items: readonly PromiseHomeCard[]): PromiseHomeCard[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.promise_id)) return false;
    seen.add(item.promise_id);
    return true;
  });
}

export function promiseHomeReducer(
  state: PromiseHomeState,
  action: PromiseHomeAction,
): PromiseHomeState {
  if (action.type === 'TAB_SELECTED') {
    return action.tab === state.selectedTab ? state : { ...state, selectedTab: action.tab };
  }
  if (action.type === 'DRAFT_DELETED') {
    const waiting = state.tabs.WAITING;
    const exists = waiting.items?.some(
      (item) => item.promise_id === action.promiseId && item.status === 'DRAFT',
    ) === true;
    if (!exists) return state;
    return {
      ...state,
      counts: { ...state.counts, WAITING: Math.max(0, state.counts.WAITING - 1) },
      tabs: {
        ...state.tabs,
        WAITING: {
          ...waiting,
          items: waiting.items?.filter((item) => item.promise_id !== action.promiseId) ?? [],
        },
      },
    };
  }

  const current = state.tabs[action.tab];
  switch (action.type) {
    case 'LOAD_STARTED':
      return replaceTab(state, action.tab, {
        ...current,
        latestLoadId: action.loadId,
        loading: !action.refresh && current.items === null,
        refreshing: action.refresh,
        loadFailed: false,
        pagePending: false,
        pageFailed: false,
        pageRequestId: null,
        pageGeneration: null,
      });
    case 'LOAD_SUCCEEDED':
      if (action.loadId !== current.latestLoadId) return state;
      const pinned = action.tab === 'ACTIVE' ? uniqueCards(action.pinned) : [];
      const pinnedIds = new Set(pinned.map((item) => item.promise_id));
      const hasLatestCounts = action.loadId >= state.latestCountsLoadId;
      return {
        ...replaceTab(state, action.tab, {
          ...current,
          items: uniqueCards(action.items).filter((item) => !pinnedIds.has(item.promise_id)),
          pinned,
          nextCursor: action.nextCursor,
          loading: false,
          refreshing: false,
          loadFailed: false,
          pagePending: false,
          pageFailed: false,
          pageRequestId: null,
          pageGeneration: null,
        }),
        // 홈 3키·히스토리 4키가 서로를 지우지 않도록 병합한다.
        counts: hasLatestCounts ? { ...state.counts, ...action.counts } : state.counts,
        latestCountsLoadId: hasLatestCounts ? action.loadId : state.latestCountsLoadId,
      };
    case 'LOAD_FAILED':
      if (action.loadId !== current.latestLoadId) return state;
      return replaceTab(state, action.tab, {
        ...current,
        items: current.items ?? [],
        loading: false,
        refreshing: false,
        loadFailed: true,
      });
    case 'PAGE_STARTED':
      if (
        action.generation !== current.latestLoadId ||
        current.pagePending ||
        current.nextCursor === null
      ) return state;
      return replaceTab(state, action.tab, {
        ...current,
        pagePending: true,
        pageFailed: false,
        pageRequestId: action.requestId,
        pageGeneration: action.generation,
      });
    case 'PAGE_SUCCEEDED': {
      if (
        !current.pagePending ||
        current.pageRequestId !== action.requestId ||
        current.pageGeneration !== action.generation ||
        current.latestLoadId !== action.generation
      ) return state;
      return replaceTab(state, action.tab, {
        ...current,
        items: uniqueCards([...(current.items ?? []), ...action.items]).filter(
          (item) => !current.pinned.some((pinnedItem) => pinnedItem.promise_id === item.promise_id),
        ),
        nextCursor: action.nextCursor,
        pagePending: false,
        pageFailed: false,
        pageRequestId: null,
        pageGeneration: null,
      });
    }
    case 'PAGE_FAILED':
      if (
        !current.pagePending ||
        current.pageRequestId !== action.requestId ||
        current.pageGeneration !== action.generation ||
        current.latestLoadId !== action.generation
      ) return state;
      return replaceTab(state, action.tab, {
        ...current,
        pagePending: false,
        pageFailed: true,
        pageRequestId: null,
        pageGeneration: null,
      });
  }
}
