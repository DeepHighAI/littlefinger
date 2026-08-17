import type { CompletionCelebrationView } from '@littlefinger/shared';
import { fireEvent, render } from '@testing-library/react-native';

import { CompletionCelebrationSheet } from '../components/completion-celebration-sheet.tsx';

const BASE: CompletionCelebrationView = {
  claim_id: '11111111-1111-4111-8111-111111111111',
  promise_id: '22222222-2222-4222-8222-222222222222',
  title: '매주 화·목 아침 러닝 같이 하기',
  counterpart_nickname: '민준',
  keep_rate_before: 87,
  keep_rate_after: 89,
};

async function renderSheet(
  celebration: CompletionCelebrationView = BASE,
  overrides: Partial<React.ComponentProps<typeof CompletionCelebrationSheet>> = {},
) {
  const props = {
    visible: true,
    celebration,
    onShown: jest.fn(),
    onClose: jest.fn(),
    onNewPromise: jest.fn(),
    onShare: jest.fn(),
    ...overrides,
  };
  return { view: await render(<CompletionCelebrationSheet {...props} />), props };
}

describe('MOD-03 완료 축하', () => {
  test.each([
    [87, 89, '약속 지킴율 87% → 89%'],
    [75, 75, '약속 지킴율 75% 유지'],
    [null, 100, '지킴율 집계가 시작됐어요 · 100%'],
    [null, null, '약속 지킴율 집계 중'],
  ] as const)('지킴율 %s → %s 상태를 정확히 표시한다', async (before, after, label) => {
    const { view } = await renderSheet({
      ...BASE,
      keep_rate_before: before,
      keep_rate_after: after,
    });

    expect(view.getByText('약속 지킴! 축하해요')).toBeTruthy();
    expect(view.getByText(`${BASE.title} — 완주!`)).toBeTruthy();
    expect(view.getByText('민준님과 하이파이브 하세요')).toBeTruthy();
    expect(view.getByText(label)).toBeTruthy();
    expect(view.getByTestId('completion-celebration-pinky')).toBeTruthy();
  });

  test('닉네임이 없으면 상대방 문구를 사용한다', async () => {
    const { view } = await renderSheet({ ...BASE, counterpart_nickname: null });
    expect(view.getByText('상대방과 하이파이브 하세요')).toBeTruthy();
  });

  test('네이티브 표시와 모든 닫기 경로를 접근 가능한 경계에 연결한다', async () => {
    const { view, props } = await renderSheet();
    const modal = view.getByTestId('completion-celebration-modal');
    expect(view.getByTestId('completion-celebration-sheet').props.accessibilityViewIsModal).toBe(true);
    expect(
      view.getByTestId('completion-celebration-scrim', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no-hide-descendants');

    await fireEvent(modal, 'show');
    await fireEvent(modal, 'requestClose');
    await fireEvent.press(
      view.getByTestId('completion-celebration-scrim', { includeHiddenElements: true }),
    );
    await fireEvent.press(view.getByRole('button', { name: '축하 닫기' }));

    expect(props.onShown).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  test('두 액션은 48dp 이상이고 공유는 시트를 닫지 않는다', async () => {
    const { view, props } = await renderSheet();
    const newPromise = view.getByRole('button', { name: '새 약속 만들기' });
    const share = view.getByRole('button', { name: '공유하기' });

    expect(newPromise).toHaveStyle({ minHeight: 48 });
    expect(share).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(share);
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(view.getByText('약속 지킴! 축하해요')).toBeTruthy();
  });

  test('광고·증빙·공유 카드 자리표시자를 렌더하지 않는다', async () => {
    const { view } = await renderSheet();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(view.queryByText(/증빙|공유 카드/u)).toBeNull();
  });
});
