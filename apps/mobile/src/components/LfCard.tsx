import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, elevation, radius, space } from '../theme/tokens';

/** 원본 `.lf-card` + `--emphasis` / `--container` / `--flat` (04 §5-2) */

export type LfCardVariant = 'default' | 'emphasis' | 'container' | 'record' | 'flat';

export interface LfCardProps extends Omit<ViewProps, 'style'> {
  variant?: LfCardVariant;
}

// 잉크 테두리 스티커 카드 (ADR 0012)
const CARD_BORDER_WIDTH = 2.2;

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: CARD_BORDER_WIDTH,
    borderColor: colors.text,
    borderRadius: radius.xl,
    paddingVertical: space[6],
    paddingHorizontal: space[7],
    ...elevation.card,
  },
  default: {},
  // 이행 확인이 필요한 카드 — 라벤더(record) 테두리로 정보 구조를 강조한다.
  emphasis: { borderWidth: 2, borderColor: colors.record },
  // 톤 카드 — 임박 약속 · 부드러운 확인 배경 (버터 스티커)
  container: { backgroundColor: colors.primaryContainer, borderWidth: 0 },
  // 확정 뒤 기록 표면 — 대칭 곡률의 스티커 카드.
  record: { borderRadius: radius.record, backgroundColor: colors.surface },
  // RN 은 padding 과 paddingVertical 이 별개 키라 셋 다 0 으로 눌러야 여백이 사라진다.
  // 투명 배경 위 오프셋 섀도는 안드로이드에서 그림자 상자만 남기므로 함께 끈다.
  flat: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export function LfCard({ variant = 'default', ...rest }: LfCardProps): React.JSX.Element {
  return <View {...rest} style={[styles.base, styles[variant]]} />;
}
