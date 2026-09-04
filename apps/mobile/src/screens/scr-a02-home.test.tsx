import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import HomeScreen from '../app/home';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { deleteDraft, listHomePromises } from '../lib/home-promises-native.ts';
import { deletePendingPromise } from '../lib/invite-native.ts';
import { LocaleProvider } from '../lib/locale-native.tsx';
import { loadTrustProfile } from '../lib/trust-profile-native.ts';
import { colors, size } from '../theme/tokens.ts';

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
jest.mock('../lib/home-promises-native.ts', () => ({
  deleteDraft: jest.fn(),
  listHomePromises: jest.fn(),
}));
jest.mock('../lib/invite-native.ts', () => ({ deletePendingPromise: jest.fn() }));
jest.mock('../lib/trust-profile-native.ts', () => ({ loadTrustProfile: jest.fn() }));
jest.mock('../components/LfAdSlot', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return { LfAdSlot: ({ enabled }: { enabled: boolean }) => enabled ? <View testID="lf-ad-slot" /> : null };
});
jest.mock('../components/LfBannerAd.tsx', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return { LfBannerAd: ({ enabled }: { enabled: boolean }) => enabled ? <View testID="lf-banner-ad" /> : null };
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
    jest.mocked(deleteDraft).mockReset().mockResolvedValue(undefined);
    jest.mocked(deletePendingPromise).mockReset().mockResolvedValue(undefined);
    jest.mocked(readAdsEnabled).mockReset().mockResolvedValue(false);
    jest.mocked(loadTrustProfile).mockReset().mockResolvedValue({ keep_rate: 87 } as never);
  });

  afterEach(async () => {
    await cleanup();
    mockFocusEffects.clear();
    jest.restoreAllMocks();
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
    expect(view.getByRole('button', { name: '약속 만들기' })).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    const list = view.getByTestId('home-list');
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom).toBe(size.fadeHeight);
  });

  test('대기 탭은 초안·대기 목록을 읽고 두 상태 모두 삭제 진입점을 준다', async () => {
    jest.mocked(listHomePromises).mockImplementation(async (input: { tab: string }) =>
      input.tab === 'WAITING'
        ? response({ items: [
            card({ id: SECOND_ID, title: '초안 약속', status: 'DRAFT', endDate: null }),
            card({ id: ACTIVE_ID, title: '대기 약속', status: 'PENDING' }),
          ] })
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
    expect(view.getByRole('button', { name: '대기 약속 대기 중 약속 삭제' })).toBeTruthy();
  });

  test('PENDING 삭제는 두 번 확인하고 서버 삭제 성공 뒤 대기 목록에서 제거한다', async () => {
    jest.mocked(listHomePromises).mockImplementation(async (input: { tab: string }) =>
      input.tab === 'WAITING'
        ? response({ items: [card({ id: SECOND_ID, title: '대기 약속', status: 'PENDING' })] })
        : response(),
    );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('tab', { name: '대기 2' }));
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '대기 약속 대기 중 약속 삭제' }));
    expect(alert.mock.calls[0]?.[1]).toContain('초대도 함께 취소');
    alert.mock.calls[0]?.[2]?.find((button) => button.text === '계속')?.onPress?.();
    await act(async () => {
      await alert.mock.calls[1]?.[2]?.find((button) => button.text === '삭제')?.onPress?.();
    });

    expect(deletePendingPromise).toHaveBeenCalledWith(SECOND_ID);
    expect(deleteDraft).not.toHaveBeenCalled();
    expect(view.queryByText('대기 약속')).toBeNull();
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

  test('영어 로케일은 히어로와 목록 종료일의 요일도 영어로 표시한다', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('en');
    jest.mocked(listHomePromises).mockResolvedValue(response({
      pinned: [card({ id: ACTIVE_ID, title: 'Hero', endDate: '2026-08-17' })],
      items: [card({ id: SECOND_ID, title: 'Walk together', endDate: '2026-08-30' })],
    }));
    const view = await render(
      <LocaleProvider>
        <HomeScreen now={NOW} />
      </LocaleProvider>,
    );
    await settle();

    expect(view.getByText('End date 2026-08-17 (Mon)')).toBeTruthy();
    expect(view.getByText('End date 2026-08-30 (Sun)')).toBeTruthy();
    expect(view.queryByText(/\([월화수목금토일]\)/u)).toBeNull();
  });

  test('히스토리·지킴율·앱바 프로필·플로팅 CTA는 각각 올바른 경로를 연다', async () => {
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '지난 약속 히스토리 보기' }));
    await fireEvent.press(view.getByRole('button', { name: '지금까지 약속의 87%를 지켰어요' }));
    await fireEvent.press(view.getByRole('button', { name: '마이' }));
    await fireEvent.press(view.getByRole('button', { name: '약속 만들기' }));
    expect(push).toHaveBeenCalledWith('/history');
    expect(push).toHaveBeenNthCalledWith(2, '/profile');
    expect(push).toHaveBeenNthCalledWith(3, '/profile');
    expect(push).toHaveBeenCalledWith('/promise/edit');
    expect(replace).not.toHaveBeenCalled();
  });

  test('광고 플래그가 true일 때만 실제 슬롯을 렌더한다', async () => {
    jest.mocked(readAdsEnabled).mockResolvedValue(true);
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    expect(view.getAllByTestId('lf-ad-slot')).toHaveLength(1);
  });

  test('띠배너는 히어로 없는 목록의 인덱스 5에 한 번 들어가고, 광고가 꺼지면 목록에 없다', async () => {
    const sixCards = [1, 2, 3, 4, 5, 6].map((index) => card({
      id: `${String(index).repeat(8)}-${String(index).repeat(4)}-4${String(index).repeat(3)}-8${String(index).repeat(3)}-${String(index).repeat(12)}`,
      title: `대기 ${index}`,
      status: 'PENDING',
    }));
    jest.mocked(listHomePromises).mockImplementation(async (input: { tab: string }) =>
      input.tab === 'WAITING'
        ? { ...response({ items: sixCards }), counts: { ACTIVE: 0, WAITING: 6, COMPLETED: 0 } }
        : response());

    jest.mocked(readAdsEnabled).mockResolvedValue(true);
    const enabled = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(enabled.getByRole('tab', { name: /대기/u }));
    await settle();
    const data = enabled.getByTestId('home-list').props.data as Array<{ kind: string }>;
    expect(data).toHaveLength(7);
    expect(data[5]?.kind).toBe('BANNER');
    expect(data.filter((item) => item.kind === 'BANNER')).toHaveLength(1);
    expect(enabled.getAllByTestId('lf-banner-ad')).toHaveLength(1);
    await cleanup();

    jest.mocked(readAdsEnabled).mockResolvedValue(false);
    const disabled = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(disabled.getByRole('tab', { name: /대기/u }));
    await settle();
    const plain = disabled.getByTestId('home-list').props.data as Array<{ kind: string }>;
    expect(plain).toHaveLength(6);
    expect(plain.every((item) => item.kind === 'PROMISE')).toBe(true);
    expect(disabled.queryByTestId('lf-banner-ad')).toBeNull();
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
