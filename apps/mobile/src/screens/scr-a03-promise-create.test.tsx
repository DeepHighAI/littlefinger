import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, BackHandler, ScrollView } from 'react-native';

import PromiseEditorScreen from '../app/promise/edit';
import { MobileApiError } from '../lib/mobile-api.ts';
import {
  clearEditorLocalDraft,
  loadAmendSuggestComment,
  loadEditorDraft,
  openEndDatePicker,
  saveEditorLocalDraft,
  submitEditorDraft,
} from '../lib/promise-editor-native.ts';
import { EMPTY_PROMISE_DRAFT } from '../lib/promise-draft.ts';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }));
jest.mock('../lib/promise-editor-native.ts', () => ({
  clearEditorLocalDraft: jest.fn(),
  loadAmendSuggestComment: jest.fn(),
  loadEditorDraft: jest.fn(),
  openEndDatePicker: jest.fn(),
  saveEditorLocalDraft: jest.fn(),
  submitEditorDraft: jest.fn(),
}));
jest.mock('../components/slot-paywall-sheet.tsx', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SlotPaywallSheet: ({
      visible,
      reason,
      onPurchased,
    }: {
      visible: boolean;
      reason: string;
      onPurchased?: (status: { capacity: number; used: number }) => void;
    }) =>
      visible
        ? React.createElement(
            Text,
            { onPress: () => onPurchased?.({ capacity: 6, used: 5 }) },
            `슬롯 결제 시트 ${reason}`,
          )
        : null,
  };
});

const push = jest.fn();
const back = jest.fn();
const TEST_NOW = new Date('2026-08-01T00:00:00+09:00');
const completeDraft = {
  ...EMPTY_PROMISE_DRAFT,
  title: '주 3회 달리기',
  body: '매주 세 번 함께 달린다.',
  category: 'HABIT' as const,
  end_date: '2026-08-10',
};

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function fillStepOne(
  view: Awaited<ReturnType<typeof render>>,
  body = '매주 세 번 함께 달린다.',
): Promise<void> {
  await fireEvent.changeText(view.getByLabelText('제목'), '주 3회 달리기');
  await fireEvent.changeText(view.getByLabelText('약속 내용'), body);
  await fireEvent.press(view.getByRole('button', { name: '습관' }));
  await fireEvent.press(view.getByRole('button', { name: '조건 정하기' }));
}

async function fillStepTwo(view: Awaited<ReturnType<typeof render>>): Promise<void> {
  await fireEvent.press(view.getByRole('button', { name: '종료일 선택' }));
}

async function goToReview(view: Awaited<ReturnType<typeof render>>): Promise<void> {
  await fillStepOne(view);
  await fillStepTwo(view);
  await fireEvent.press(view.getByRole('button', { name: '내용 확인하기' }));
}

