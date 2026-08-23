import { StyleSheet, Text, type TextProps } from 'react-native';

import { brandFontFamily, type PretendardWeight } from '../theme/fonts';
import { colors, line, type, weight } from '../theme/tokens';

/**
 * 텍스트 — 원본 `.lf-title` / `.lf-headline` / `.lf-subtitle` / `.lf-section-title` /
 * `.lf-body` / `.lf-caption` 을 variant 로 접은 것 (04 §5-2).
 *
 * 색·크기를 props 로 받지 않는다. 받는 순간 화면 코드에 디자인 리터럴이 새기 시작한다.
 */

export type LfTextVariant =
  | 'headline'
  | 'confirmationHeadline'
  | 'title'
  | 'subtitle'
  | 'sectionTitle'
  | 'containerAccent'
  | 'containerFlag'
  | 'containerTitle'
  | 'listTitle'
  | 'listMeta'
  | 'listStatus'
  | 'dday'
  | 'ddayXl'
  | 'heroDday'
  | 'body'
  | 'caption'
  | 'disclaimer';

export interface LfTextProps extends Omit<TextProps, 'style'> {
  variant?: LfTextVariant;
  /** 보조 톤. 본문 계열에서만 의미가 있다. */
  secondary?: boolean;
  align?: 'left' | 'center' | 'right';
}

const styles = StyleSheet.create({
  headline: { fontSize: 22, lineHeight: 30, fontWeight: weight.bold, color: colors.text },
  confirmationHeadline: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  title: {
    fontSize: type.title,
    lineHeight: line.title,
    fontWeight: weight.bold,
    color: colors.text,
  },
  subtitle: { fontSize: type.subtitle, fontWeight: weight.bold, color: colors.text },
  sectionTitle: { fontSize: type.caption, fontWeight: weight.bold, color: colors.textMuted },
  containerAccent: { fontSize: type.caption, fontWeight: weight.bold, color: colors.success },
  // 임박 배너 (.lf-home__pinned-flag / -title) — 역할 기반 톤 위 잉크
  containerFlag: {
    fontSize: type.caption,
    fontWeight: weight.bold,
    color: colors.attention,
  },
  containerTitle: {
    fontSize: type.bodyLg,
    fontWeight: weight.bold,
    color: colors.onPrimaryContainer,
  },
  // 당근식 풀폭 리스트 행 (.lf-home__row-title / -meta / -meta strong, ADR 0008)
  listTitle: {
    fontSize: type.bodyLg,
    lineHeight: line.body,
    fontWeight: weight.medium,
    color: colors.text,
  },
  listMeta: {
    fontSize: type.label,
    lineHeight: line.caption,
    fontWeight: weight.regular,
    color: colors.textMuted,
  },
  listStatus: {
    fontSize: type.label,
    lineHeight: line.caption,
    fontWeight: weight.bold,
    color: colors.primaryInk,
  },
  // 행 우측 D-Day (.lf-home__row-dday)
  dday: { fontSize: type.listDday, fontWeight: weight.bold, color: colors.success },
  // 배너의 대형 D-Day (.lf-dday--xl)
  ddayXl: { fontSize: type.display, fontWeight: weight.heavy, color: colors.success },
  heroDday: {
    fontSize: type.heroDday,
    lineHeight: line.heroDday,
    fontWeight: weight.heavy,
    color: colors.primaryInk,
  },
  body: {
    fontSize: type.body,
    lineHeight: line.body,
    fontWeight: weight.regular,
    color: colors.text,
  },
  caption: {
    fontSize: type.caption,
    lineHeight: line.caption,
    fontWeight: weight.regular,
    color: colors.textMuted,
  },
  // 문구는 LfDisclaimer 가 상수로 넣는다. 여기는 모양만 정의한다.
  disclaimer: {
    fontSize: type.micro,
    lineHeight: line.micro,
    fontWeight: weight.regular,
    color: colors.textFaint,
  },
});

export function LfText({
  variant = 'body',
  secondary = false,
  align,
  ...rest
}: LfTextProps): React.JSX.Element {
  const base = styles[variant];
  const fontWeight = base.fontWeight as PretendardWeight;

  return (
    <Text
      {...rest}
      style={[
        base,
        { fontFamily: brandFontFamily(fontWeight) },
        secondary && { color: colors.textSecondary },
        align !== undefined && { textAlign: align },
      ]}
    />
  );
}
