import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, radius, size, space, type, weight } from '../theme/tokens';

export interface LfSegmentedItem<K extends string> {
  key: K;
  label: string;
  /** 보이는 라벨과 스크린리더 이름이 다를 때 — "English" 를 "English(으)로 보기" 로 읽는다 */
  accessibilityLabel?: string;
}

export interface LfSegmentedProps<K extends string> extends Omit<ViewProps, 'style' | 'children'> {
  items: readonly LfSegmentedItem<K>[];
  value: K;
  onChange(value: K): void;
  accessibilityLabel: string;
}

/** README 세그먼트 항목 38h — 토큰 없음, ADR 0020 예외. 갤러리의 ::after 처럼 hitSlop 으로 48 을 채운다 */
const ITEM_HEIGHT = 38;
const HIT_SLOP = (size.touchMin - ITEM_HEIGHT) / 2;

/** 세그먼트 — 단일 2px 잉크 박스 r10, 항목 사이 세로 2px 분할, 선택은 옐로 + 800 */
export function LfSegmented<K extends string>({
  items,
  value,
  onChange,
  ...rest
}: LfSegmentedProps<K>): React.JSX.Element {
  return (
    <View {...rest} accessibilityRole="tablist" style={styles.box}>
      {items.map((item, index) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected }}
            hitSlop={HIT_SLOP}
            onPress={() => onChange(item.key)}
            style={[styles.item, index > 0 && styles.divided, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  divided: { borderLeftWidth: border.chip, borderLeftColor: colors.text },
  selected: { backgroundColor: colors.primaryContainer },
  label: {
    color: colors.text,
    fontSize: type.chip,
    fontFamily: textFontFamily(weight.medium),
  },
  selectedLabel: { fontFamily: textFontFamily(weight.bold) },
});
