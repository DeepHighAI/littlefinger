import type { NotificationInboxItem } from '@littlefinger/shared';
import { useRouter } from 'expo-router';
import { useEffect, useReducer, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfEmpty } from '../components/LfEmpty';
import { LfIcon } from '../components/LfIcon';
import { LfPinky } from '../components/LfPinky';
import { LfText } from '../components/LfText';
import {
  createNotificationReadIdempotencyKey,
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notification-inbox-native.ts';
import {
  routeForNotificationDeeplink,
} from '../lib/push-navigation.ts';
import { SCR_A07_LABEL } from '../screens/scr-a07-labels.ts';
import {
  notificationAppearance,
  notificationSections,
  notificationTimeLabel,
} from '../screens/scr-a07-notification-presentation.ts';
import {
  INITIAL_NOTIFICATION_INBOX_STATE,
  isNotificationUnread,
  notificationInboxReducer,
  unreadNotificationIds,
} from '../screens/scr-a07-notification-state.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, gutter, radius, size, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  back: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerAction: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readAll: {
    minHeight: size.touchMin,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  readAllText: {
    color: colors.primary,
    fontSize: type.label,
    fontWeight: weight.bold,
    fontFamily: brandFontFamily(weight.bold),
  },
  body: { padding: gutter.app, paddingBottom: space[9], gap: space[7] },
  section: { gap: space[3] },
  list: { gap: space[3] },
  item: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[5],
    borderRadius: radius.lg,
    paddingVertical: space[5],
    paddingHorizontal: space[6],
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  unreadItem: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  icon: {
    width: size.tabHeight,
    height: size.tabHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentIcon: { backgroundColor: colors.primaryContainer },
  urgentIcon: { backgroundColor: colors.primary },
  itemBody: { flex: 1, minWidth: 0 },
  headline: {
    color: colors.textSecondary,
    fontSize: type.label,
    fontWeight: weight.medium,
    fontFamily: brandFontFamily(weight.medium),
  },
  unreadHeadline: {
    color: colors.text,
    fontWeight: weight.bold,
    fontFamily: brandFontFamily(weight.bold),
  },
  meta: {
    marginTop: space[1],
    color: colors.textMuted,
    fontSize: type.caption,
    fontWeight: weight.regular,
    fontFamily: brandFontFamily(weight.regular),
  },
  unreadDot: {
    width: space[3],
    height: space[3],
    marginTop: space[1],
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[5] },
});

function iconFor(item: NotificationInboxItem): React.JSX.Element {
  const appearance = notificationAppearance(item.event);
  if (appearance.icon === 'pinky') {
    return (
      <View style={[styles.icon, styles.accentIcon]}>
        <LfPinky size="xs" tone="onContainer" />
      </View>
    );
  }
  const urgent = appearance.tone === 'urgent';
  return (
    <View style={[styles.icon, urgent && styles.urgentIcon]}>
      <LfIcon
        name={appearance.icon}
        size={type.heading}
        color={urgent ? 'onPrimary' : 'textSecondary'}
      />
    </View>
  );
}

