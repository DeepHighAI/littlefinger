// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LfPinky } from './LfPinky.tsx';

afterEach(cleanup);

describe('LfPinky', () => {
  it('밝은 면에서는 타입 A 잉크 자산을 쓴다', () => {
    render(<LfPinky accessibilityLabel="새끼손가락 약속" />);

    const mark = screen.getByRole('img', { name: '새끼손가락 약속' });
    expect(mark.getAttribute('src')).toContain('brand-symbol.png');
  });

  it('잉크 면에서는 동일 알파의 버터 자산을 쓴다', () => {
    render(<LfPinky tone="onPrimary" accessibilityLabel="새끼손가락 약속" />);

    const mark = screen.getByRole('img', { name: '새끼손가락 약속' });
    expect(mark.getAttribute('src')).toContain('brand-symbol-on-action.png');
    expect(mark.className).toContain('lf-pinky--on-primary');
  });

  it('라벨이 없는 장식용 마크는 접근성 트리에서 숨긴다', () => {
    const { container } = render(<LfPinky />);

    expect(container.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
  });
});
