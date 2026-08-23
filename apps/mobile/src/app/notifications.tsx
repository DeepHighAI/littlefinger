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
import { useLabels, useLocale } from '../lib/locale-native';
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
  unreadItem: { backgroundColor: colors.recordContainer, borderColor: colors.recordContainer },
  icon: {
    width: size.tabHeight,
    height: size.tabHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentIcon: { backgroundColor: colors.primaryContainer },
  urgentIcon: { backgroundColor: colors.attentionContainer },
  itemBody: { flex: 1, minWidth: 0 },
  headline: {
    color: colors.textSecondary,
    fontSize: type.label,
    fontWeight: weight.medium,
    fontFamily: brandFontFamily(weight.medium),
  },
  unreadHeadline: {
    color: colors.record,
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
  pageAction: { gap: space[3] },
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
        color={urgent ? 'attention' : 'textSecondary'}
      />
    </View>
  );
}

export default function NotificationInboxScreen(): React.JSX.Element {
  const LABEL = useLabels(SCR_A07_LABEL);
  const { locale } = useLocale();
  const router = useRouter();
  const [state, dispatch] = useReducer(
    notificationInboxReducer,
    INITIAL_NOTIFICATION_INBOX_STATE,
  );
  const stateRef = useRef(state);
  const inFlightItemIds = useRef(new Set<string>());
  const pageInFlight = useRef<object | null>(null);
  const nextLoadId = useRef(0);
  stateRef.current = state;
  const { items, loadFailed } = state;

  async function refresh(): Promise<void> {
    const loadId = ++nextLoadId.current;
    const startedRevision = stateRef.current.completionRevision;
    pageInFlight.current = null;
    dispatch({ type: 'REFRESH_STARTED', loadId });
    try {
      const response = await listNotificationInbox();
      dispatch({
        type: 'REFRESH_SUCCEEDED',
        loadId,
        items: response.items,
        nextCursor: response.next_cursor,
        startedRevision,
      });
    } catch {
      dispatch({ type: 'REFRESH_FAILED', loadId });
    }
  }

  function loadMore(): void {
    const current = stateRef.current;
    if (
      current.nextCursor === null ||
      current.pageLoadPending ||
      current.latestLoadId !== nextLoadId.current ||
      pageInFlight.current !== null
    ) return;
    const generation = current.latestLoadId;
    const request = {};
    pageInFlight.current = request;
    dispatch({ type: 'PAGE_STARTED', loadId: generation });
    void listNotificationInbox({ cursor: current.nextCursor })
      .then((response) => {
        dispatch({
          type: 'PAGE_SUCCEEDED',
          loadId: generation,
          items: response.items,
          nextCursor: response.next_cursor,
        });
      })
      .catch(() => {
        dispatch({ type: 'PAGE_FAILED', loadId: generation });
      })
      .finally(() => {
        if (pageInFlight.current === request) pageInFlight.current = null;
      });
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
        accessibilityLabel={LABEL.refresh}
        onPress={() => void refresh()}
        style={styles.headerAction}
      >
        <LfIcon name="refresh" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL.readAll}
        onPress={readAll}
        style={styles.readAll}
      >
        <Text style={styles.readAllText}>{LABEL.readAll}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABEL.back}
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
          <LfText secondary>{LABEL.loading}</LfText>
        </View>
      ) : loadFailed && items.length === 0 ? (
        <View style={styles.centered}>
          <LfText secondary align="center">
            {LABEL.loadError}
          </LfText>
          <LfButton label={LABEL.retry} variant="outlined" onPress={() => void refresh()} />
        </View>
      ) : items.length === 0 ? (
        <LfEmpty title={LABEL.empty} description={LABEL.emptyDescription} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {loadFailed && (
            <LfText secondary align="center">
              {LABEL.loadError}
            </LfText>
          )}
          {notificationSections(items, now, locale).map((section) => (
            <View key={section.title} style={styles.section}>
              <LfText variant="sectionTitle">{section.title}</LfText>
              <View style={styles.list}>
                {section.items.map((item) => {
                  const unread = isNotificationUnread(state, item);
                  const timeLabel = notificationTimeLabel(item.created_at, now, locale);
                  return (
                    <Pressable
                      key={item.notification_id}
                      testID={`notification-${item.notification_id}`}
                      accessibilityRole="button"
                      accessibilityLabel={LABEL.item(
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
                            {LABEL.unread}
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
          {state.nextCursor !== null && (
            <View style={styles.pageAction}>
              {state.pageLoadFailed && (
                <LfText secondary align="center">
                  {LABEL.pageLoadError}
                </LfText>
              )}
              <LfButton
                label={
                  state.pageLoadPending ? LABEL.loadingMore : LABEL.loadMore
                }
                variant="outlined"
                block
                disabled={state.pageLoadPending}
                onPress={loadMore}
              />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
