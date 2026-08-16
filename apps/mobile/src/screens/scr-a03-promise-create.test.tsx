import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import PromiseEditorScreen from '../app/promise/edit';
import {
  clearEditorLocalDraft,
  loadEditorDraft,
  openEndDatePicker,
  saveEditorLocalDraft,
  submitEditorDraft,
} from '../lib/promise-editor-native.ts';
import { EMPTY_PROMISE_DRAFT } from '../lib/promise-draft.ts';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock(
  '../lib/promise-editor-native.ts',
  () => ({
    clearEditorLocalDraft: jest.fn(),
    loadEditorDraft: jest.fn(),
    openEndDatePicker: jest.fn(),
    saveEditorLocalDraft: jest.fn(),
    submitEditorDraft: jest.fn(),
  }),
  { virtual: true },
);

const push = jest.fn();
const back = jest.fn();
const loadEditorDraftMock = jest.mocked(loadEditorDraft);
const saveEditorLocalDraftMock = jest.mocked(saveEditorLocalDraft);
const clearEditorLocalDraftMock = jest.mocked(clearEditorLocalDraft);
const submitEditorDraftMock = jest.mocked(submitEditorDraft);
const openEndDatePickerMock = jest.mocked(openEndDatePicker);

const completeDraft = {
  ...EMPTY_PROMISE_DRAFT,
  title: '주 3회 달리기',
  body: '매주 세 번 함께 달린다.',
  category: 'HABIT' as const,
  end_date: '2026-08-10',
};

const TEST_NOW = new Date('2026-08-01T00:00:00+09:00');

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function fillRequiredFields(
  view: Awaited<ReturnType<typeof render>>,
  category = '습관',
): Promise<void> {
  await fireEvent.changeText(view.getByLabelText('제목'), '주 3회 달리기');
  await fireEvent.changeText(view.getByLabelText('약속 내용'), '매주 세 번 함께 달린다.');
  await fireEvent.press(view.getByRole('button', { name: category }));
  await fireEvent.press(view.getByRole('button', { name: '종료일 선택' }));
}

