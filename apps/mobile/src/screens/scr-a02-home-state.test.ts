const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_ID = '33333333-3333-4333-8333-333333333333';

interface StateModule {
  createInitialHomeState: () => any;
  promiseHomeReducer: (state: any, action: Record<string, unknown>) => any;
}

function loadState(): StateModule | null {
  try {
    return require('./scr-a02-home-state.ts') as StateModule;
  } catch {
    return null;
  }
}

function card(promiseId: string, status = 'ACTIVE') {
  return {
    promise_id: promiseId,
    title: promiseId,
    status,
    end_date: status === 'DRAFT' ? null : '2026-08-30',
    updated_at: '2026-08-16T00:00:00Z',
    closed_at: null,
    my_role: 'CREATOR',
    creator: { nickname: '작성자', profile_image_url: null },
    partner: null,
    has_witness: false,
    needs_response: false,
  };
}

function loadedActive(module: StateModule) {
  const initial = module.createInitialHomeState();
  const started = module.promiseHomeReducer(initial, {
    type: 'LOAD_STARTED',
    tab: 'ACTIVE',
    loadId: 1,
    refresh: false,
  });
  return module.promiseHomeReducer(started, {
    type: 'LOAD_SUCCEEDED',
    tab: 'ACTIVE',
    loadId: 1,
    items: [card(FIRST_ID)],
    pinned: [card(SECOND_ID, 'CHECKING')],
    counts: { ACTIVE: 2, WAITING: 1, COMPLETED: 0 },
    nextCursor: {
      tab: 'ACTIVE',
      status_rank: 1,
      end_date: '2026-08-30',
      promise_id: FIRST_ID,
    },
  });
}

