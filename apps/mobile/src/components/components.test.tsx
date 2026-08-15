import { render, userEvent } from '@testing-library/react-native';
import type { TextStyle, ViewStyle } from 'react-native';

import { colors, line, size, space, type, weight } from '../theme/tokens';
import { LfAvatar } from './LfAvatar';
import { LfButton } from './LfButton';
import { LfCard } from './LfCard';
import { LfDisclaimer } from './LfDisclaimer';
import { LfIcon } from './LfIcon';
import { LfRow } from './LfRow';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

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

describe('LfText', () => {
  test('본문은 body 토큰 크기와 줄높이를 쓴다', async () => {
    const view = await render(<LfText testID="t">약속</LfText>);
    const s = styleOf(view, 't') as TextStyle;
    expect(s.fontSize).toBe(type.body);
    expect(s.lineHeight).toBe(line.body);
    expect(s.color).toBe(colors.text);
  });

  test.each([
    ['title', type.title, weight.heavy],
    ['subtitle', type.subtitle, weight.heavy],
    ['sectionTitle', type.caption, weight.bold],
    ['body', type.body, weight.regular],
    ['caption', type.caption, weight.regular],
  ] as const)('%s 는 원본 CSS 와 같은 크기·굵기를 쓴다', async (variant, expectedSize, expectedWeight) => {
    const view = await render(<LfText testID="t" variant={variant} />);
    const s = styleOf(view, 't') as TextStyle;
    expect(s.fontSize).toBe(expectedSize);
    expect(s.fontWeight).toBe(expectedWeight);
  });

  test('secondary 는 보조 텍스트 색을 쓴다', async () => {
    const view = await render(<LfText testID="t" secondary />);
    expect((styleOf(view, 't') as TextStyle).color).toBe(colors.textSecondary);
  });

  test('caption 은 흐린 색이다', async () => {
    const view = await render(<LfText testID="t" variant="caption" />);
    expect((styleOf(view, 't') as TextStyle).color).toBe(colors.textMuted);
  });

  test('색을 직접 넘길 수 없다 — 토큰 밖 값이 새는 걸 막는다', async () => {
    const props = { testID: 't', color: '#FF0000' } as unknown as { testID: string };
    const view = await render(<LfText {...props} />);
    expect((styleOf(view, 't') as TextStyle).color).not.toBe('#FF0000');
  });

  test('디스클레이머 변형은 가장 흐린 색을 쓴다', async () => {
    const view = await render(<LfText testID="t" variant="disclaimer" />);
    expect((styleOf(view, 't') as TextStyle).color).toBe(colors.textFaint);
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
  const variants = ['filled', 'tonal', 'outlined', 'text', 'kakao', 'danger'] as const;

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
    expect((styleOf(view, 'b') as ViewStyle).height).toBe(size.ctaHeight);
  });

  test('filled 는 브랜드 색을 쓴다', async () => {
    const view = await render(<LfButton testID="b" variant="filled" label="확인" />);
    expect((styleOf(view, 'b') as ViewStyle).backgroundColor).toBe(colors.primary);
  });

  test('kakao 는 카카오 공식 버튼 색을 쓴다', async () => {
    const view = await render(<LfButton testID="b" variant="kakao" label="카카오로 시작하기" />);
    expect((styleOf(view, 'b') as ViewStyle).backgroundColor).toBe(colors.kakao);
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
    expect((styleOf(view, 'b') as ViewStyle).opacity).toBe(0.38);
  });
});

describe('LfCard', () => {
  test('기본 카드는 흰 표면에 얇은 테두리다', async () => {
    const view = await render(<LfCard testID="c" />);
    const s = styleOf(view, 'c') as ViewStyle;
    expect(s.backgroundColor).toBe(colors.surface);
    expect(s.borderColor).toBe(colors.outline);
    expect(s.borderWidth).toBe(1);
  });

  test('emphasis 는 2dp 로즈 테두리로 주목시킨다', async () => {
    const view = await render(<LfCard testID="c" variant="emphasis" />);
    const s = styleOf(view, 'c') as ViewStyle;
    expect(s.borderWidth).toBe(2);
    expect(s.borderColor).toBe(colors.primary);
  });

  test('container 는 톤 배경에 테두리가 없다', async () => {
    const view = await render(<LfCard testID="c" variant="container" />);
    const s = styleOf(view, 'c') as ViewStyle;
    expect(s.backgroundColor).toBe(colors.primaryContainer);
    expect(s.borderWidth).toBe(0);
  });

  test('flat 은 배경도 테두리도 여백도 없다', async () => {
    const view = await render(<LfCard testID="c" variant="flat" />);
    const s = styleOf(view, 'c') as ViewStyle;
    expect(s.borderWidth).toBe(0);
    expect(s.backgroundColor).toBe('transparent');
    expect(s.paddingVertical).toBe(0);
    expect(s.paddingHorizontal).toBe(0);
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
    expect(fallback.getByText('지')).toBeTruthy();
    expect(styleOf(fallback, 'avatar').width).toBe(size.iconButton);

    const photo = await render(
      <LfAvatar
        testID="avatar-photo"
        nickname="지우"
        profileImageUrl="https://example.com/avatar.jpg"
        accessibilityLabel="지우 프로필 사진"
      />,
    );
    expect(photo.getByLabelText('지우 프로필 사진').props.source).toEqual({
      uri: 'https://example.com/avatar.jpg',
    });
  });
});
