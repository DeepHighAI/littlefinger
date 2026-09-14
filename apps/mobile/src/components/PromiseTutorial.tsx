import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useLabels } from '../lib/locale-native';
import { PROMISE_TUTORIAL_LABEL } from '../screens/promise-tutorial-labels.ts';
import { border, colors, elevation, gutter, radius, space } from '../theme/tokens';
import { LfButton } from './LfButton';
import { LfText } from './LfText';

interface TargetBounds { x: number; y: number; width: number; height: number }
interface PromiseTutorialProps {
  target: RefObject<View | null>;
  step: 1 | 2 | 3 | 4 | 5;
  onPress(): void;
  onComplete?(): void;
}
const STEPS = ['home', 'content', 'conditions', 'review', 'invite'] as const;

/** 실제 버튼 위의 투명 터치 영역만 열어 배경 조작과 접근성 포커스를 함께 제한한다. */
export function PromiseTutorial({ target, step, onPress, onComplete }: PromiseTutorialProps): React.JSX.Element {
  const LABEL = useLabels(PROMISE_TUTORIAL_LABEL);
  const copy = LABEL[STEPS[step - 1] ?? 'home'];
  const host = useRef<View>(null);
  const [bounds, setBounds] = useState<TargetBounds | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const { width, height, fontScale } = useWindowDimensions();
  const measure = useCallback(() => {
    target.current?.measureInWindow((x, y, w, h) => {
      host.current?.measureInWindow((hostX, hostY) => {
        if (w > 0 && h > 0) setBounds({ x: x - hostX, y: y - hostY, width: w, height: h });
      });
    });
  }, [target]);
  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure, width, height, fontScale]);
  const above = bounds !== null && bounds.y > height / 2;
  const room = bounds === null ? height : above ? bounds.y : height - bounds.y - bounds.height;
  const maxBubbleHeight = Math.max(space[9], room - space[9] * 2);
  const bubbleTop = bounds === null ? 0 : above
    ? Math.max(space[9], bounds.y - bubbleHeight - space[6])
    : bounds.y + bounds.height + space[6];
  const hole = bounds === null ? null : {
    left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height,
  };
  const r = radius.md;
  const cutout = bounds === null ? '' : `M${bounds.x + r},${bounds.y}
    H${bounds.x + bounds.width - r} Q${bounds.x + bounds.width},${bounds.y} ${bounds.x + bounds.width},${bounds.y + r}
    V${bounds.y + bounds.height - r} Q${bounds.x + bounds.width},${bounds.y + bounds.height} ${bounds.x + bounds.width - r},${bounds.y + bounds.height}
    H${bounds.x + r} Q${bounds.x},${bounds.y + bounds.height} ${bounds.x},${bounds.y + bounds.height - r}
    V${bounds.y + r} Q${bounds.x},${bounds.y} ${bounds.x + r},${bounds.y} Z`;

  return <Modal transparent visible statusBarTranslucent navigationBarTranslucent
    animationType="fade" onShow={measure} onRequestClose={() => {}}>
    <View ref={host} style={styles.host} onLayout={measure} accessibilityViewIsModal>
      {bounds === null ? <View style={[StyleSheet.absoluteFill, styles.scrim]} /> : <>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
          <Path d={`M0,0 H${width} V${height} H0 Z ${cutout}`} fill={colors.scrim} fillRule="evenodd" />
        </Svg>
        <Pressable testID="tutorial-target" accessibilityRole="button" accessibilityLabel={copy.title}
          onPress={onPress} style={[styles.target, hole]} />
        <View style={[styles.bubble, { top: bubbleTop, maxHeight: maxBubbleHeight }]}
          onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}>
          <ScrollView contentContainerStyle={styles.copy}>
            <View style={styles.progress}>
              {STEPS.map((key, index) => <View key={key} style={[styles.dot,
                index < step && styles.visited, index === step - 1 && styles.current]} />)}
            </View>
            <LfText variant="eyebrow">{LABEL.progress(step, STEPS.length)}</LfText>
            <LfText variant="subtitle">{copy.title}</LfText>
            <LfText variant="caption" secondary>{copy.body}</LfText>
            {step === 5 && <LfButton label={LABEL.done} variant="tonal" onPress={onComplete} />}
          </ScrollView>
        </View>
        <View pointerEvents="none" style={[styles.arrow, {
          left: Math.min(width - gutter.app - space[8], Math.max(gutter.app + space[8], bounds.x + bounds.width / 2)) - space[4],
          top: above ? bubbleTop + bubbleHeight : bubbleTop - space[4],
          ...(above ? { borderTopColor: colors.surface, borderTopWidth: space[4] }
            : { borderBottomColor: colors.surface, borderBottomWidth: space[4] }),
        }]} />
      </>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  scrim: { position: 'absolute', backgroundColor: colors.scrim },
  target: { position: 'absolute', borderRadius: radius.md, borderWidth: border.card,
    borderColor: colors.primaryContainer },
  bubble: { position: 'absolute', left: gutter.app, right: gutter.app,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: border.card,
    borderColor: colors.text, ...elevation.card },
  copy: { padding: space[7], gap: space[3] },
  progress: { flexDirection: 'row', gap: space[2] },
  dot: { width: space[2], height: space[2], borderRadius: radius.pill, backgroundColor: colors.outline },
  visited: { backgroundColor: colors.primaryContainer },
  current: { width: space[7], backgroundColor: colors.text },
  arrow: { position: 'absolute', borderLeftWidth: space[4], borderRightWidth: space[4],
    borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
