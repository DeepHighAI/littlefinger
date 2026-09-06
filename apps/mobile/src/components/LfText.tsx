import { createContext, useContext } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { textFontFamily, type TextFontWeight } from '../theme/fonts';
import { colors, letterSpacing, line, type, weight } from '../theme/tokens';

/** 텍스트 역할을 디자인 토큰에 고정해 화면 코드의 임의 색·크기 사용을 막는다. */
export type LfTextVariant =
  | 'wordmark'
  | 'display'
  | 'headline'
  | 'title'
  | 'sheetTitle'
  | 'cardTitle'
  | 'stamp'
  | 'heading'
  | 'subtitle'
  | 'appbar'
  | 'appbarBrand'
  | 'bodyStrong'
  | 'body'
  | 'label'
  | 'bodySm'
  | 'caption'
  | 'meta'
  | 'eyebrow'
  | 'chip'
  | 'countdown'
  | 'micro'
  | 'error'
  | 'disclaimer';

export interface LfTextProps extends Omit<TextProps, 'style'> {
  variant?: LfTextVariant;
  /** 본문 계열의 보조 정보에만 사용한다. */
  secondary?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * 4색 면(옐로·민트·핑크·스카이) 안에서는 보조·메타 글자도 잉크로 그린다 —
 * 보조색은 옐로 위에서 4.03:1 로 떨어진다(ADR 0020). 면을 그리는 컴포넌트가 true 를 공급한다.
 */
export const LfInkContext = createContext(false);

/** README 캡션 줄높이 19 — 줄높이 토큰 없음, ADR 0020 예외 */
const CAPTION_LINE = 19;

function tracking(fontSize: number, em: number): number {
  return fontSize * em;
}

const styles = StyleSheet.create<Record<LfTextVariant, TextStyle>>({
  wordmark: {
    fontSize: type.wordmark,
    lineHeight: line.wordmark,
    fontWeight: weight.heavy,
    letterSpacing: tracking(type.wordmark, letterSpacing.wordmark),
    color: colors.text,
  },
  display: {
    fontSize: type.display,
    lineHeight: line.display,
    fontWeight: weight.heavy,
    letterSpacing: tracking(type.display, letterSpacing.tight),
    color: colors.text,
  },
  headline: {
    fontSize: type.headline,
    lineHeight: line.headline,
    fontWeight: weight.bold,
    letterSpacing: tracking(type.headline, letterSpacing.tight),
    color: colors.text,
  },
  title: {
    fontSize: type.title,
    lineHeight: line.title,
    fontWeight: weight.bold,
    letterSpacing: tracking(type.title, letterSpacing.tight),
    color: colors.text,
  },
  sheetTitle: {
    fontSize: type.sheetTitle,
    lineHeight: line.title,
    fontWeight: weight.bold,
    color: colors.text,
  },
  cardTitle: {
    fontSize: type.cardTitle,
    lineHeight: line.cardTitle,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  stamp: {
    fontSize: type.stamp,
    lineHeight: line.body,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  heading: {
    fontSize: type.heading,
    lineHeight: line.cardTitle,
    fontWeight: weight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: type.subtitle,
    lineHeight: line.cardTitle,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  appbar: {
    fontSize: type.appbar,
    lineHeight: line.bodyStrong,
    fontWeight: weight.bold,
    color: colors.text,
  },
  // 홈 워드마크 — 22/900, 자간 -0.04em, 줄높이 1
  appbarBrand: {
    fontSize: type.cardTitle,
    lineHeight: type.cardTitle,
    fontWeight: weight.heavy,
    letterSpacing: tracking(type.cardTitle, letterSpacing.wordmark),
    color: colors.text,
  },
  bodyStrong: {
    fontSize: type.body,
    lineHeight: line.bodyStrong,
    fontWeight: weight.bold,
    color: colors.text,
  },
  body: {
    fontSize: type.body,
    lineHeight: line.body,
    fontWeight: weight.medium,
    color: colors.text,
  },
  label: {
    fontSize: type.label,
    lineHeight: line.body,
    fontWeight: weight.bold,
    color: colors.text,
  },
  bodySm: {
    fontSize: type.label,
    lineHeight: line.body,
    fontWeight: weight.medium,
    color: colors.text,
  },
  caption: {
    fontSize: type.chip,
    lineHeight: CAPTION_LINE,
    fontWeight: weight.medium,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: type.meta,
    lineHeight: line.caption,
    fontWeight: weight.medium,
    color: colors.textMuted,
  },
  eyebrow: {
    fontSize: type.eyebrow,
    lineHeight: line.micro,
    fontWeight: weight.bold,
    letterSpacing: tracking(type.eyebrow, letterSpacing.wide),
    color: colors.textMuted,
  },
  chip: {
    fontSize: type.meta,
    lineHeight: line.caption,
    fontWeight: weight.bold,
    color: colors.text,
  },
  countdown: {
    fontSize: type.cardTitle,
    lineHeight: line.cardTitle,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  micro: {
    fontSize: type.micro,
    lineHeight: line.micro,
    fontWeight: weight.medium,
    color: colors.textMuted,
  },
  error: {
    fontSize: type.caption,
    lineHeight: line.caption,
    fontWeight: weight.medium,
    color: colors.error,
  },
  disclaimer: {
    fontSize: type.caption,
    lineHeight: line.caption,
    fontWeight: weight.bold,
    color: colors.textSecondary,
  },
});

export function LfText({
  variant = 'body',
  secondary = false,
  align,
  ...rest
}: LfTextProps): React.JSX.Element {
  const base = styles[variant];
  const fontWeight = base.fontWeight as TextFontWeight;
  const onFace = useContext(LfInkContext);

  return (
    <Text
      {...rest}
      style={[
        base,
        { fontFamily: textFontFamily(fontWeight) },
        secondary && { color: colors.textSecondary },
        onFace && { color: colors.text },
        align !== undefined && { textAlign: align },
      ]}
    />
  );
}
