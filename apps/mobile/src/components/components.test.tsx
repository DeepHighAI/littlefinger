import { render, userEvent } from '@testing-library/react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { statusTileOf } from '../screens/status-tone';
import { textFontFamily } from '../theme/fonts';
import {
  border,
  colors,
  elevation,
  gutter,
  letterSpacing,
  line,
  radius,
  size,
  space,
  type,
  weight,
} from '../theme/tokens';
import { LfAppBar } from './LfAppBar';
import { LfAvatar } from './LfAvatar';
import { LfButton } from './LfButton';
import { LfBlob } from './LfBlob';
import { LfCard } from './LfCard';
import { LfChip } from './LfChip';
import { LfChoice } from './LfChoice';
import { LfDisclaimer } from './LfDisclaimer';
import { LfEyes, LfMascotFace } from './LfMascot';
import { LfFab } from './LfFab';
import { LfHelper } from './LfHelper';
import { LfHero } from './LfHero';
import { LfField } from './LfField';
import { LfIcon } from './LfIcon';
import { LfIconButton } from './LfIconButton';
import { LfInput } from './LfInput';
import { LfNotice } from './LfNotice';
import { LfPicker } from './LfPicker';
import { LfPinkyLoop, pinkyLoopDuration } from './LfPinkyLoop';
import { LfPromiseSeam, promiseSeamDuration } from './LfPromiseSeam';
import { LfOval } from './LfOval';
import { LfRow } from './LfRow';
import { LfSegmented } from './LfSegmented';
import { LfSheet } from './LfSheet';
import { LfStack } from './LfStack';
import { LfStatusTile } from './LfStatusTile';
import { LfSwitch } from './LfSwitch';
import { LfText } from './LfText';
import { LfTrustRing, trustRingDuration } from './LfTrustRing';
import { LfTrustStrip } from './LfTrustStrip';
import { LfWizardProgress } from './LfWizardProgress';

/**
 * 근거: 04 §5-2 (lf-* → RN 컴포넌트), §12 절대제약.
 *
 * 값이 원본과 같은지는 tokens.test.ts 가 이미 잡는다. 여기서 보는 건
 * **컴포넌트가 토큰을 거치는지**와 **절대제약을 어기지 않는지**다.
 *
 * RNTL 14 부터 render() 는 Promise 를 돌려준다. await 하지 않으면 조회 함수가 없는
 * 빈 객체를 받게 된다. 전역 screen 대신 반환값을 쓰는 편이 이 실수를 구조적으로 막는다.
 */

type Rendered = Awaited<ReturnType<typeof render>>;

/** RN 스타일은 배열로 오기도 한다. 하나로 눌러서 본다. */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

function styleOf(view: Rendered, testID: string): Record<string, unknown> {
  return flatten(view.getByTestId(testID).props.style);
}

function pressedStyleOf(element: React.JSX.Element): Record<string, unknown> {
  const style = (element.props as {
    style: (state: { pressed: boolean }) => unknown;
  }).style({ pressed: true });
  return flatten(style);
}

