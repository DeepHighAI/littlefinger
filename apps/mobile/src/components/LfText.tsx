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
    fontWeight: weight.heavy,
    letterSpacing: tracking(type.headline, letterSpacing.tight),
    color: colors.text,
  },
  title: {
    fontSize: type.title,
    lineHeight: line.title,
    fontWeight: weight.heavy,
    letterSpacing: tracking(type.title, letterSpacing.tight),
    color: colors.text,
  },
  sheetTitle: {
    fontSize: type.sheetTitle,
    lineHeight: line.title,
    fontWeight: weight.heavy,
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
  bodyStrong: {
    fontSize: type.body,
    lineHeight: line.bodyStrong,
    fontWeight: weight.bold,
    color: colors.text,
  },
  body: {
    fontSize: type.body,
    lineHeight: line.body,
    fontWeight: weight.regular,
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
    fontWeight: weight.regular,
    color: colors.text,
  },
  caption: {
    fontSize: type.label,
    lineHeight: line.body,
    fontWeight: weight.regular,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: type.meta,
    lineHeight: line.caption,
    fontWeight: weight.regular,
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
    fontSize: type.chip,
    lineHeight: line.caption,
    fontWeight: weight.bold,
    color: colors.text,
  },
  countdown: {
    fontSize: type.sheetTitle,
    lineHeight: line.title,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  micro: {
    fontSize: type.micro,
    lineHeight: line.micro,
    fontWeight: weight.regular,
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

  return (
    <Text
      {...rest}
      style={[
        base,
        { fontFamily: textFontFamily(fontWeight) },
        secondary && { color: colors.textSecondary },
        align !== undefined && { textAlign: align },
      ]}
    />
  );
}
