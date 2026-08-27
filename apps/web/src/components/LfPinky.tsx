import brandSymbolUrl from '../assets/images/brand-symbol.png';
import brandSymbolOnActionUrl from '../assets/images/brand-symbol-on-action.png';

export type LfPinkySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LfPinkyTone = 'default' | 'onContainer' | 'onPrimary';

export interface LfPinkyProps {
  size?: LfPinkySize;
  tone?: LfPinkyTone;
  hooked?: boolean;
  accessibilityLabel?: string;
}

/** 모든 웹 화면이 승인된 동일 PNG 실루엣을 사용하게 하는 단일 진입점이다. */
export function LfPinky({
  size = 'md',
  tone = 'default',
  hooked = false,
  accessibilityLabel,
}: LfPinkyProps): React.JSX.Element {
  const className = [
    'lf-pinky',
    `lf-pinky--${size}`,
    tone === 'onContainer' ? 'lf-pinky--on-container' : '',
    tone === 'onPrimary' ? 'lf-pinky--on-primary' : '',
    hooked ? 'lf-pinky--hooked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      className={className}
      src={tone === 'onPrimary' ? brandSymbolOnActionUrl : brandSymbolUrl}
      alt={accessibilityLabel ?? ''}
      {...(accessibilityLabel === undefined ? { 'aria-hidden': true } : {})}
    />
  );
}