describe('SCR-A03 약속 작성', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 종료일 검증이 실제 실행일에 따라 달라지지 않도록 KST 기준 시각을 고정한다.
    jest.setSystemTime(TEST_NOW);
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    loadEditorDraftMock.mockReset();
    loadEditorDraftMock.mockResolvedValue(EMPTY_PROMISE_DRAFT);
    saveEditorLocalDraftMock.mockReset();
    saveEditorLocalDraftMock.mockResolvedValue(undefined);
    clearEditorLocalDraftMock.mockReset();
    clearEditorLocalDraftMock.mockResolvedValue(undefined);
    submitEditorDraftMock.mockReset();
    openEndDatePickerMock.mockReset();
    openEndDatePickerMock.mockImplementation((_value, onSelect) =>
      onSelect('2026-08-10'),
    );
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanup();
    await Promise.resolve();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('8개 필드와 명세 우선 라벨을 한 화면에 두고 초기 전송 CTA를 비활성화한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();

    expect(view.getByText('약속 만들기')).toBeTruthy();
    expect(view.getByLabelText('제목')).toBeTruthy();
    expect(view.getByLabelText('약속 내용')).toBeTruthy();
    expect(view.getByRole('button', { name: '습관' })).toBeTruthy();
    expect(view.getByRole('button', { name: '종료일 선택' })).toBeTruthy();
    expect(view.getByRole('button', { name: '작성자' })).toBeTruthy();
    expect(view.getByRole('button', { name: '상대방' })).toBeTruthy();
    expect(view.getByRole('button', { name: '둘 다' })).toBeTruthy();
    expect(view.getByLabelText('보상')).toBeTruthy();
    expect(view.getByLabelText('벌칙')).toBeTruthy();
    expect(view.getByRole('switch', { name: '증인 초대하기' })).toBeTruthy();
    expect(view.queryByText('나')).toBeNull();
    expect(view.queryByText('상대')).toBeNull();
    expect(
      view.getByRole('button', { name: '상대에게 보내기' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('명세 프리셋은 입력값을 채우며 금전·증인 선택 안내를 노출한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '커피 한 잔 사주기' }));
    expect(view.getByLabelText('보상').props.value).toBe('커피 한 잔 사주기');
    await fireEvent.press(view.getByRole('button', { name: '설거지 1주일' }));
    expect(view.getByLabelText('벌칙').props.value).toBe('설거지 1주일');

    await fireEvent.press(view.getByRole('button', { name: '금전' }));
    expect(
      view.getByText(
        '금전 약속도 기록할 수 있지만, 리틀핑거는 차용증·공증 서비스가 아니에요.',
      ),
    ).toBeTruthy();

    await fireEvent.press(view.getByRole('switch', { name: '증인 초대하기' }));
    expect(view.getByText('확정 후 증인을 초대할 수 있어요(최대 2명)')).toBeTruthy();
  });

  test('필수값이 유효하면 전송 CTA가 활성화되고 Android 날짜 선택 결과를 반영한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();

    await fillRequiredFields(view);

    expect(openEndDatePickerMock).toHaveBeenCalled();
    expect(view.getByText('2026-08-10')).toBeTruthy();
    expect(
      view.getByRole('button', { name: '상대에게 보내기' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  test('서버 DRAFT를 불러와 재편집하고 임시저장 성공 시 로컬 초안을 지운 뒤 홈으로 간다', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: 'promise-1' });
    loadEditorDraftMock.mockResolvedValue(completeDraft);
    submitEditorDraftMock.mockResolvedValue({
      promise_id: 'promise-1',
      status: 'DRAFT',
    });
    const view = await render(<PromiseEditorScreen />);
    await settle();

    expect(loadEditorDraftMock).toHaveBeenCalledWith('promise-1');
    expect(view.getByLabelText('제목').props.value).toBe('주 3회 달리기');
    await fireEvent.press(view.getByRole('button', { name: '임시저장' }));
    await settle();

    expect(submitEditorDraftMock).toHaveBeenCalledWith(
      completeDraft,
      'promise-1',
      false,
    );
    expect(clearEditorLocalDraftMock).toHaveBeenCalledWith('promise-1');
    expect(push).toHaveBeenCalledWith('/home');
  });

  test('전송은 개인정보 포함 시 한 번 확인하고 PENDING의 promise_id만 라우트에 전달한다', async () => {
    submitEditorDraftMock.mockResolvedValue({
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
    await fillRequiredFields(view);
    await fireEvent.press(view.getByRole('switch', { name: '증인 초대하기' }));
    await fireEvent.changeText(
      view.getByLabelText('약속 내용'),
      '연락은 010-1234-5678로 해줘',
    );

    await fireEvent.press(view.getByRole('button', { name: '상대에게 보내기' }));
    expect(alert).toHaveBeenCalledWith(
      '개인정보가 포함돼 있어요',
      '그대로 기록할까요?',
      expect.any(Array),
    );
    expect(submitEditorDraftMock).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      await buttons?.find((button) => button.text === '그대로 기록')?.onPress?.();
    });

    expect(submitEditorDraftMock).toHaveBeenCalledTimes(1);
    expect(clearEditorLocalDraftMock).toHaveBeenCalledWith(null);
    expect(push).toHaveBeenCalledWith({
      pathname: '/invite',
      params: { promise_id: 'promise-1', witness_enabled: 'true' },
    });
    expect(JSON.stringify(push.mock.calls)).not.toContain('raw-token');
  });

  test('입력은 3초 뒤 로컬 저장하고 이탈 시 남은 변경을 즉시 flush한다', async () => {
    const view = await render(<PromiseEditorScreen />);
    await settle();

    await fireEvent.changeText(view.getByLabelText('제목'), '첫 제목');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_999);
    });
    expect(saveEditorLocalDraftMock).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(saveEditorLocalDraftMock).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ title: '첫 제목' }),
    );

    await fireEvent.changeText(view.getByLabelText('제목'), '이탈 직전 제목');
    await view.unmount();
    await settle();
    expect(saveEditorLocalDraftMock).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ title: '이탈 직전 제목' }),
    );
  });
});
