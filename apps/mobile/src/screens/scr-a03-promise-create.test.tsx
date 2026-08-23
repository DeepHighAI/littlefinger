import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, BackHandler } from 'react-native';

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
    expect(view.getByRole('button', { name: '임시저장' }).props.accessibilityState).toMatchObject({ disabled: true });
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
    expect(view.getByRole('button', { name: '작성자' })).toBeTruthy();
    expect(view.getByLabelText('보상')).toBeTruthy();
    expect(view.queryByLabelText('제목')).toBeNull();
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
