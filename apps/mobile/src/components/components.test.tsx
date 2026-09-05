import { render, userEvent } from '@testing-library/react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { colors, letterSpacing, line, size, space, type, weight } from '../theme/tokens';
import { LfAppBar } from './LfAppBar';
import { LfAvatar } from './LfAvatar';
import { LfAvatarButton } from './LfAvatarButton';
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
import { LfRow } from './LfRow';
import { LfStack } from './LfStack';
import { LfStatusDot } from './LfStatusDot';
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
    ['headline', type.headline, weight.heavy],
    ['title', type.title, weight.heavy],
    ['sheetTitle', type.sheetTitle, weight.heavy],
    ['cardTitle', type.cardTitle, weight.heavy],
    ['heading', type.heading, weight.bold],
    ['subtitle', type.subtitle, weight.heavy],
    ['bodyStrong', type.body, weight.bold],
    ['body', type.body, weight.regular],
    ['caption', type.label, weight.regular],
    ['meta', type.meta, weight.regular],
    ['eyebrow', type.eyebrow, weight.bold],
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
      fontWeight: weight.regular,
    });
  });

  test('caption 은 14/22 보조문으로 읽힌다', async () => {
    const view = await render(<LfText testID="t" variant="caption" />);
    expect(styleOf(view, 't') as TextStyle).toMatchObject({
      color: colors.textSecondary,
      fontSize: type.label,
      lineHeight: line.body,
      fontWeight: weight.regular,
    });
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
    // 04 §12-7 절대제약: 터치 타깃 최소 48dp. 어떤 변형에서도 줄지 않는다.
    const view = await render(<LfButton testID="b" variant={variant} label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).minHeight).toBeGreaterThanOrEqual(size.touchMin);
  });

  test('compact 크기에서도 48dp 아래로 내려가지 않는다', async () => {
    // 원본 CSS 의 .lf-btn--compact 는 height 44px 지만 .lf-btn 의 min-height 48px 가 이긴다.
    const view = await render(<LfButton testID="b" size="compact" label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).minHeight).toBeGreaterThanOrEqual(size.touchMin);
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

  test('filled 는 소프트 액션 색을 쓴다', async () => {
    const view = await render(<LfButton testID="b" variant="filled" label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).backgroundColor).toBe(colors.actionFill);
  });

  test('filled 를 누르는 동안 소프트 액션 pressed 색을 쓴다', async () => {
    const button = LfButton({ variant: 'filled', label: '확인' });
    expect(pressedStyleOf(button).backgroundColor).toBe(colors.actionFillPressed);
  });

  test('kakao 는 카카오 공식 버튼 색을 쓴다', async () => {
    const view = await render(<LfButton testID="b" variant="kakao" label="카카오로 시작하기" />);
    expect((styleOf(view, 'b') as ViewStyle).backgroundColor).toBe(colors.kakao);
  });

  test('google 은 구글 공식 버튼 색과 1px 테두리를 쓴다', async () => {
    const view = await render(<LfButton testID="b" variant="google" label="Google로 시작하기" />);
    const style = styleOf(view, 'b') as ViewStyle;
    expect(style.backgroundColor).toBe(colors.google);
    expect(style.borderColor).toBe(colors.googleBorder);
    expect(style.borderWidth).toBe(1);
  });

  test('모서리는 알약 모양이다', async () => {
    const view = await render(<LfButton testID="b" label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).borderRadius).toBe(9999);
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

  test('trailing 아이콘은 40dp 옐로 원 안에 놓이고 테두리를 끌 수 있다', async () => {
    const view = await render(
      <LfButton testID="b" label="보내기" trailing="send" trailingBorder={false} />,
    );
    expect(styleOf(view, 'b-trailing')).toMatchObject({
      width: size.iconCircle,
      height: size.iconCircle,
      backgroundColor: colors.brandSymbolOnAction,
    });
    expect(styleOf(view, 'b-trailing').borderWidth).toBeUndefined();
  });
});

