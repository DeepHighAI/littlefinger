import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, border, elevation, gutter, radius, size, space } from '../theme/tokens';
import { LfIcon } from './LfIcon';
import { LfStack } from './LfStack';
import { LfInkContext, LfText } from './LfText';

export interface LfHeroProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  /** 상단에 걸치는 핑크 배지 — "D-1" 또는 "이행 확인 필요" */
  badge?: string;
  eyebrow?: string;
  description?: string;
  /** 당사자 줄 "지우 — 민준" */
  meta?: string;
}

/** README 눌림 — translate 3 · 그림자 5→2. 번들 토큰 없음, ADR 0020 예외 */
const PRESS_OFFSET = 3;
const PRESSED_SHADOW = { boxShadow: [{ offsetX: 2, offsetY: 2, blurRadius: 0, spreadDistance: 0, color: colors.text }] };
/** README 히어로 — 배지 26h · 패딩 20 18 18 · 화살표 46 r12. 토큰 없음, ADR 0020 예외 */
const BADGE_HEIGHT = 26;
const SIDE_PADDING = 18;
const ARROW = size.iconCircle + space[2];

/** 임박 약속 히어로 — 옐로 면 r14, 회전·블롭·눈 없음 (README §5). 홈 본문의 좌 16 · 우 20 안에 놓인다 */
export function LfHero({
  title,
  badge,
  eyebrow,
  description,
  meta,
  accessibilityLabel,
  ...rest
}: LfHeroProps): React.JSX.Element {
  return (
    <LfInkContext.Provider value>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        {...rest}
        style={({ pressed }) => [
          styles.hero,
          pressed && { transform: [{ translateX: PRESS_OFFSET }, { translateY: PRESS_OFFSET }], ...PRESSED_SHADOW },
        ]}
      >
        {badge === undefined ? null : (
          <View style={styles.badge}><LfText variant="chip">{badge}</LfText></View>
        )}
        <LfStack grow gap={1}>
          {eyebrow === undefined ? null : <LfText variant="eyebrow">{eyebrow}</LfText>}
          <LfText variant="cardTitle">{title}</LfText>
          {description === undefined ? null : <LfText variant="bodySm">{description}</LfText>}
          {meta === undefined ? null : <LfText variant="chip">{meta}</LfText>}
        </LfStack>
        <View style={styles.arrow}>
          <LfIcon name="arrow_forward" size={size.appbarIcon} />
        </View>
      </Pressable>
    </LfInkContext.Provider>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginLeft: gutter.app,
    marginRight: space[8],
    marginTop: space[4],
    paddingTop: space[8],
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: SIDE_PADDING,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.card,
    borderColor: colors.text,
    ...elevation.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
  },
  badge: {
    position: 'absolute',
    top: -space[6],
    left: space[6],
    height: BADGE_HEIGHT,
    paddingHorizontal: space[4],
    borderRadius: radius.xs,
    backgroundColor: colors.attentionContainer,
    borderWidth: border.chip,
    borderColor: colors.text,
    justifyContent: 'center',
  },
  arrow: {
    width: ARROW,
    height: ARROW,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