export default function NotificationInboxScreen(): React.JSX.Element {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    notificationInboxReducer,
    INITIAL_NOTIFICATION_INBOX_STATE,
  );
  const stateRef = useRef(state);
  const inFlightItemIds = useRef(new Set<string>());
  stateRef.current = state;
  const { items, loadFailed } = state;

  async function refresh(): Promise<void> {
    const startedRevision = stateRef.current.completionRevision;
    dispatch({ type: 'REFRESH_STARTED' });
    try {
      const response = await listNotificationInbox();
      dispatch({ type: 'REFRESH_SUCCEEDED', items: response.items, startedRevision });
    } catch {
      dispatch({ type: 'REFRESH_FAILED' });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startItemRead(item: NotificationInboxItem): void {
    inFlightItemIds.current.add(item.notification_id);
    dispatch({ type: 'READ_STARTED', notificationId: item.notification_id });
    void markNotificationRead(item.notification_id, createNotificationReadIdempotencyKey())
      .then((response) => {
        dispatch({
          type: 'READ_SUCCEEDED',
          notificationId: response.notification_id,
          readAt: response.read_at,
        });
      })
      .catch(() => {
        dispatch({ type: 'READ_FAILED', notificationId: item.notification_id });
      })
      .finally(() => inFlightItemIds.current.delete(item.notification_id));
  }

  function openItem(item: NotificationInboxItem): void {
    if (inFlightItemIds.current.has(item.notification_id)) return;
    if (isNotificationUnread(stateRef.current, item)) startItemRead(item);
    const route =
      item.deeplink === null
        ? null
        : routeForNotificationDeeplink(item.deeplink, item.promise_id);
    if (route !== null) router.push(route);
  }

  function readAll(): void {
    const current = stateRef.current;
    if (current.readAllPending) return;
    const notificationIds = unreadNotificationIds(current);
    if (notificationIds.length === 0) return;
    dispatch({ type: 'READ_ALL_STARTED', notificationIds });
    void markAllNotificationsRead(createNotificationReadIdempotencyKey())
      .then(() => {
        dispatch({ type: 'READ_ALL_SUCCEEDED', notificationIds });
      })
      .catch(() => {
        dispatch({ type: 'READ_ALL_FAILED', notificationIds });
      });
  }

  const now = new Date();
  const action = (
    <View style={styles.headerActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SCR_A07_LABEL.refresh}
        onPress={() => void refresh()}
        style={styles.headerAction}
      >
        <LfIcon name="refresh" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SCR_A07_LABEL.readAll}
        onPress={readAll}
        style={styles.readAll}
      >
        <Text style={styles.readAllText}>{SCR_A07_LABEL.readAll}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={SCR_A07_LABEL.title}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SCR_A07_LABEL.back}
            onPress={() => router.back()}
            style={styles.back}
          >
            <LfIcon name="arrow-back" />
          </Pressable>
        }
        action={action}
      />
      {items === null ? (
        <View style={styles.centered}>
          <LfText secondary>{SCR_A07_LABEL.loading}</LfText>
        </View>
      ) : loadFailed && items.length === 0 ? (
        <View style={styles.centered}>
          <LfText secondary align="center">
            {SCR_A07_LABEL.loadError}
          </LfText>
          <LfButton label={SCR_A07_LABEL.retry} variant="outlined" onPress={() => void refresh()} />
        </View>
      ) : items.length === 0 ? (
        <LfEmpty title={SCR_A07_LABEL.empty} description={SCR_A07_LABEL.emptyDescription} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {loadFailed && (
            <LfText secondary align="center">
              {SCR_A07_LABEL.loadError}
            </LfText>
          )}
          {notificationSections(items, now).map((section) => (
            <View key={section.title} style={styles.section}>
              <LfText variant="sectionTitle">{section.title}</LfText>
              <View style={styles.list}>
                {section.items.map((item) => {
                  const unread = isNotificationUnread(state, item);
                  const timeLabel = notificationTimeLabel(item.created_at, now);
                  return (
                    <Pressable
                      key={item.notification_id}
                      testID={`notification-${item.notification_id}`}
                      accessibilityRole="button"
                      accessibilityLabel={SCR_A07_LABEL.item(
                        item.title,
                        item.body,
                        timeLabel,
                        !unread,
                      )}
                      onPress={() => openItem(item)}
                      style={[styles.item, unread && styles.unreadItem]}
                    >
                      {iconFor(item)}
                      <View style={styles.itemBody}>
                        <Text style={[styles.headline, unread && styles.unreadHeadline]}>{item.title}</Text>
                        <Text
                          testID={`notification-body-${item.notification_id}`}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={styles.meta}
                        >
                          {`${item.body} · ${timeLabel}`}
                        </Text>
                        {unread && (
                          <LfText
                            testID={`notification-unread-${item.notification_id}`}
                            variant="caption"
                          >
                            {SCR_A07_LABEL.unread}
                          </LfText>
                        )}
                      </View>
                      {unread && <View testID={`notification-dot-${item.notification_id}`} style={styles.unreadDot} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
