import { View, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * 잉크&스티커 두들 (.sl-doodles / .sl-dd--*, ADR 0012) — 장식 전용.
 *
 * 색은 전부 토큰: 잉크 선=text, 버터=primary-container, 라벤더=reward-container,
 * 표면=surface. 배치는 CSS 원본의 .sl-dd--* 클래스를 `DOODLE_PLACEMENTS` 로 1:1
 * 미러링해서 화면 코드에 위치 리터럴이 남지 않게 한다.
 * `LfDoodleLayer` 는 터치를 막지 않고 접근성 트리에서도 빠지는 오버레이다.
 */

export type LfDoodleKind = 'sparkle' | 'star' | 'mail' | 'moon' | 'tea' | 'plant';

// CSS 원본 stroke 값 (viewBox 기준)
const INK_STROKE = 2.6;
const FILL_STROKE = 2.4;
const FACE_STROKE = 1.8;

interface DoodleSpec {
  viewBox: string;
  ratio: number; // height / width
  render: () => React.JSX.Element;
}

const ink = { fill: 'none', stroke: colors.text, strokeWidth: INK_STROKE } as const;
const face = { fill: 'none', stroke: colors.text, strokeWidth: FACE_STROKE } as const;
const filled = (fill: string) =>
  ({ fill, stroke: colors.text, strokeWidth: FILL_STROKE }) as const;

const SPECS: Record<LfDoodleKind, DoodleSpec> = {
  sparkle: {
    viewBox: '0 0 40 40',
    ratio: 1,
    render: () => (
      <Path
        {...ink}
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M20 4C21 14 26 19 36 20 26 21 21 26 20 36 19 26 14 21 4 20 14 19 19 14 20 4Z"
      />
    ),
  },
  star: {
    viewBox: '0 0 40 40',
    ratio: 1,
    render: () => (
      <>
        <Path
          {...filled(colors.primaryContainer)}
          strokeLinejoin="round"
          d="M20 3 24.5 14 36 14.5 27 22 30 34 20 27 10 34 13 22 4 14.5 15.5 14Z"
        />
        <Path {...face} strokeLinecap="round" d="M15 17q2-2.4 4 0M22 17q2-2.4 4 0M16 22q4.4 3.4 8.4 0" />
      </>
    ),
  },
  mail: {
    viewBox: '0 0 48 40',
    ratio: 40 / 48,
    render: () => (
      <>
        <Rect {...filled(colors.surface)} strokeLinejoin="round" x={3} y={8} width={42} height={28} rx={4} />
        <Path {...ink} strokeLinejoin="round" strokeLinecap="round" d="M4 10 24 24 44 10" />
        <Path
          {...filled(colors.primaryContainer)}
          strokeLinejoin="round"
          d="M24 27c-3-3.4-.4-6 1.6-4.4 2-1.6 4.6 1 1.4 4.4l-1.5 1.4z"
        />
      </>
    ),
  },
  moon: {
    viewBox: '0 0 40 40',
    ratio: 1,
    render: () => (
      <>
        <Path
          {...filled(colors.primaryContainer)}
          strokeLinejoin="round"
          d="M25 4a16 16 0 1 0 0 32A20 20 0 0 1 25 4Z"
        />
        <Path {...face} strokeLinecap="round" d="M17 16q1.8-2.2 3.6 0M15 25q3.4 2.6 6.4 0" />
      </>
    ),
  },
  tea: {
    viewBox: '0 0 44 44',
    ratio: 1,
    render: () => (
      <>
        <Path
          {...filled(colors.surface)}
          strokeLinejoin="round"
          d="M8 18h26v10a10 10 0 0 1-10 10h-6A10 10 0 0 1 8 28Z"
        />
        <Path
          {...ink}
          strokeLinejoin="round"
          strokeLinecap="round"
          d="M34 20c6 0 6 9 0 9M15 12q-2-3 0-6M22 13q-2-4 0-8"
        />
      </>
    ),
  },
  plant: {
    viewBox: '0 0 48 48',
    ratio: 1,
    render: () => (
      <>
        <Path {...filled(colors.surface)} strokeLinejoin="round" d="M14 30h20l-3 12H17Z" />
        <Path {...ink} strokeLinejoin="round" strokeLinecap="round" d="M12 30h24" />
        <Path
          {...filled(colors.rewardContainer)}
          strokeLinejoin="round"
          d="M18 26q-4-8 4-10-2-6 5-7 7-1 6 6 7 2 2 11"
        />
      </>
    ),
  },
};

/** CSS `.sl-dd--*` 배치의 1:1 미러 — 화면은 이름으로만 참조한다. */
export const DOODLE_PLACEMENTS = {
  'sparkle-tl': { kind: 'sparkle', width: 34, style: { left: 26, top: 74 } },
  'star-tr': { kind: 'star', width: 58, style: { right: 30, top: 56 }, rotate: '9deg' },
  'mail-l': { kind: 'mail', width: 52, style: { left: 20, top: 210 }, rotate: '-8deg' },
  'moon-r': { kind: 'moon', width: 46, style: { right: 24, top: 228 }, rotate: '10deg' },
  'tea-bl': { kind: 'tea', width: 44, style: { left: 34, bottom: 200 }, rotate: '-6deg' },
  'plant-br': { kind: 'plant', width: 48, style: { right: 38, bottom: 194 }, rotate: '7deg' },
  'sparkle-home-tr': { kind: 'sparkle', width: 20, style: { right: 12, top: 150 } },
  'sparkle-home-bl': { kind: 'sparkle', width: 16, style: { left: 8, bottom: 170 }, rotate: '14deg' },
} as const satisfies Record<
  string,
  { kind: LfDoodleKind; width: number; style: ViewStyle; rotate?: string }
>;

export type LfDoodlePlacement = keyof typeof DOODLE_PLACEMENTS;

export function LfDoodle({ placement }: { placement: LfDoodlePlacement }): React.JSX.Element {
  const spec = DOODLE_PLACEMENTS[placement];
  const { viewBox, ratio, render } = SPECS[spec.kind];
  const rotate = 'rotate' in spec ? spec.rotate : undefined;
  return (
    <View
      style={[
        { position: 'absolute' },
        spec.style,
        rotate !== undefined && { transform: [{ rotate }] },
      ]}
    >
      <Svg width={spec.width} height={spec.width * ratio} viewBox={viewBox}>
        {render()}
      </Svg>
    </View>
  );
}

/** `.sl-doodles` 컨테이너 — 터치를 막지 않고 접근성 트리에서도 빠진다. */
export function LfDoodleLayer({ children, ...rest }: ViewProps): React.JSX.Element {
  return (
    <View
      {...rest}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {children}
    </View>
  );
}