describe('LfText', () => {
  test('본문은 body 토큰 크기와 줄높이를 쓴다', async () => {
    const view = await render(<LfText testID="t">약속</LfText>);
    const s = styleOf(view, 't') as TextStyle;
    expect(s.fontSize).toBe(type.body);
    expect(s.lineHeight).toBe(line.body);
    expect(s.color).toBe(colors.text);
  });

  test.each([
    ['wordmark', type.wordmark, weight.heavy],
    ['display', type.display, weight.heavy],
    ['headline', type.headline, weight.bold],
    ['title', type.title, weight.bold],
    ['sheetTitle', type.sheetTitle, weight.bold],
    ['cardTitle', type.cardTitle, weight.heavy],
    ['heading', type.heading, weight.bold],
    ['subtitle', type.subtitle, weight.heavy],
    ['appbar', type.appbar, weight.bold],
    ['appbarBrand', type.cardTitle, weight.heavy],
    ['bodyStrong', type.body, weight.bold],
    ['body', type.body, weight.medium],
    ['caption', type.chip, weight.medium],
    ['meta', type.meta, weight.medium],
    ['eyebrow', type.eyebrow, weight.bold],
    ['chip', type.meta, weight.bold],
  ] as const)('%s 는 원본 CSS 와 같은 크기·굵기를 쓴다', async (variant, expectedSize, expectedWeight) => {
    const view = await render(<LfText testID="t" variant={variant} />);
    const s = styleOf(view, 't') as TextStyle;
    expect(s.fontSize).toBe(expectedSize);
    expect(s.fontWeight).toBe(expectedWeight);
  });

  test('secondary 는 본문 굵기를 바꾸지 않고 보조색만 쓴다', async () => {
    const view = await render(<LfText testID="t" secondary />);
    expect(styleOf(view, 't') as TextStyle).toMatchObject({
      color: colors.textSecondary,
      fontWeight: weight.medium,
    });
  });

  test('caption 은 13/19 보조문으로 읽힌다 (README 캡션)', async () => {
    const view = await render(<LfText testID="t" variant="caption" />);
    expect(styleOf(view, 't') as TextStyle).toMatchObject({
      color: colors.textSecondary,
      fontSize: type.chip,
      lineHeight: 19,
      fontWeight: weight.medium,
    });
  });

  test('4색 면 안에서는 보조 글자도 잉크다 — 종이 면에서는 보조색 그대로', async () => {
    const view = await render(
      <>
        <LfCard tone="yellow"><LfText testID="on-face" secondary /></LfCard>
        <LfCard tone="paper"><LfText testID="on-paper" secondary /></LfCard>
      </>,
    );
    expect((styleOf(view, 'on-face') as TextStyle).color).toBe(colors.text);
    expect((styleOf(view, 'on-paper') as TextStyle).color).toBe(colors.textSecondary);
  });

  test('eyebrow 자간은 토큰의 em 값을 RN dp로 환산한다', async () => {
    const view = await render(<LfText testID="t" variant="eyebrow" />);
    expect((styleOf(view, 't') as TextStyle).letterSpacing).toBe(
      type.eyebrow * letterSpacing.wide,
    );
  });

  test('색을 직접 넘길 수 없다 — 토큰 밖 값이 새는 걸 막는다', async () => {
    const props = { testID: 't', color: '#FF0000' } as unknown as { testID: string };
    const view = await render(<LfText {...props} />);
    expect((styleOf(view, 't') as TextStyle).color).not.toBe('#FF0000');
  });

  test('디스클레이머 변형은 큰 볼드 보조문으로 읽힌다', async () => {
    const view = await render(<LfText testID="t" variant="disclaimer" />);
    expect(styleOf(view, 't') as TextStyle).toMatchObject({
      color: colors.textSecondary,
      fontSize: type.caption,
      lineHeight: line.caption,
      fontWeight: weight.bold,
    });
  });
});

describe('LfDisclaimer', () => {
  test('변경할 수 없는 공통 법적 안내 문구만 렌더한다', async () => {
    const view = await render(<LfDisclaimer testID="disclaimer" />);

    expect(
      view.getByText(
        '리틀핑거의 약속 기록은 공증이나 전자계약 서비스가 아니며, 법적 효력을 보증하지 않습니다. 다만 양측의 승인 이력과 시각 정보는 분쟁 시 참고 자료로 활용될 수 있습니다.',
      ),
    ).toBeTruthy();
    expect(view.getByTestId('disclaimer').props.children).toBeTruthy();
  });
});

describe('LfNotice', () => {
  test('정보 안내는 잉크 밑줄 스타일을 쓴다 (ADR 0012)', async () => {
    const view = await render(<LfNotice label="초대가 곧 만료돼요" />);

    expect(flatten(view.getByText('초대가 곧 만료돼요').props.style).color).toBe(
      colors.textSecondary,
    );
  });
});

describe('LfStack / LfRow', () => {
  test('LfStack 은 세로로 쌓는다', async () => {
    const view = await render(<LfStack testID="s" />);
    expect((styleOf(view, 's') as ViewStyle).flexDirection).toBe('column');
  });

  test('LfRow 는 가로로 놓고 세로 가운데 정렬한다', async () => {
    const view = await render(<LfRow testID="r" />);
    const s = styleOf(view, 'r') as ViewStyle;
    expect(s.flexDirection).toBe('row');
    expect(s.alignItems).toBe('center');
  });

  test('gap 은 간격 토큰 눈금에서 온다', async () => {
    const view = await render(<LfStack testID="s" gap={5} />);
    expect((styleOf(view, 's') as ViewStyle).gap).toBe(space[5]);
  });

  test('gap 을 주지 않으면 간격이 없다', async () => {
    const view = await render(<LfStack testID="s" />);
    expect((styleOf(view, 's') as ViewStyle).gap).toBeUndefined();
  });

  test('grow 는 남는 공간을 채운다', async () => {
    const view = await render(<LfRow testID="r" grow />);
    expect((styleOf(view, 'r') as ViewStyle).flex).toBe(1);
  });

  test('center 는 양축을 가운데로 맞춘다', async () => {
    const view = await render(<LfStack testID="s" center />);
    const s = styleOf(view, 's') as ViewStyle;
    expect(s.alignItems).toBe('center');
    expect(s.justifyContent).toBe('center');
  });
});

