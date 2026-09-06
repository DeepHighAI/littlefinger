import type { SlotStatusResponse } from '@littlefinger/shared';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLabels } from '../lib/locale-native';
import { listNotificationInbox } from '../lib/notification-inbox-native.ts';
import { loadSlotStatus } from '../lib/slots-native.ts';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, border, elevation, radius, size, space } from '../theme/tokens';
import { LfAvatar } from './LfAvatar';
import type { LfIconName } from './LfIcon';
import { LfSheet } from './LfSheet';
import { LfStatusTile, type LfStatusTileTone } from './LfStatusTile';
import { LfText } from './LfText';

export type HomeMenuRoute = '/notifications' | '/profile' | '/history';

export interface HomeMenuData {
  unreadCount: number | null;
  slots: SlotStatusResponse | null;
  refresh(): void;
}

/**
 * 메뉴 시트가 보여주는 수치 — 읽지 않은 알림 수와 슬롯 사용량. 홈이 마운트될 때 한 번, 시트를 열 때 다시 읽는다.
 * 실패해도 메뉴는 열려야 하므로 값은 null 로 남기고 오류를 화면에 띄우지 않는다.
 */
export function useHomeMenuData(): HomeMenuData {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [slots, setSlots] = useState<SlotStatusResponse | null>(null);

  const refresh = useCallback(() => {
    void listNotificationInbox({})
      .then((response) => setUnreadCount(response.unread_count))
      .catch(() => setUnreadCount(null));
    void loadSlotStatus()
      .then((response) => setSlots(response))
      .catch(() => setSlots(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { unreadCount, slots, refresh };
}

export interface HomeMenuSheetProps {
  visible: boolean;
  onClose(): void;
  onNavigate(route: HomeMenuRoute): void;
  nickname: string | null;
  trustRate: number | null | undefined;
  unreadCount: number | null;
  slots: SlotStatusResponse | null;
}

/** README 눌림 — translate 3 · 그림자 5→2. 배지 24h. 토큰 없음, ADR 0020 예외 */
const PRESS_OFFSET = 3;
const PRESSED_SHADOW = { boxShadow: [{ offsetX: 2, offsetY: 2, blurRadius: 0, spreadDistance: 0, color: colors.text }] };
const BADGE_HEIGHT = 24;

interface Tile {
  route: HomeMenuRoute;
  icon: LfIconName;
  tone: LfStatusTileTone;
  label: string;
  accessibilityLabel: string;
  yellow: boolean;
  badge: string | null;
}

/** 홈 앱바의 종·아바타를 대신하는 메뉴 시트 — 알림 · 마이 · 지난 약속 · 슬롯, 라우팅은 그대로 */
export function HomeMenuSheet({
  visible,
  onClose,
  onNavigate,
  nickname,
  trustRate,
  unreadCount,
  slots,
}: HomeMenuSheetProps): React.JSX.Element {
  const LABEL = useLabels(SCR_A02_LABEL);
  const unread = unreadCount ?? 0;
  const tiles: readonly Tile[] = [
    {
      route: '/notifications',
      icon: 'notifications',
      tone: 'paper',
      label: LABEL.notifications,
      accessibilityLabel: unread > 0 ? LABEL.menuNotifications(unread) : LABEL.notifications,
      yellow: unread > 0,
      badge: unread > 0 ? String(unread) : null,
    },
    {
      route: '/profile',
      icon: 'person',
      tone: 'paper',
      label: LABEL.menuProfile,
      accessibilityLabel: LABEL.menuProfile,
      yellow: false,
      badge: null,
    },
    {
      route: '/history',
      icon: 'history',
      tone: 'muted',
      label: LABEL.history,
      accessibilityLabel: LABEL.history,
      yellow: false,
      badge: null,
    },
    {
      route: '/profile',
      icon: 'bookmark',
      tone: 'sky',
      label: slots === null ? LABEL.menuSlotsLoading : LABEL.menuSlots(slots.used, slots.capacity),
      accessibilityLabel: slots === null ? LABEL.menuSlotsLoading : LABEL.menuSlots(slots.used, slots.capacity),
      yellow: false,
      badge: null,
    },
  ];

  return (
    <LfSheet
      visible={visible}
      title={LABEL.menuTitle}
      closeLabel={LABEL.menuClose}
      onClose={onClose}
      sheetTestID="home-menu-sheet"
    >
      <View style={styles.identity}>
        <LfAvatar
          nickname={nickname ?? LABEL.menuProfile}
          profileImageUrl={null}
          accessibilityLabel={LABEL.profileImage(nickname ?? LABEL.menuProfile)}
          size="lg"
        />
        <View style={styles.identityCopy}>
          <LfText variant="subtitle" numberOfLines={1}>{nickname ?? LABEL.menuProfile}</LfText>
          <LfText variant="meta">
            {trustRate === null || trustRate === undefined ? LABEL.menuRatePending : LABEL.menuRate(trustRate)}
          </LfText>
        </View>
      </View>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={`${tile.route}-${tile.icon}`}
            accessibilityRole="button"
            accessibilityLabel={tile.accessibilityLabel}
            onPress={() => {
              onClose();
              onNavigate(tile.route);
            }}
            style={({ pressed }) => [
              styles.tile,
              tile.yellow && styles.tileYellow,
              pressed && { transform: [{ translateX: PRESS_OFFSET }, { translateY: PRESS_OFFSET }], ...PRESSED_SHADOW },
            ]}
          >
            <LfStatusTile icon={tile.icon} tone={tile.tone} />
            <LfText variant="bodyStrong">{tile.label}</LfText>
            {tile.badge === null ? null : (
              <View style={styles.badge}><LfText variant="eyebrow">{tile.badge}</LfText></View>
            )}
          </Pressable>
        ))}
      </View>
    </LfSheet>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
    paddingHorizontal: space[1],
    paddingTop: space[1],
  },
  identityCopy: { flex: 1, minWidth: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[5],
  },
  // 2×2 타일 — 종이 r14 2.5 잉크 5px, 알림은 미읽음이 있을 때 옐로
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: size.touchMin,
    alignItems: 'flex-start',
    gap: space[4],
    padding: space[6],
    borderWidth: border.card,
    borderColor: colors.text,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  tileYellow: { backgroundColor: colors.primaryContainer },
  badge: {
    position: 'absolute',
    top: space[5],
    right: space[5],
    height: BADGE_HEIGHT,
    paddingHorizontal: space[3],
    borderRadius: radius.xs,
    backgroundColor: colors.attentionContainer,
    borderWidth: border.chip,
    borderColor: colors.text,
    justifyContent: 'center',
  },
});
