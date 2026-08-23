import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, space } from '../theme/tokens';

/** 원본 `.lf-card` + `--emphasis` / `--container` / `--flat` (04 §5-2) */

export type LfCardVariant = 'default' | 'emphasis' | 'container' | 'record' | 'flat';

export interface LfCardProps extends Omit<ViewProps, 'style'> {
  variant?: LfCardVariant;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.xl,
    paddingVertical: space[6],
    paddingHorizontal: space[7],
  },
  default: {},
  // 이행 확인이 필요한 카드 — 정보 구조는 블루, 실제 행동은 액션 그린으로 분리한다.
  emphasis: { borderWidth: 2, borderColor: colors.record },
  // 톤 카드 — 임박 약속 · 부드러운 확인 배경
  container: { backgroundColor: colors.primaryContainer, borderWidth: 0 },
  // 확정 뒤 기록 표면 — 중립 캔버스 위에서 대칭 곡률과 헤어라인만 쓴다.
  record: { borderRadius: radius.record, backgroundColor: colors.surface },
  // RN 은 padding 과 paddingVertical 이 별개 키라 셋 다 0 으로 눌러야 여백이 사라진다.
  flat: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});

export function LfCard({ variant = 'default', ...rest }: LfCardProps): React.JSX.Element {
  return <View {...rest} style={[styles.base, styles[variant]]} />;
}
