import eyesUrl from '../assets/images/eyes-e1.png';
import handColorUrl from '../assets/images/hand-color.png';
import handSolidUrl from '../assets/images/hand-solid.png';
import mascotFaceUrl from '../assets/images/mascot-face-e1.png';

type ImageSize = 'sm' | 'md' | 'lg';

function imageAccessibility(accessibilityLabel: string | undefined): {
  alt: string;
  'aria-hidden'?: true;
} {
  return accessibilityLabel === undefined
    ? { alt: '', 'aria-hidden': true }
    : { alt: accessibilityLabel };
}

/** 승인된 E-1 원본만 렌더해 웹 화면별 자산 분기를 막는다. */
export function LfMascotFace({
  size = 'md',
  accessibilityLabel,
}: {
  size?: ImageSize;
  accessibilityLabel?: string;
}): React.JSX.Element {
  return (
    <img
      className={`lf-mascot lf-mascot--${size}`}
      src={mascotFaceUrl}
      {...imageAccessibility(accessibilityLabel)}
    />
  );
}

export function LfEyes({
  size = 'blob',
  accessibilityLabel,
}: {
  size?: 'row' | 'header' | 'card' | 'blob' | 'web';
  accessibilityLabel?: string;
}): React.JSX.Element {
  return (
    <img
      className={`lf-eyes lf-eyes--${size}`}
      src={eyesUrl}
      {...imageAccessibility(accessibilityLabel)}
    />
  );
}

export function LfPinkyLoop({
  size = 'md',
  color = false,
  spark = false,
  accessibilityLabel,
}: {
  size?: 'sm' | 'md' | 'lg' | 'eyes';
  color?: boolean;
  spark?: boolean;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const imageUrl = color ? handColorUrl : handSolidUrl;
  return (
    <span
      className={`lf-pinky-loop lf-pinky-loop--${size}`}
      role={accessibilityLabel === undefined ? undefined : 'img'}
      aria-label={accessibilityLabel}
      aria-hidden={accessibilityLabel === undefined ? true : undefined}
    >
      <span className="lf-pinky-loop__hand lf-pinky-loop__hand--left">
        <img className="lf-pinky-loop__img" src={imageUrl} alt="" />
      </span>
      <span className="lf-pinky-loop__hand lf-pinky-loop__hand--right">
        <img className="lf-pinky-loop__img" src={imageUrl} alt="" />
      </span>
      {spark ? <span className="lf-pinky-loop__spark" /> : null}
    </span>
  );
}

/**
 * 타원 아트 — 잉크 & 블록의 마스코트 자리 (`.lf-oval`). web 190×152 는 안쪽 종이 타원을 갖고,
 * hint 60×56 은 종이 바탕 2px 로 카드 안에 들어간다. 장식이라 접근성 트리에서 뺀다.
 */
export function LfOval({
  variant,
  muted = false,
  children,
}: {
  variant: 'web' | 'hint';
  muted?: boolean;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={`lf-oval lf-oval--${variant}${muted ? ' lf-oval--muted' : ''}`} aria-hidden="true">
      {variant === 'web' ? <span className="lf-oval__inner" /> : null}
      {children}
    </div>
  );
}
