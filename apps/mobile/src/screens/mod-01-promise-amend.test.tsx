import type { PromiseAmendCreateRequest, PromiseDetailResponse } from '@littlefinger/shared';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PromiseAmendSheet } from '../components/promise-amend-sheet.tsx';
import { size } from '../theme/tokens.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';

interface SheetProps {
  visible: boolean;
  detail: PromiseDetailResponse;
  now: Date;
  durationUnlimited: boolean;
  onClose(): void;
  onSubmit(input: PromiseAmendCreateRequest): Promise<void>;
  pickEndDate(value: string, onSelect: (value: string) => void): void;
  confirmCancel(): Promise<boolean>;
}

const VERSION = {
  version_no: 1,
  title: '매주 화·목 아침 러닝 같이 하기',
  body: '매주 화요일과 목요일에 함께 달린다.',
  category: 'HABIT',
  end_date: '2026-09-01',
  keeper: 'BOTH',
  reward: '오마카세 사주기',
  penalty: '한 달 커피 사기',
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-AAAA-AA',
  activated_at: '2026-08-01T00:00:00Z',
  superseded_at: null,
  change_reason: null,
} as const;

function detail(): PromiseDetailResponse {
  return {
    promise_id: PROMISE_ID,
    status: 'ACTIVE',
    title: VERSION.title,
    body: VERSION.body,
    category: VERSION.category,
    end_date: VERSION.end_date,
    keeper: VERSION.keeper,
    reward: VERSION.reward,
    penalty: VERSION.penalty,
    witness_enabled: false,
    activated_at: VERSION.activated_at,
    closed_at: null,
    checking_started_at: null,
    check_deadline_at: null,
    check_round_no: 0,
    my_role: 'CREATOR',
    counterpart_push_available: true,
    creator: {
      user_id: CREATOR_ID,
      nickname: '지우',
      profile_image_url: null,
      role: 'CREATOR',
      status: 'JOINED',
      joined_at: VERSION.activated_at,
    },
    partner: {
      user_id: PARTNER_ID,
      nickname: '민준',
      profile_image_url: null,
      role: 'PARTNER',
      status: 'JOINED',
      joined_at: VERSION.activated_at,
    },
    witnesses: [],
    approvals: [],
    current_version: VERSION,
    invitation: null,
    amend_request: null,
    fulfillment: null,
  };
}

function props(overrides: Partial<SheetProps> = {}): SheetProps {
  return {
    visible: true,
    detail: detail(),
    now: new Date('2026-08-17T00:00:00Z'),
    durationUnlimited: false,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
    pickEndDate: jest.fn(),
    confirmCancel: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function hiddenScrimProps(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = hiddenScrimProps(child);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof node !== 'object' || node === null) return null;
  const value = node as { props?: Record<string, unknown>; children?: unknown };
  if (value.props?.['accessibilityElementsHidden'] === true) return value.props;
  return hiddenScrimProps(value.children);
}

describe('MOD-01 변경·파기 요청', () => {
  test('"종료일 없음" 선택지는 무기한이 열린 약속에서만 보인다', async () => {
    const closed = await render(<PromiseAmendSheet {...props()} />);
    expect(closed.queryByRole('button', { name: '종료일 없음' })).toBeNull();
    await closed.unmount();

    const open = await render(<PromiseAmendSheet {...props({ durationUnlimited: true })} />);
    expect(open.getByRole('button', { name: '종료일 없음' })).toBeTruthy();
  });

  test('dismiss scrim is absent from the Android accessibility tree', async () => {
    const view = await render(<PromiseAmendSheet {...props()} />);
    expect(hiddenScrimProps(view.toJSON())?.['importantForAccessibility']).toBe(
      'no-hide-descendants',
    );
  });

  test('ACTIVE 전문의 일곱 필드를 프리필하고 공통 합의 안내만 표시한다', async () => {
    const view = await render(<PromiseAmendSheet {...props()} />);

    for (const value of [
      VERSION.title,
      VERSION.body,
      VERSION.reward,
      VERSION.penalty,
    ]) expect(view.getByDisplayValue(value)).toBeTruthy();
    expect(view.getByText(VERSION.end_date)).toBeTruthy();
    expect(view.getByRole('button', { name: '습관' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByRole('button', { name: '둘 다' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByText('상대가 승인하면 적용돼요. 승인 전까지는 지금 약속이 그대로 유지돼요.')).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('변경·파기 탭은 현재 선택을 스크린리더 상태로 구분한다', async () => {
    const view = await render(<PromiseAmendSheet {...props()} />);
    const amend = view.getByRole('button', { name: '내용 변경' });
    const cancel = view.getByRole('button', { name: '파기 요청' });
    expect(amend.props.accessibilityState).toMatchObject({ selected: true });
    expect(cancel.props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(cancel);
    expect(view.getByRole('button', { name: '내용 변경' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(view.getByRole('button', { name: '파기 요청' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  test('변경된 필드가 없거나 이유가 200자를 넘으면 요청 CTA를 비활성화한다', async () => {
    const view = await render(<PromiseAmendSheet {...props()} />);
    const submit = view.getByRole('button', { name: '요청 보내기' });

    expect(submit.props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByText('변경된 내용이 없어요.')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('약속 내용'), '매주 세 번 함께 달린다.');
    expect(view.getByRole('button', { name: '요청 보내기' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.changeText(view.getByLabelText('변경 이유'), '가'.repeat(201));
    expect(view.getByRole('button', { name: '요청 보내기' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('종료일 선택은 KST 오늘 이후 규칙을 적용하고 유효한 변경만 제출한다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const pickEndDate = jest.fn((_value: string, select: (value: string) => void) => select('2026-08-17'));
    const view = await render(<PromiseAmendSheet {...props({ onSubmit, pickEndDate })} />);

    await fireEvent.press(view.getByRole('button', { name: '종료일 선택' }));
    expect(view.getByText('종료일은 내일 이후의 날짜로 정해주세요.')).toBeTruthy();
    expect(view.getByRole('button', { name: '요청 보내기' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  test('AMEND 제출은 정규 UI 값과 선택 이유만 전달한다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const view = await render(<PromiseAmendSheet {...props({ onSubmit })} />);

    await fireEvent.changeText(view.getByLabelText('제목'), '아침 러닝 세 번');
    await fireEvent.changeText(view.getByLabelText('변경 이유'), '일정 조정');
    await fireEvent.press(view.getByRole('button', { name: '요청 보내기' }));
    expect(onSubmit).toHaveBeenCalledWith({
      promise_id: PROMISE_ID,
      type: 'AMEND',
      proposed: {
        title: '아침 러닝 세 번',
        body: VERSION.body,
        category: VERSION.category,
        end_date: VERSION.end_date,
        keeper: VERSION.keeper,
        reward: VERSION.reward,
        penalty: VERSION.penalty,
      },
      reason: '일정 조정',
    });
  });

  test('파기 요청은 별도 안내와 두 단계 확인을 통과해야만 제출한다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const confirmCancel = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const view = await render(<PromiseAmendSheet {...props({ onSubmit, confirmCancel })} />);

    await fireEvent.press(view.getByRole('button', { name: '파기 요청' }));
    expect(view.getByText('두 사람 모두 동의하면 약속이 파기돼요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '요청 보내기' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: '요청 보내기' }));
    expect(confirmCancel).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledWith({ promise_id: PROMISE_ID, type: 'CANCEL' });
    const submit = view.getByRole('button', { name: '요청 보내기' });
    expect(StyleSheet.flatten(submit.props.style).minHeight).toBeGreaterThanOrEqual(size.touchMin);
  });
});