describe('LfButton — 접근성 하한이 최우선이다', () => {
  const variants = ['filled', 'tonal', 'outlined', 'text', 'kakao', 'google', 'danger'] as const;

  test('장식 아이콘은 버튼 이름에 섞이지 않고 명시한 접근성 이름은 유지한다', async () => {
    const view = await render(<>
      <LfButton label="구매" trailing="inventory_2" />
      <LfButton label="공유" trailing="share" accessibilityLabel="초대 링크 공유" />
    </>);
    expect(view.getByRole('button', { name: '구매' })).toBeTruthy();
    expect(view.getByRole('button', { name: '초대 링크 공유' })).toBeTruthy();
  });

  test.each(variants)('%s 변형도 터치 타깃 48dp 를 지킨다', async (variant) => {
    // 04 §12-7 절대제약: 터치 타깃 최소 48dp. 36h tonal 은 갤러리의 ::after 처럼 hitSlop 으로 채운다.
    const view = await render(<LfButton testID="b" variant={variant} label="확인" />);
    const button = view.getByTestId('b');
    const minHeight = (styleOf(view, 'b') as ViewStyle).minHeight as number;
    expect(minHeight + (button.props.hitSlop as number) * 2).toBeGreaterThanOrEqual(size.touchMin);
  });

  test('compact 는 README 44h 를 지키고 hitSlop 으로 48dp 를 채운다', async () => {
    const view = await render(<LfButton testID="b" size="compact" label="확인" />);
    const button = view.getByTestId('b');
    expect((styleOf(view, 'b') as ViewStyle).minHeight).toBe(44);
    expect(44 + (button.props.hitSlop as number) * 2).toBe(size.touchMin);
  });

  test('cta 크기는 더 크다', async () => {
    const view = await render(<LfButton testID="b" size="cta" label="확인" />);
    const style = styleOf(view, 'b') as ViewStyle;
    expect(style.minHeight).toBe(size.ctaHeight);
    expect(style.height).toBeUndefined();
  });

  test('아이콘 포함 CTA는 큰 글꼴에서도 라벨 폭을 확보한다', async () => {
    const view = await render(
      <LfButton testID="b" size="cta" label="Start with Google" leading={<LfText>G</LfText>} />,
    );
    expect((styleOf(view, 'b') as ViewStyle).paddingHorizontal).toBe(space[7]);
  });

  test('라벨 Text 는 flexShrink 도 fontWeight 도 직접 갖지 않는다', async () => {
    // 이 둘이 라벨에 붙으면 큰 글꼴 기기에서 'Google로 시작하기' 가 'Google로' 로 끊긴다.
    // flexShrink 는 안드로이드가 줄바꿈 대신 잘라내게 만들고(그래서 상자인 View 가 진다),
    // fontWeight 는 굵기별 정적 파일을 쓰는 04 §5-4 와 충돌해 측정과 렌더가 어긋난다.
    const view = await render(
      <LfButton testID="b" size="cta" label="Google로 시작하기" leading={<LfText>G</LfText>} />,
    );
    const label = view.getByText('Google로 시작하기');
    const style = Array.isArray(label.props.style)
      ? Object.assign({}, ...label.props.style.filter(Boolean))
      : label.props.style;

    expect(style.flexShrink).toBeUndefined();
    expect(style.fontWeight).toBeUndefined();
  });

  test('filled 는 옐로 면에 잉크 글자 · 2.5 잉크 테두리 · 5px 그림자다 (검정 채움 없음)', async () => {
    const view = await render(<LfButton testID="b" variant="filled" label="확인" />);
    expect(styleOf(view, 'b')).toMatchObject({
      backgroundColor: colors.primaryContainer,
      borderColor: colors.text,
      borderWidth: border.card,
      boxShadow: elevation.card.boxShadow,
    });
    expect(flatten(view.getByText('확인').props.style).color).toBe(colors.text);
  });

  test('누르는 동안 3dp 밀리고 그림자는 2px 만 남는다 (README 눌림)', async () => {
    const pressed = pressedStyleOf(LfButton({ variant: 'filled', label: '확인' }));
    expect(pressed.transform).toEqual([{ translateX: 3 }, { translateY: 3 }]);
    expect(pressed.boxShadow).toEqual([{ offsetX: 2, offsetY: 2, blurRadius: 0, spreadDistance: 0, color: colors.text }]);
    expect(pressedStyleOf(LfButton({ variant: 'outlined', label: '확인' })).boxShadow).toEqual([]);
  });

  test('비활성이면 그림자도 없다', async () => {
    const view = await render(<LfButton testID="b" label="확인" disabled />);
    expect((styleOf(view, 'b') as ViewStyle).boxShadow).toEqual([]);
  });

  test('kakao 는 카카오 공식 버튼 색을 쓴다', async () => {
    const view = await render(<LfButton testID="b" variant="kakao" label="카카오로 시작하기" />);
    expect((styleOf(view, 'b') as ViewStyle).backgroundColor).toBe(colors.kakao);
  });

  test('google 은 구글 공식 배경·글자색을 지키고 테두리만 2.5 잉크 블록이다', async () => {
    const view = await render(<LfButton testID="b" variant="google" label="Google로 시작하기" />);
    const style = styleOf(view, 'b') as ViewStyle;
    expect(style.backgroundColor).toBe(colors.google);
    expect(style.borderColor).toBe(colors.text);
    expect(style.borderWidth).toBe(border.card);
    expect(flatten(view.getByText('Google로 시작하기').props.style).color).toBe(colors.onGoogle);
  });

  test('모서리는 r14 블록이다', async () => {
    const view = await render(<LfButton testID="b" label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).borderRadius).toBe(radius.md);
  });

  test('block 은 가로를 꽉 채운다', async () => {
    const view = await render(<LfButton testID="b" block label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).width).toBe('100%');
  });

  test('라벨을 화면에서 읽을 수 있다', async () => {
    const view = await render(<LfButton label="카카오로 시작하기" />);
    expect(view.getByText('카카오로 시작하기')).toBeTruthy();
  });

  test('버튼으로 인식된다', async () => {
    const view = await render(<LfButton label="확인" />);
    expect(view.getByRole('button', { name: '확인' })).toBeTruthy();
  });

  test('누르면 onPress 가 불린다', async () => {
    const onPress = jest.fn();
    const view = await render(<LfButton label="확인" onPress={onPress} />);
    await userEvent.press(view.getByRole('button', { name: '확인' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('비활성이면 눌러도 아무 일이 없다', async () => {
    const onPress = jest.fn();
    const view = await render(<LfButton label="확인" disabled onPress={onPress} />);
    await userEvent.press(view.getByRole('button', { name: '확인' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('비활성 상태가 흐리게 보인다', async () => {
    const view = await render(<LfButton testID="b" label="확인" disabled />);
    expect((styleOf(view, 'b') as ViewStyle).opacity).toBe(0.3);
  });

  test('호출자가 선택 상태를 더해도 공통 비활성 상태를 보존한다', async () => {
    const view = await render(
      <LfButton label="변경 요청" disabled accessibilityState={{ selected: true }} />,
    );
    expect(view.getByRole('button', { name: '변경 요청' }).props.accessibilityState).toEqual({
      disabled: true,
      selected: true,
    });
  });

  test('trailing 아이콘은 40dp 종이 사각 r10 안에 2dp 잉크 테두리로 놓인다', async () => {
    const view = await render(<LfButton testID="b" label="보내기" trailing="send" />);
    expect(styleOf(view, 'b-trailing')).toMatchObject({
      width: size.iconCircle,
      height: size.iconCircle,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: border.chip,
      borderColor: colors.text,
    });
  });
});

describe('LfFab', () => {
  test('옐로 풀폭 CTA — 좌우 16 · 잉크 글자 · 5px 그림자 · 눌림은 3dp 이동', async () => {
    const view = await render(<LfFab testID="fab" label="약속 만들기" />);
    expect(styleOf(view, 'fab')).toMatchObject({
      left: gutter.app,
      right: gutter.app,
      backgroundColor: colors.primaryContainer,
      borderRadius: radius.md,
      boxShadow: elevation.fab.boxShadow,
    });
    expect(flatten(view.getByText('약속 만들기').props.style).color).toBe(colors.text);
    expect(pressedStyleOf(LfFab({ label: '약속 만들기' })).transform).toEqual([{ translateX: 3 }, { translateY: 3 }]);
  });

  test('트레일링 종이 사각 안에 add 아이콘을 표시한다', async () => {
    const view = await render(<LfFab testID="fab" label="약속 만들기" />);
    expect(styleOf(view, 'fab-trailing')).toMatchObject({
      width: size.iconCircle,
      height: size.iconCircle,
      backgroundColor: colors.surface,
      borderWidth: border.chip,
    });
    expect(view.getByTestId('fab-icon', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('LfCard', () => {
  test.each([
    ['paper', colors.surface],
    ['yellow', colors.primaryContainer],
    ['mint', colors.successContainer],
    ['pink', colors.attentionContainer],
    ['sky', colors.recordContainer],
    ['muted', colors.surfaceMuted],
  ] as const)('%s 톤도 같은 잉크 테두리와 패딩을 쓴다', async (tone, backgroundColor) => {
    const view = await render(<LfCard testID="c" tone={tone} />);
    expect(styleOf(view, 'c')).toMatchObject({
      backgroundColor,
      borderColor: colors.text,
      borderWidth: border.card,
      padding: size.cardPadding,
    });
  });

  test('flat 은 배경도 테두리도 여백도 없다', async () => {
    const view = await render(<LfCard testID="c" flat />);
    const s = styleOf(view, 'c') as ViewStyle;
    expect(s.borderWidth).toBe(0);
    expect(s.backgroundColor).toBe('transparent');
    expect(s.padding).toBe(0);
  });

  test('shadow={false} 는 테두리를 두고 그림자만 뺀다 — 기울기는 없다', async () => {
    const view = await render(<LfCard testID="c" shape="list" shadow={false} />);
    const s = styleOf(view, 'c') as ViewStyle;
    expect(s).toMatchObject({ borderRadius: radius.lg, borderWidth: border.card, boxShadow: [] });
    expect(s.transform).toBeUndefined();
  });
});

describe('LfChip / LfStatusTile', () => {
  test('선택 필터 탭은 r10 옐로 + 3px, 글자는 잉크 800 — 미선택은 종이 600', async () => {
    const view = await render(
      <>
        <LfChip testID="on" label="전체" tone="paper" kind="filter" selected />
        <LfChip testID="off" label="진행 중" tone="paper" kind="filter" />
      </>,
    );
    expect(styleOf(view, 'on')).toMatchObject({
      height: size.tabHeight,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryContainer,
      borderColor: colors.text,
      boxShadow: elevation.sm.boxShadow,
    });
    expect(flatten(view.getByText('전체').props.style)).toMatchObject({
      color: colors.text,
      fontFamily: textFontFamily(weight.bold),
    });
    expect((styleOf(view, 'off') as ViewStyle).boxShadow).toBeUndefined();
    expect(flatten(view.getByText('진행 중').props.style).fontFamily).toBe(textFontFamily(weight.medium));
  });

  test('상태 칩은 28h r8 · 12/800', async () => {
    const view = await render(<LfChip testID="chip" label="진행 중" tone="mint" kind="status" />);
    expect(styleOf(view, 'chip')).toMatchObject({ height: size.chipStatusHeight, borderRadius: radius.xs });
    expect(flatten(view.getByText('진행 중').props.style).fontSize).toBe(type.meta);
  });

  test('상태 타일은 40 r10 톤 면 + 2dp 잉크, PENDING 만 점선이고 라벨과 함께 놓인다', async () => {
    const view = await render(
      <>
        <LfStatusTile testID="tile" icon="bolt" tone="mint" />
        <LfStatusTile testID="pending" icon="hourglass_empty" tone="paper" dashed />
      </>,
    );
    expect(flatten(view.getByTestId('tile', { includeHiddenElements: true }).props.style)).toMatchObject({
      width: size.statusTile,
      height: size.statusTile,
      borderRadius: radius.sm,
      backgroundColor: colors.successContainer,
      borderColor: colors.text,
      borderWidth: border.chip,
    });
    expect(flatten(view.getByTestId('pending', { includeHiddenElements: true }).props.style).borderStyle).toBe('dashed');
    expect(statusTileOf('ACTIVE', true)).toEqual({ icon: 'all_inclusive', tone: 'sky', dashed: false });
    expect(statusTileOf('DISPUTED')).toEqual({ icon: 'balance', tone: 'muted', dashed: false });
  });
});

describe('Soft Promise 공통 컴포넌트', () => {
  test('히어로는 옐로 r14 면에 기울기 없이 놓이고 D-Day 는 핑크 배지, 화살표는 종이 사각이다', async () => {
    const view = await render(
      <LfHero testID="hero" eyebrow="가장 가까운 약속" title="함께 걷기" dday="D-3" meta="지우 · 민준" />,
    );
    const hero = styleOf(view, 'hero') as ViewStyle;
    expect(hero).toMatchObject({
      borderRadius: radius.xl,
      borderWidth: border.card,
      borderColor: colors.text,
      backgroundColor: colors.primaryContainer,
      boxShadow: elevation.card.boxShadow,
    });
    expect(hero.transform).toBeUndefined();
    const dday = view.getByText('D-3');
    expect(flatten(dday.props.style)).toMatchObject({ fontSize: type.meta, color: colors.text });
    expect(flatten(dday.parent?.props.style)).toMatchObject({ backgroundColor: colors.attentionContainer });
    // 옐로 면 위 eyebrow·메타도 잉크
    expect(flatten(view.getByText('가장 가까운 약속').props.style).color).toBe(colors.text);
  });

  test('앱바는 종이 r14 블록이고 브랜드 앱바의 메뉴는 버튼으로 읽힌다', async () => {
    const onMenu = jest.fn();
    const view = await render(
      <LfAppBar
        testID="bar"
        brand
        title="리틀핑거"
        menu={{ label: '메뉴', onPress: onMenu, badge: true, accessibilityLabel: '메뉴 — 읽지 않은 알림 있음' }}
      />,
    );
    expect(styleOf(view, 'bar')).toMatchObject({
      height: size.appbarHeight,
      marginHorizontal: gutter.app,
      borderRadius: radius.md,
      borderWidth: border.card,
      backgroundColor: colors.surface,
      boxShadow: elevation.card.boxShadow,
    });
    expect(view.getByRole('header', { name: '리틀핑거' })).toBeTruthy();
    const menu = view.getByRole('button', { name: '메뉴 — 읽지 않은 알림 있음' });
    expect(size.iconCircle + (menu.props.hitSlop as number) * 2).toBe(size.touchMin);
    await userEvent.press(menu);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  test('하위 앱바는 뒤로 사각과 우측 액션을 각각 버튼으로 제공한다', async () => {
    const onBack = jest.fn();
    const onMore = jest.fn();
    const view = await render(
      <LfAppBar
        title="약속 상세"
        leading="back"
        leadingAccessibilityLabel="뒤로"
        onLeadingPress={onBack}
        actions={<LfIconButton icon="more_horiz" accessibilityLabel="더보기" onPress={onMore} />}
      />,
    );
    const back = view.getByRole('button', { name: '뒤로' });
    const more = view.getByRole('button', { name: '더보기' });
    expect(flatten(back.props.style)).toMatchObject({
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
    });
    await userEvent.press(back);
    await userEvent.press(more);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  test('아이콘 버튼은 44dp 원과 hitSlop으로 48dp 터치 영역을 만든다', async () => {
    const view = await render(
      <LfIconButton
        icon="notifications"
        accessibilityLabel="알림"
        onPress={() => undefined}
      />,
    );
    const button = view.getByRole('button', { name: '알림' });
    const style = flatten(button.props.style);
    expect(style).toMatchObject({ width: size.iconButton, height: size.iconButton });
    expect(size.iconButton + button.props.hitSlop * 2).toBe(size.touchMin);
  });

  test.each([0, 87, 100])('지킴율 %i를 progressbar로 읽는다', async (rate) => {
    const view = await render(<LfTrustRing rate={rate} />);
    expect(view.getByRole('progressbar', { name: '약속 지킴율' }).props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: rate,
    });
    expect(view.getByText(`${rate}%`)).toBeTruthy();
  });

  test.each([[-10, 0], [112, 100]] as const)('지킴율 %i를 %i로 clamp한다', async (rate, expected) => {
    const view = await render(<LfTrustRing rate={rate} />);
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(expected);
    expect(view.getByText(`${expected}%`)).toBeTruthy();
  });

  test('표본 부족 지킴율은 숫자를 꾸미지 않고 집계 중으로 표시한다', async () => {
    const view = await render(<LfTrustRing rate={null} />);
    expect(view.getByText('집계 중')).toBeTruthy();
    expect(view.getByRole('progressbar').props.accessibilityValue).toEqual({ text: '집계 중' });
  });

  test('reduced motion은 링과 Promise Seam의 공간 애니메이션을 0ms로 만든다', () => {
    expect(trustRingDuration(true)).toBe(0);
    expect(promiseSeamDuration(true)).toBe(0);
    expect(trustRingDuration(false)).toBe(400);
    expect(promiseSeamDuration(false)).toBe(400);
  });

  test('3단계 진행률과 헬퍼·지킴율 스트립·Promise Seam을 렌더한다', async () => {
    const view = await render(
      <>
        <LfWizardProgress step={2} labels={['내용', '조건', '확인']} />
        <LfHelper text="상대가 승인하면 이 내용으로 확정돼요." />
        <LfTrustStrip rate={87} onPress={() => undefined} />
        <LfPromiseSeam />
      </>,
    );
    expect(view.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 1,
      max: 3,
      now: 2,
      text: '조건',
    });
    expect(view.getByText('상대가 승인하면 이 내용으로 확정돼요.')).toBeTruthy();
    expect(view.getByRole('button', { name: '지금까지 약속의 87%를 지켰어요' })).toBeTruthy();
    expect(view.getByTestId('promise-seam', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('LfIcon', () => {
  test('아이콘에 접근성 라벨을 달 수 있다', async () => {
    const view = await render(<LfIcon name="check" accessibilityLabel="완료" />);
    expect(view.getByLabelText('완료')).toBeTruthy();
  });

  test('라벨이 없으면 스크린리더에서 감춘다 — 장식용 아이콘이 읽히면 안 된다', async () => {
    const view = await render(<LfIcon testID="i" name="check" />);
    // 일부러 감춘 요소라 기본 쿼리에는 안 잡힌다. 그게 바로 이 테스트가 확인하려는 것이다.
    expect(view.queryByTestId('i')).toBeNull();

    const hidden = view.getByTestId('i', { includeHiddenElements: true });
    expect(hidden.props.accessibilityElementsHidden).toBe(true);
    expect(hidden.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  test('색은 토큰에서 온다', async () => {
    const view = await render(<LfIcon testID="i" name="check" color="primary" />);
    const icon = view.getByTestId('i', { includeHiddenElements: true });
    expect(flatten(icon.props.style).color).toBe(colors.primary);
  });
});

describe('LfAvatar', () => {
  test('HTTPS 사진은 이미지로, 사진이 없으면 닉네임 첫 글자를 토큰 크기로 표시한다', async () => {
    const fallback = await render(
      <LfAvatar
        testID="avatar"
        nickname="지우"
        profileImageUrl={null}
        accessibilityLabel="지우 프로필 사진"
      />,
    );
    const glyph = fallback.getByText('지', { includeHiddenElements: true });
    expect(fallback.getByRole('image', { name: '지우 프로필 사진' })).toBeTruthy();
    // README 아바타 md 44 — 잉크 원 + 옐로 글자
    expect(styleOf(fallback, 'avatar')).toMatchObject({ width: 44, backgroundColor: colors.text });
    expect(flatten(glyph.props.style).color).toBe(colors.primaryContainer);

    const photo = await render(
      <LfAvatar
        testID="avatar-photo"
        nickname="지우"
        profileImageUrl="https://example.com/avatar.jpg"
        accessibilityLabel="지우 프로필 사진"
      />,
    );
    expect(photo.getByRole('image', { name: '지우 프로필 사진' })).toBeTruthy();
  });
});

describe('M4 접근성 의미와 터치 하한', () => {
  test('앱바 제목은 스크린리더 탐색용 헤더다', async () => {
    const view = await render(<LfAppBar title="알림" />);
    expect(view.getByRole('header', { name: '알림' })).toBeTruthy();
  });

  test('필드 검증 오류는 화면 변화 즉시 읽히는 경고다', async () => {
    const view = await render(
      <LfField label="제목" error="제목을 입력해 주세요.">
        <LfInput accessibilityLabel="제목" />
      </LfField>,
    );
    const alert = view.getByRole('alert', { name: '제목을 입력해 주세요.' });
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });

  test('선택기는 이름과 별도로 현재 값을 읽는다', async () => {
    const view = await render(
      <LfPicker
        accessibilityLabel="종료일 선택"
        value="2026. 9. 1."
        placeholder="선택"
        onPress={() => undefined}
      />,
    );
    expect(view.getByRole('button', { name: '종료일 선택' }).props.accessibilityValue).toEqual({
      text: '2026. 9. 1.',
    });
  });

  test('공통 상호작용 컴포넌트는 모두 48dp 터치 하한을 지킨다', async () => {
    const view = await render(
      <>
        <LfChoice label="습관" selected={false} onPress={() => undefined} />
        <LfPicker
          accessibilityLabel="종료일"
          placeholder="선택"
          onPress={() => undefined}
        />
        <LfSwitch
          accessibilityLabel="리마인드"
          value={false}
          onValueChange={() => undefined}
        />
        <LfIconButton
          icon="notifications"
          accessibilityLabel="알림"
          onPress={() => undefined}
        />
        <LfFab label="약속 만들기" />
      </>,
    );
    for (const target of [
      view.getByRole('button', { name: '습관' }),
      view.getByRole('button', { name: '종료일' }),
      view.getByRole('switch', { name: '리마인드' }),
      view.getByRole('button', { name: '약속 만들기' }),
    ]) {
      expect((flatten(target.props.style) as ViewStyle).minHeight).toBeGreaterThanOrEqual(
        size.touchMin,
      );
    }
    const iconButton = view.getByRole('button', { name: '알림' });
    expect(size.iconButton + iconButton.props.hitSlop * 2).toBe(size.touchMin);
  });
});

describe('E-1 마스코트와 C-1 손 루프', () => {
  test('얼굴과 눈은 승인된 PNG를 가공 없이 쓰고 장식이면 접근성 트리에서 숨긴다', async () => {
    const view = await render(
      <>
        <LfMascotFace testID="face" size="lg" />
        <LfEyes testID="eyes" size="blob" />
      </>,
    );

    for (const testID of ['face', 'eyes']) {
      const image = view.getByTestId(testID, { includeHiddenElements: true });
      expect(image.type).toBe('Image');
      expect(image.props.resizeMode).toBe('contain');
      expect(flatten(image.props.style).tintColor).toBeUndefined();
      expect(image.props.accessibilityElementsHidden).toBe(true);
      expect(image.props.importantForAccessibility).toBe('no-hide-descendants');
    }
  });

  test('손 루프는 왼손 컨테이너만 좌우 반전하고 의미가 있으면 이미지로 읽힌다', async () => {
    const view = await render(
      <LfPinkyLoop testID="loop" size="lg" accessibilityLabel="새끼손가락 걸기" />,
    );
    const left = styleOf(view, 'loop-left') as ViewStyle;

    expect(left.transform).toEqual([{ scaleX: -1 }]);
    expect(view.getByRole('image', { name: '새끼손가락 걸기' })).toBeTruthy();
  });

  test('모션 축소에서는 progress를 0에 두고 스파크를 렌더하지 않는다', async () => {
    const reducedMotion = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const view = await render(<LfPinkyLoop testID="loop" spark />);
    const hands = view.getAllByTestId('loop-hand', { includeHiddenElements: true });

    expect(pinkyLoopDuration(true)).toBe(0);
    expect(view.queryByTestId('loop-spark', { includeHiddenElements: true })).toBeNull();
    expect(flatten(hands[0]?.props.style).transform).toEqual([
      { translateX: 4 },
      { translateY: 0 },
      { rotate: '8deg' },
    ]);
    reducedMotion.mockRestore();
  });
});

describe('LfBlob / LfOval', () => {
  test('빈 상태 블롭은 README 240×211 이고 기울기 없이 장식으로 숨긴다', async () => {
    const view = await render(
      <LfBlob testID="blob" variant="empty" tilt="empty">
        <LfEyes size="blob" />
      </LfBlob>,
    );
    const blob = view.getByTestId('blob', { includeHiddenElements: true });
    const style = flatten(blob.props.style) as ViewStyle;

    expect(style.width).toBe(240);
    expect(style.height).toBe(211);
    expect(style.transform).toBeUndefined();
    expect(blob.props.accessibilityElementsHidden).toBe(true);
  });

  test('A00 블롭만 -2° 를 유지한다 (PO E11)', async () => {
    const view = await render(<LfBlob testID="blob" variant="login" />);
    expect((flatten(view.getByTestId('blob', { includeHiddenElements: true }).props.style) as ViewStyle).transform)
      .toEqual([{ rotate: '-2deg' }]);
  });

  test('타원 아트는 그림자 5 를 치수에 더하고 로그인 타원만 -2° 다', async () => {
    const view = await render(
      <>
        <LfOval testID="tile" variant="tile" />
        <LfOval testID="login" variant="login" />
      </>,
    );
    expect(flatten(view.getByTestId('tile', { includeHiddenElements: true }).props.style)).toMatchObject({ width: 36, height: 34 });
    const login = flatten(view.getByTestId('login', { includeHiddenElements: true }).props.style) as ViewStyle;
    expect(login).toMatchObject({ width: 225, height: 205, transform: [{ rotate: '-2deg' }] });
  });
});

describe('LfSheet / LfSegmented', () => {
  test('시트는 r20 상단 · 2.5 잉크 · 그림자 없음 · 핸들은 불투명 잉크', async () => {
    const view = await render(
      <LfSheet visible title="변경 요청" closeLabel="닫기" onClose={() => undefined} sheetTestID="sheet">
        <LfText>본문</LfText>
      </LfSheet>,
    );
    expect(styleOf(view, 'sheet')).toMatchObject({
      borderTopLeftRadius: radius.hero,
      borderWidth: border.sheet,
      borderBottomWidth: 0,
      boxShadow: [],
    });
    expect(view.getByRole('button', { name: '닫기' })).toBeTruthy();
  });

  test('세그먼트는 탭으로 읽히고 선택 항목만 옐로, 38h 항목은 hitSlop 으로 48 을 채운다', async () => {
    const onChange = jest.fn();
    const view = await render(
      <LfSegmented
        accessibilityLabel="요청 종류"
        items={[{ key: 'AMEND', label: '변경' }, { key: 'CANCEL', label: '파기' }]}
        value="AMEND"
        onChange={onChange}
      />,
    );
    const selected = view.getByRole('tab', { name: '변경' });
    const other = view.getByRole('tab', { name: '파기' });
    expect(flatten(selected.props.style).backgroundColor).toBe(colors.primaryContainer);
    expect(flatten(other.props.style).backgroundColor).toBeUndefined();
    expect(38 + (other.props.hitSlop as number) * 2).toBe(size.touchMin);
    await userEvent.press(other);
    expect(onChange).toHaveBeenCalledWith('CANCEL');
  });
});
