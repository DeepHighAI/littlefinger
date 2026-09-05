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
  size?: 'row' | 'header' | 'card' | 'blob';
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

export function LfBlob({
  variant,
  children,
}: {
  variant: 'login' | 'empty';
  children?: React.ReactNode;
}): React.JSX.Element {
  const empty = variant === 'empty';
  return (
    <div className={`lf-blob lf-blob--${variant} lf-blob--${empty ? 'tilt-empty' : 'tilt'}`} aria-hidden="true">
      <svg className="lf-blob__svg" viewBox={empty ? '0 0 200 170' : '0 0 220 200'}>
        <path
          className="lf-blob__paper"
          d={empty
            ? 'M100 8c62-8 96 34 92 80s-42 78-94 74S4 130 8 84 48 16 100 8Z'
            : 'M110 12c70-10 106 40 100 90s-50 92-104 88S6 150 10 100 50 20 110 12Z'}
        />
        {!empty && (
          <path
            className="lf-blob__yellow"
            d="M150 120c34-14 66 8 62 40s-30 44-62 38-40-26-34-48 14-24 34-30Z"
          />
        )}
      </svg>
      <span className="lf-blob__eyes">
        {children ?? <LfEyes />}
      </span>
    </div>
  );
}