describe('SCR-A02 탭별 홈 상태', () => {
  test('초기 상태는 ACTIVE만 선택하고 세 탭의 cache를 서로 공유하지 않는다', () => {
    const module = loadState();
    expect(module?.createInitialHomeState).toEqual(expect.any(Function));

    const state = module?.createInitialHomeState();
    expect(state).toMatchObject({
      selectedTab: 'ACTIVE',
      counts: { ACTIVE: 0, WAITING: 0, COMPLETED: 0, DONE: 0, BROKEN: 0, UNSETTLED: 0, DECLINED: 0 },
      tabs: {
        ACTIVE: { items: null, pinned: [], nextCursor: null },
        WAITING: { items: null, pinned: [], nextCursor: null },
        COMPLETED: { items: null, pinned: [], nextCursor: null },
      },
    });
    expect(state.tabs.ACTIVE).not.toBe(state.tabs.WAITING);
  });

  test('탭 전환은 기존 탭의 목록·cursor·임박 cache를 유지한다', () => {
    const module = loadState()!;
    const active = loadedActive(module);
    const switched = module.promiseHomeReducer(active, { type: 'TAB_SELECTED', tab: 'WAITING' });

    expect(switched.selectedTab).toBe('WAITING');
    expect(switched.tabs.ACTIVE).toEqual(active.tabs.ACTIVE);
    expect(switched.tabs.WAITING.items).toBeNull();
  });

  test('page 성공은 promise_id를 중복 제거해 뒤에 붙이고 cursor를 교체한다', () => {
    const module = loadState()!;
    const active = loadedActive(module);
    const pageStarted = module.promiseHomeReducer(active, {
      type: 'PAGE_STARTED',
      tab: 'ACTIVE',
      requestId: 2,
      generation: 1,
    });
    const succeeded = module.promiseHomeReducer(pageStarted, {
      type: 'PAGE_SUCCEEDED',
      tab: 'ACTIVE',
      requestId: 2,
      generation: 1,
      items: [card(FIRST_ID), card(SECOND_ID), card(THIRD_ID)],
      nextCursor: null,
    });

    expect(succeeded.tabs.ACTIVE.items.map((item: any) => item.promise_id)).toEqual([
      FIRST_ID,
      THIRD_ID,
    ]);
    expect(succeeded.tabs.ACTIVE).toMatchObject({
      nextCursor: null,
      pagePending: false,
      pageFailed: false,
    });
  });

  test('ACTIVE 첫 page에서도 pinned 약속은 일반 목록에서 제거한다', () => {
    const module = loadState()!;
    const initial = module.createInitialHomeState();
    const started = module.promiseHomeReducer(initial, {
      type: 'LOAD_STARTED',
      tab: 'ACTIVE',
      loadId: 1,
      refresh: false,
    });
    const succeeded = module.promiseHomeReducer(started, {
      type: 'LOAD_SUCCEEDED',
      tab: 'ACTIVE',
      loadId: 1,
      items: [card(FIRST_ID), card(SECOND_ID, 'CHECKING')],
      pinned: [card(SECOND_ID, 'CHECKING')],
      counts: { ACTIVE: 2, WAITING: 0, COMPLETED: 0 },
      nextCursor: null,
    });

    expect(succeeded.tabs.ACTIVE.items.map((item: any) => item.promise_id)).toEqual([FIRST_ID]);
  });

  test('page 중복 시작은 첫 request를 보존하고 실패해도 기존 목록·재시도 가능 상태를 유지한다', () => {
    const module = loadState()!;
    const active = loadedActive(module);
    const first = module.promiseHomeReducer(active, {
      type: 'PAGE_STARTED',
      tab: 'ACTIVE',
      requestId: 2,
      generation: 1,
    });
    const duplicate = module.promiseHomeReducer(first, {
      type: 'PAGE_STARTED',
      tab: 'ACTIVE',
      requestId: 3,
      generation: 1,
    });
    const failed = module.promiseHomeReducer(duplicate, {
      type: 'PAGE_FAILED',
      tab: 'ACTIVE',
      requestId: 2,
      generation: 1,
    });
    const retry = module.promiseHomeReducer(failed, {
      type: 'PAGE_STARTED',
      tab: 'ACTIVE',
      requestId: 4,
      generation: 1,
    });

    expect(duplicate).toBe(first);
    expect(failed.tabs.ACTIVE.items).toEqual(active.tabs.ACTIVE.items);
    expect(failed.tabs.ACTIVE).toMatchObject({ pagePending: false, pageFailed: true });
    expect(retry.tabs.ACTIVE).toMatchObject({ pagePending: true, pageFailed: false });
  });

  test('refresh는 선택 탭만 교체하고 시작 전에 발급된 page 완료를 무시한다', () => {
    const module = loadState()!;
    const active = loadedActive(module);
    const pageStarted = module.promiseHomeReducer(active, {
      type: 'PAGE_STARTED',
      tab: 'ACTIVE',
      requestId: 2,
      generation: 1,
    });
    const refreshStarted = module.promiseHomeReducer(pageStarted, {
      type: 'LOAD_STARTED',
      tab: 'ACTIVE',
      loadId: 3,
      refresh: true,
    });
    const stalePage = module.promiseHomeReducer(refreshStarted, {
      type: 'PAGE_SUCCEEDED',
      tab: 'ACTIVE',
      requestId: 2,
      generation: 1,
      items: [card(SECOND_ID)],
      nextCursor: null,
    });
    const refreshed = module.promiseHomeReducer(stalePage, {
      type: 'LOAD_SUCCEEDED',
      tab: 'ACTIVE',
      loadId: 3,
      items: [card(SECOND_ID)],
      pinned: [],
      counts: { ACTIVE: 1, WAITING: 1, COMPLETED: 0 },
      nextCursor: null,
    });

    expect(stalePage).toBe(refreshStarted);
    expect(refreshed.tabs.ACTIVE.items.map((item: any) => item.promise_id)).toEqual([SECOND_ID]);
    expect(refreshed.tabs.WAITING.items).toBeNull();
  });

  test('refresh 실패는 마지막 성공 목록·cursor를 보존하고 오류 상태만 표시한다', () => {
    const module = loadState()!;
    const active = loadedActive(module);
    const started = module.promiseHomeReducer(active, {
      type: 'LOAD_STARTED',
      tab: 'ACTIVE',
      loadId: 2,
      refresh: true,
    });
    const failed = module.promiseHomeReducer(started, {
      type: 'LOAD_FAILED',
      tab: 'ACTIVE',
      loadId: 2,
    });

    expect(failed.tabs.ACTIVE.items).toEqual(active.tabs.ACTIVE.items);
    expect(failed.tabs.ACTIVE.nextCursor).toEqual(active.tabs.ACTIVE.nextCursor);
    expect(failed.tabs.ACTIVE).toMatchObject({ loadFailed: true, refreshing: false });
  });

  test('서로 다른 탭 요청이 역순 완료돼도 최신 전체 count를 오래된 응답으로 덮지 않는다', () => {
    const module = loadState()!;
    const initial = module.createInitialHomeState();
    const activeStarted = module.promiseHomeReducer(initial, {
      type: 'LOAD_STARTED',
      tab: 'ACTIVE',
      loadId: 1,
      refresh: false,
    });
    const waitingStarted = module.promiseHomeReducer(activeStarted, {
      type: 'LOAD_STARTED',
      tab: 'WAITING',
      loadId: 2,
      refresh: false,
    });
    const waitingSucceeded = module.promiseHomeReducer(waitingStarted, {
      type: 'LOAD_SUCCEEDED',
      tab: 'WAITING',
      loadId: 2,
      items: [card(SECOND_ID, 'PENDING')],
      pinned: [],
      counts: { ACTIVE: 4, WAITING: 3, COMPLETED: 2 },
      nextCursor: null,
    });
    const activeSucceededLate = module.promiseHomeReducer(waitingSucceeded, {
      type: 'LOAD_SUCCEEDED',
      tab: 'ACTIVE',
      loadId: 1,
      items: [card(FIRST_ID)],
      pinned: [],
      counts: { ACTIVE: 1, WAITING: 1, COMPLETED: 1 },
      nextCursor: null,
    });

    expect(activeSucceededLate.tabs.ACTIVE.items).toHaveLength(1);
    expect(activeSucceededLate.counts).toEqual({ ACTIVE: 4, WAITING: 3, COMPLETED: 2, DONE: 0, BROKEN: 0, UNSETTLED: 0, DECLINED: 0 });
  });

  test('DRAFT 삭제 성공은 WAITING cache와 count에서 정확히 한 건만 제거한다', () => {
    const module = loadState()!;
    const initial = module.createInitialHomeState();
    const waitingLoaded = {
      ...initial,
      counts: { ACTIVE: 0, WAITING: 2, COMPLETED: 0 },
      tabs: {
        ...initial.tabs,
        WAITING: {
          ...initial.tabs.WAITING,
          items: [card(FIRST_ID, 'DRAFT'), card(SECOND_ID, 'PENDING')],
        },
      },
    };
    const deleted = module.promiseHomeReducer(waitingLoaded, {
      type: 'DRAFT_DELETED',
      promiseId: FIRST_ID,
    });

    expect(deleted.tabs.WAITING.items.map((item: any) => item.promise_id)).toEqual([SECOND_ID]);
    expect(deleted.counts.WAITING).toBe(1);
  });
});