describe('SCR-A03 3단계 약속 작성', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(TEST_NOW);
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    jest.mocked(loadEditorDraft).mockReset().mockResolvedValue(EMPTY_PROMISE_DRAFT);
    jest.mocked(loadAmendSuggestComment).mockReset().mockResolvedValue(null);
    jest.mocked(saveEditorLocalDraft).mockReset().mockResolvedValue(undefined);
    jest.mocked(clearEditorLocalDraft).mockReset().mockResolvedValue(undefined);
    jest.mocked(submitEditorDraft).mockReset();
    jest.mocked(openEndDatePicker).mockReset().mockImplementation((_value, onSelect) => {
      onSelect('2026-08-10');
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await Promise.resolve();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('첫 단계에는 내용 필드만 보이고 진행률·임시저장·다음 행동을 제공한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();
    expect(view.getAllByText('내용').length).toBeGreaterThan(0);
    expect(view.getByLabelText('제목')).toBeTruthy();
    expect(view.getByLabelText('약속 내용')).toBeTruthy();
    expect(view.getByRole('button', { name: '습관' })).toBeTruthy();
    expect(view.queryByRole('button', { name: '종료일 선택' })).toBeNull();
    expect(view.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 1, text: '내용' });
    // CTA 는 비워도 활성이다(PO 2026-08-26) — 누르면 비활성 대신 미입력 안내가 답한다.
    expect(view.getByRole('button', { name: '임시저장' }).props.accessibilityState).toMatchObject({ disabled: false });
    expect(view.getByRole('button', { name: '조건 정하기' })).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('현재 단계의 오류만 드러내고 유효할 때 조건 단계로 이동한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '조건 정하기' }));
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(1);
    expect(view.getAllByRole('alert').length).toBeGreaterThan(0);

    await fillStepOne(view);
    expect(view.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 2, text: '조건' });
    expect(view.getByRole('button', { name: '종료일 선택' })).toBeTruthy();
    expect(view.queryByRole('button', { name: '종료일 없이 계속' })).toBeNull();
    expect(view.getByRole('button', { name: '작성자' })).toBeTruthy();
    expect(view.getByLabelText('보상')).toBeTruthy();
    expect(view.queryByLabelText('제목')).toBeNull();
  });

  test('보상·벌칙 직접 입력을 포커스하면 키보드 위로 해당 입력란을 스크롤한다', async () => {
    const reveal = jest
      .spyOn(ScrollView.prototype, 'scrollResponderScrollNativeHandleToKeyboard')
      .mockImplementation(() => undefined);
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fillStepOne(view);

    await fireEvent(view.getByLabelText('벌칙'), 'focus', {
      nativeEvent: { target: 73 },
    });

    expect(reveal).toHaveBeenCalledWith(73, expect.any(Number), true);
  });

  test('조건 프리셋과 종료일을 유지하고 확인 단계에서 수정·증인·확정 안내를 보여준다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fillStepOne(view);
    await fireEvent.press(view.getByRole('button', { name: '커피 한 잔 사주기' }));
    await fireEvent.press(view.getByRole('button', { name: '설거지 1주일' }));
    await fillStepTwo(view);
    expect(view.getByText('2026-08-10')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '내용 확인하기' }));

    expect(view.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 3, text: '확인' });
    expect(view.getByText('상대가 승인하면 이 내용으로 확정돼요.')).toBeTruthy();
    expect(view.getByRole('button', { name: '약속 내용 수정' })).toBeTruthy();
    expect(view.getByRole('button', { name: '약속 조건 수정' })).toBeTruthy();
    expect(view.getByText('커피 한 잔 사주기')).toBeTruthy();
    expect(view.getByText('설거지 1주일')).toBeTruthy();
    expect(view.getByRole('switch', { name: '증인 초대하기' })).toBeTruthy();
    expect(view.getByRole('button', { name: '상대에게 보내기' }).props.accessibilityState).toMatchObject({ disabled: false });
  });

  test('화면과 하드웨어 뒤로가기는 3→2→1 순서를 지킨다', async () => {
    let hardwareBack: (() => boolean) | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      hardwareBack = () => handler({} as never) ?? false;
      return { remove: jest.fn() } as never;
    });
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fillStepOne(view);
    await fillStepTwo(view);
    await fireEvent.press(view.getByRole('button', { name: '내용 확인하기' }));
    await fireEvent.press(view.getByRole('button', { name: '이전 단계' }));
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(2);
    await act(async () => { expect(hardwareBack?.()).toBe(true); });
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(1);
  });

  test('서버 DRAFT 임시저장은 기존 제출 계약과 로컬 정리를 유지한다', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: 'promise-1' });
    jest.mocked(loadEditorDraft).mockResolvedValue(completeDraft);
    jest.mocked(submitEditorDraft).mockResolvedValue({ promise_id: 'promise-1', status: 'DRAFT' });
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '임시저장' }));
    await settle();
    expect(submitEditorDraft).toHaveBeenCalledWith(completeDraft, 'promise-1', false);
    expect(clearEditorLocalDraft).toHaveBeenCalledWith('promise-1');
    expect(push).toHaveBeenCalledWith('/home');
  });

  test('수정 제안 의견은 단계 전환과 무관하게 상단 배너에 남는다', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: 'promise-1' });
    jest.mocked(loadEditorDraft).mockResolvedValue(completeDraft);
    jest.mocked(loadAmendSuggestComment).mockResolvedValue('종료일을 한 주만 늦춰 주세요');
    const view = await render(<PromiseEditorScreen />);
    await settle();
    expect(view.getByTestId('amend-comment-banner')).toBeTruthy();
    expect(view.getByText('종료일을 한 주만 늦춰 주세요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '조건 정하기' }));
    expect(view.getByTestId('amend-comment-banner')).toBeTruthy();
  });

  test('개인정보 확인 뒤 PENDING 초대 경로에는 원문 token을 넘기지 않는다', async () => {
    jest.mocked(submitEditorDraft).mockResolvedValue({
      promise_id: 'promise-1',
      status: 'PENDING',
      invitation_id: 'invite-1',
      expires_at: '2026-08-02T01:00:00.000Z',
      resend_count: 0,
      title: '주 3회 달리기',
      token: 'raw-token',
    });
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fillStepOne(view, '연락은 010-1234-5678로 해줘');
    await fillStepTwo(view);
    await fireEvent.press(view.getByRole('button', { name: '내용 확인하기' }));
    await fireEvent.press(view.getByRole('switch', { name: '증인 초대하기' }));
    await fireEvent.press(view.getByRole('button', { name: '상대에게 보내기' }));
    expect(submitEditorDraft).not.toHaveBeenCalled();
    await act(async () => {
      await alert.mock.calls[0]?.[2]?.find((button) => button.text === '그대로 기록')?.onPress?.();
    });
    expect(push).toHaveBeenCalledWith({
      pathname: '/invite',
      params: { promise_id: 'promise-1', witness_enabled: 'true' },
    });
    expect(JSON.stringify(push.mock.calls)).not.toContain('raw-token');
  });

  test('빈 필수 필드로 다음을 누르면 붉은 안내가 뜨고 단계에 머무른다 (PO 2026-08-26)', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '조건 정하기' }));

    expect(view.getByText('제목 — 제목을 2자 이상 입력해 주세요.')).toBeTruthy();
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(1);
  });

  test('임시저장은 미입력 필드가 있는 단계로 데려가 안내한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();
    // 1단계는 채우고 종료일만 비운 상태에서 저장을 누른다.
    await fireEvent.changeText(view.getByLabelText('제목'), '주 3회 달리기');
    await fireEvent.changeText(view.getByLabelText('약속 내용'), '매주 세 번 함께 달린다.');

    await fireEvent.press(view.getByRole('button', { name: '임시저장' }));
    await settle();

    // 2단계(조건)로 이동해 종료일 안내를 보여준다 — 조용한 차단 금지.
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(2);
    expect(view.getByText('종료일 — 종료일은 내일 이후의 날짜로 정해주세요.')).toBeTruthy();
    expect(submitEditorDraft).not.toHaveBeenCalled();
  });

  test('서버 필드 오류는 해당 필드가 있는 단계로 되돌아간다', async () => {
    jest.mocked(submitEditorDraft).mockRejectedValue(
      new MobileApiError(null, '종료일을 다시 확인해 주세요.', 'end_date'),
    );
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await goToReview(view);
    await fireEvent.press(view.getByRole('button', { name: '상대에게 보내기' }));
    await settle();
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(2);
    expect(view.getByRole('alert', { name: '종료일을 다시 확인해 주세요.' })).toBeTruthy();
  });

  test('슬롯 한도는 오류 줄 대신 결제 시트를 연다 (PO 2026-08-24)', async () => {
    jest.mocked(submitEditorDraft).mockRejectedValue(
      new MobileApiError('E_SLOT_LIMIT', '약속 슬롯이 가득 찼어요. 슬롯을 추가하면 새 약속을 보낼 수 있어요.'),
    );
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await goToReview(view);
    await fireEvent.press(view.getByRole('button', { name: '상대에게 보내기' }));
    await settle();

    expect(view.getByText('슬롯 결제 시트 limit')).toBeTruthy();
    expect(view.queryByText(/슬롯이 가득 찼어요\./u)).toBeNull();
    // 검토 단계에 머무른다 — 필드 오류가 아니므로 단계를 되돌리지 않는다.
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(3);
  });

  test('결제 완료는 시트를 닫고 발송을 즉시 재개한다 (PO 2026-08-26)', async () => {
    // 시트가 열린 채 남으면 결제가 안 된 것으로 오해한다 — 재개가 성공의 표시다.
    jest.mocked(submitEditorDraft)
      .mockRejectedValueOnce(
        new MobileApiError('E_SLOT_LIMIT', '약속 슬롯이 가득 찼어요. 슬롯을 추가하면 새 약속을 보낼 수 있어요.'),
      )
      .mockResolvedValue({
        promise_id: 'promise-1',
        status: 'PENDING',
        invitation_id: 'invite-1',
        expires_at: '2026-08-02T01:00:00.000Z',
        resend_count: 0,
        title: '주 3회 달리기',
        token: 'raw-token',
      });
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await goToReview(view);
    await fireEvent.press(view.getByRole('button', { name: '상대에게 보내기' }));
    await settle();
    expect(view.getByText('슬롯 결제 시트 limit')).toBeTruthy();

    await act(async () => fireEvent.press(view.getByText('슬롯 결제 시트 limit')));
    await settle();

    expect(view.queryByText('슬롯 결제 시트 limit')).toBeNull();
    expect(submitEditorDraft).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith({
      pathname: '/invite',
      params: { promise_id: 'promise-1', witness_enabled: 'false' },
    });
  });

  test('입력은 3초 뒤 저장하고 이탈 시 남은 변경을 즉시 flush한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();
    await fireEvent.changeText(view.getByLabelText('제목'), '첫 제목');
    await act(async () => { await jest.advanceTimersByTimeAsync(2_999); });
    expect(saveEditorLocalDraft).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(saveEditorLocalDraft).toHaveBeenCalledWith(null, expect.objectContaining({ title: '첫 제목' }));
    await fireEvent.changeText(view.getByLabelText('제목'), '이탈 직전 제목');
    await view.unmount();
    await settle();
    expect(saveEditorLocalDraft).toHaveBeenLastCalledWith(null, expect.objectContaining({ title: '이탈 직전 제목' }));
  });
});
