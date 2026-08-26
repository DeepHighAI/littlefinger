import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import HomeScreen from '../app/home';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { listHomePromises } from '../lib/home-promises-native.ts';
import { loadTrustProfile } from '../lib/trust-profile-native.ts';
import { colors } from '../theme/tokens.ts';

const mockFocusEffects = new Set<() => undefined | (() => void)>();
function triggerFocus(): void {
  for (const effect of [...mockFocusEffects]) effect();
}
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      mockFocusEffects.add(effect);
      const cleanupEffect = effect();
      return () => {
        mockFocusEffects.delete(effect);
        if (typeof cleanupEffect === 'function') cleanupEffect();
      };
    }, [effect]);
  },
}));
jest.mock('../lib/ads-config-native.ts', () => ({ readAdsEnabled: jest.fn() }));
jest.mock('../lib/home-promises-native.ts', () => ({ listHomePromises: jest.fn() }));
jest.mock('../lib/trust-profile-native.ts', () => ({ loadTrustProfile: jest.fn() }));
jest.mock('../components/LfAdSlot', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return { LfAdSlot: ({ enabled }: { enabled: boolean }) => enabled ? <View testID="lf-ad-slot" /> : null };
});

const NOW = new Date('2026-08-16T00:00:00Z');
const ACTIVE_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const push = jest.fn();
const replace = jest.fn();

function card(input: {
  id: string;
  title: string;
  status?: string;
  endDate?: string | null;
  needsResponse?: boolean;
  witness?: boolean;
}) {
  return {
    promise_id: input.id,
    title: input.title,
    status: input.status ?? 'ACTIVE',
    end_date: input.endDate === undefined ? '2026-08-30' : input.endDate,
    updated_at: '2026-08-16T00:00:00Z',
    closed_at: null,
    my_role: 'CREATOR',
    creator: { nickname: '지우', profile_image_url: null },
    partner: { nickname: '민준', profile_image_url: null },
    has_witness: input.witness ?? false,
    needs_response: input.needsResponse ?? false,
  } as any;
}

