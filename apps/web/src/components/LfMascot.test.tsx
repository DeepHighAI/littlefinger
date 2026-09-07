// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { LfMascotFace, LfOval, LfPinkyLoop } from './LfMascot.tsx';

describe('web E-1 brand components', () => {
  test('uses the approved mascot asset and accessible name', () => {
    render(<LfMascotFace size="lg" accessibilityLabel="리틀핑거 마스코트" />);
    const image = screen.getByRole('img', { name: '리틀핑거 마스코트' });
    expect(image.className).toContain('lf-mascot--lg');
    expect(image.getAttribute('src')).toContain('mascot-face-e1.png');
  });

  test('keeps decorative loop images out of the accessibility tree', () => {
    const { container } = render(<LfPinkyLoop size="eyes" />);
    expect(container.querySelector('.lf-pinky-loop')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('img[alt=""]')).toHaveLength(2);
  });

  test('renders the web oval with the solid loop inside', () => {
    const { container } = render(<LfOval variant="web"><LfPinkyLoop size="eyes" /></LfOval>);
    expect(container.querySelector('.lf-oval--web')).not.toBeNull();
    expect(container.querySelector('.lf-oval__inner')).not.toBeNull();
    expect(container.querySelectorAll('img[src*="hand-solid.png"]')).toHaveLength(2);
  });
});
