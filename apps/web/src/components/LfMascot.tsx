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

/** PO 원본을 공유해 웹 화면마다 다른 얼굴이 표시되지 않게 한다 (ADR 0028). */
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
 * 큰 아트는 얼굴이 포함된 원본으로 교체하고 작은 hint 의 컨테이너는 유지한다.
 * 장식이라 접근성 트리에서 뺀다.
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
      {variant === 'web'
        ? <img className="lf-character" src={mascotFaceUrl} alt="" />
        : children}
    </div>
  );
}