describe('LfFab', () => {
  test('누르는 동안 소프트 액션 pressed 색을 쓴다', async () => {
    const button = LfFab({ label: '약속 만들기' });
    expect(pressedStyleOf(button).backgroundColor).toBe(colors.actionFillPressed);
  });

  test('트레일링 옐로 원 안에 E-1 얼굴을 표시한다', async () => {
    const view = await render(<LfFab testID="fab" label="약속 만들기" />);
    expect(styleOf(view, 'fab-trailing')).toMatchObject({
      width: size.iconCircle,
      height: size.iconCircle,
      backgroundColor: colors.brandSymbolOnAction,
    });
    const mascot = view.getByTestId('fab-mascot', { includeHiddenElements: true });
    expect(mascot.type).toBe('Image');
    expect(flatten(mascot.props.style)).toMatchObject({
      width: size.mascotMd,
      height: size.mascotMd,
    });
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
      borderWidth: 2.2,
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

  test('list 모양과 hero 기울기를 함께 적용한다', async () => {
    const view = await render(<LfCard testID="c" shape="list" tilt="hero" />);
    expect(styleOf(view, 'c')).toMatchObject({
      borderRadius: 20,
      transform: [{ rotate: '-1.2deg' }],
    });
  });
});

describe('LfChip / LfStatusDot', () => {
  test('선택 필터도 글자는 잉크이고 배경만 옐로로 바뀐다', async () => {
    const view = await render(
      <LfChip testID="chip" label="전체" tone="paper" kind="filter" selected />,
    );
    expect(styleOf(view, 'chip')).toMatchObject({
      height: size.tabHeight,
      backgroundColor: colors.primaryContainer,
      borderColor: colors.text,
    });
    expect(flatten(view.getByText('전체').props.style).color).toBe(colors.text);
  });

  test('상태 점은 10dp 파스텔 면에 2dp 잉크 링을 쓴다', async () => {
    const view = await render(<LfStatusDot testID="dot" tone="pink" />);
    const dot = flatten(view.getByTestId('dot', { includeHiddenElements: true }).props.style);
    expect(dot).toMatchObject({
      width: size.statusDot,
      height: size.statusDot,
      backgroundColor: colors.attentionContainer,
      borderColor: colors.text,
      borderWidth: 2,
    });
  });
});

describe('Soft Promise 공통 컴포넌트', () => {
  test('히어로는 r22 기울임 카드와 칩 타이포 D-Day를 쓴다', async () => {
    const view = await render(
      <LfHero testID="hero" eyebrow="가장 가까운 약속" title="함께 걷기" dday="D-3" />,
    );
    const hero = styleOf(view, 'hero') as ViewStyle;
    expect(hero.borderRadius).toBe(22);
    expect(hero.borderWidth).toBe(2.2);
    expect(hero.borderColor).toBe(colors.text);
    expect(hero.transform).toEqual([{ rotate: '-1.2deg' }]);
    expect(flatten(view.getByText('D-3').props.style).fontSize).toBe(type.chip);
  });

  test('앱바는 뒤로 원과 아바타 액션을 각각 버튼으로 제공한다', async () => {
    const onBack = jest.fn();
    const onProfile = jest.fn();
    const view = await render(
      <LfAppBar
        title="마이"
        leading="back"
        leadingAccessibilityLabel="뒤로"
        onLeadingPress={onBack}
        actions={(
          <LfAvatarButton
            nickname="지우"
            accessibilityLabel="마이"
            onPress={onProfile}
          />
        )}
      />,
    );
    const back = view.getByRole('button', { name: '뒤로' });
    const profile = view.getByRole('button', { name: '마이' });
    expect(flatten(back.props.style)).toMatchObject({
      width: size.iconButton,
      height: size.iconButton,
      backgroundColor: colors.surface,
    });
    expect(flatten(profile.props.style)).toMatchObject({
      width: size.iconButton,
      height: size.iconButton,
      backgroundColor: colors.text,
    });
    await userEvent.press(back);
    await userEvent.press(profile);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledTimes(1);
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
    expect(fallback.getByText('지', { includeHiddenElements: true })).toBeTruthy();
    expect(fallback.getByRole('image', { name: '지우 프로필 사진' })).toBeTruthy();
    expect(styleOf(fallback, 'avatar').width).toBe(size.iconButton);

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

describe('LfBlob', () => {
  test('승인된 블롭은 토큰 치수를 쓰고 장식으로 숨긴다', async () => {
    const view = await render(
      <LfBlob testID="blob" variant="empty" tilt="empty">
        <LfEyes size="blob" />
      </LfBlob>,
    );
    const blob = view.getByTestId('blob', { includeHiddenElements: true });
    const style = flatten(blob.props.style) as ViewStyle;

    expect(style.width).toBe(size.loginBlobHeight);
    expect(style.height).toBe(size.loginBlobHeight - size.appbarIcon - space[4]);
    expect(blob.props.accessibilityElementsHidden).toBe(true);
  });
});