function response(input: { items?: any[]; pinned?: any[]; nextCursor?: any } = {}) {
  return {
    items: input.items ?? [],
    pinned: input.pinned ?? [],
    counts: { ACTIVE: (input.items?.length ?? 0) + (input.pinned?.length ?? 0), WAITING: 2, COMPLETED: 3 },
    next_cursor: input.nextCursor ?? null,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe('SCR-A02 Soft Promise 홈', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, replace } as never);
    jest.mocked(listHomePromises).mockReset().mockResolvedValue(response());
    jest.mocked(readAdsEnabled).mockReset().mockResolvedValue(false);
    jest.mocked(loadTrustProfile).mockReset().mockResolvedValue({ keep_rate: 87 } as never);
  });

  afterEach(async () => {
    await cleanup();
    mockFocusEffects.clear();
  });

  test('첫 진입은 ACTIVE만 읽고 진행·대기 탭과 히스토리 버튼을 보여준다 (ADR 0011)', async () => {
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(listHomePromises).toHaveBeenCalledWith({ tab: 'ACTIVE' });
    expect(view.getByText('이번 주도 약속을 챙겨볼까요?')).toBeTruthy();
    // 홈 탭은 진행·대기 둘뿐이다 — 종결은 히스토리 화면의 몫이다.
    expect(view.getByRole('tab', { name: '진행 중 0' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '대기 2' })).toBeTruthy();
    expect(view.queryByRole('tab', { name: /완료/u })).toBeNull();
    expect(view.getByRole('button', { name: '지난 약속 히스토리 보기' })).toBeTruthy();
    expect(view.getByRole('button', { name: '작성' })).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('대기 탭은 초안·대기 목록을 읽고 히어로 없이 초안 삭제 진입점을 준다', async () => {
    jest.mocked(listHomePromises).mockImplementation(async (input: { tab: string }) =>
      input.tab === 'WAITING'
        ? response({ items: [card({ id: SECOND_ID, title: '초안 약속', status: 'DRAFT', endDate: null })] })
        : response({ pinned: [card({ id: ACTIVE_ID, title: '히어로' })] }),
    );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    await fireEvent.press(view.getByRole('tab', { name: '대기 2' }));
    await settle();

    expect(listHomePromises).toHaveBeenCalledWith({ tab: 'WAITING' });
    expect(view.queryByTestId('home-hero')).toBeNull();
    expect(view.getByText('대기 중 약속')).toBeTruthy();
    expect(view.getByText('초안 약속')).toBeTruthy();
    expect(view.getByRole('button', { name: '초안 약속 초안 삭제' })).toBeTruthy();
  });

  test('가장 가까운 약속은 히어로 한 곳에만 나오고 상세로 이동한다', async () => {
    jest.mocked(listHomePromises).mockResolvedValue(response({
      pinned: [card({ id: ACTIVE_ID, title: '내일까지 함께 걷기', endDate: '2026-08-17' })],
      items: [
        card({ id: ACTIVE_ID, title: '내일까지 함께 걷기', endDate: '2026-08-17' }),
        card({ id: SECOND_ID, title: '주말에 책 읽기' }),
      ],
    }));
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(view.getByTestId('home-hero')).toBeTruthy();
    expect(view.getAllByText('내일까지 함께 걷기')).toHaveLength(1);
    expect(StyleSheet.flatten(view.getByText('D-1').props.style).color).toBe(colors.primaryInk);
    expect(view.getByText('주말에 책 읽기')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '약속 보기' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/promise/[promise_id]', params: { promise_id: ACTIVE_ID },
    });
  });

  test('이행 응답이 필요한 히어로는 상태를 텍스트로 말하고 같은 상세를 연다', async () => {
    jest.mocked(listHomePromises).mockResolvedValue(response({
      pinned: [card({ id: ACTIVE_ID, title: '확인할 약속', status: 'CHECKING', needsResponse: true })],
    }));
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(view.getByText('이행 확인 필요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '지켜졌나요? 답하기' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/promise/[promise_id]', params: { promise_id: ACTIVE_ID },
    });
  });

  test('히어로 밖 이행 응답 항목은 일반 행이 아니라 강조 컨테이너를 쓴다', async () => {
    jest.mocked(listHomePromises).mockResolvedValue(response({
      pinned: [card({ id: ACTIVE_ID, title: '히어로' })],
      items: [card({ id: SECOND_ID, title: '응답할 약속', status: 'CHECKING', needsResponse: true })],
    }));
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(view.getByTestId(`promise-response-${SECOND_ID}`)).toBeTruthy();
    expect(view.getByRole('button', { name: '지켜졌나요? 답하기' })).toBeTruthy();
  });

  test('일반 행은 상태·종료일·당사자·증인을 텍스트로 표시한다', async () => {
    jest.mocked(listHomePromises).mockResolvedValue(response({
      pinned: [card({ id: ACTIVE_ID, title: '히어로' })],
      items: [card({ id: SECOND_ID, title: '함께 걷기', witness: true })],
    }));
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(view.getByText('진행 중')).toBeTruthy();
    expect(view.getAllByText('종료일 2026-08-30 (일)').length).toBeGreaterThan(0);
    expect(view.getAllByText('지우 — 민준').length).toBeGreaterThan(0);
    expect(view.getByText('증인')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '함께 걷기 열기' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/promise/[promise_id]', params: { promise_id: SECOND_ID },
    });
  });

  test('히스토리·지킴율·하단 목적지는 각각 올바른 경로를 연다', async () => {
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '지난 약속 히스토리 보기' }));
    await fireEvent.press(view.getByRole('button', { name: '지금까지 약속의 87%를 지켰어요' }));
    await fireEvent.press(view.getByRole('tab', { name: '마이' }));
    expect(push).toHaveBeenCalledWith('/history');
    expect(replace).toHaveBeenNthCalledWith(1, '/profile');
    expect(replace).toHaveBeenNthCalledWith(2, '/profile');
  });

  test('광고 플래그가 true일 때만 실제 슬롯을 렌더한다', async () => {
    jest.mocked(readAdsEnabled).mockResolvedValue(true);
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(view.getAllByTestId('lf-ad-slot')).toHaveLength(1);
  });

  test('페이지 추가와 재포커스 새로고침은 ACTIVE 계약을 유지한다', async () => {
    const cursor = { tab: 'ACTIVE', status_rank: 1, end_date: '2026-08-30', promise_id: ACTIVE_ID };
    jest.mocked(listHomePromises)
      .mockResolvedValueOnce(response({ pinned: [card({ id: ACTIVE_ID, title: '히어로' })], nextCursor: cursor }))
      .mockResolvedValueOnce(response({ items: [card({ id: SECOND_ID, title: '다음 페이지' })] }))
      .mockResolvedValueOnce(response());
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await act(async () => view.getByTestId('home-list').props.onEndReached());
    await settle();
    expect(listHomePromises).toHaveBeenNthCalledWith(2, { tab: 'ACTIVE', cursor });
    expect(view.getByText('다음 페이지')).toBeTruthy();
    await act(async () => triggerFocus());
    await settle();
    expect(listHomePromises).toHaveBeenLastCalledWith({ tab: 'ACTIVE' });
  });
});
