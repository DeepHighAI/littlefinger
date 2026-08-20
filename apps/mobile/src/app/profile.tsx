import {
  LOCALES,
  REMINDER_HOURS,
  type Locale,
  type ReminderHour,
  type ReminderPreferences,
} from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { LfAppBar } from '../components/LfAppBar';
import { LfAvatar } from '../components/LfAvatar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfDisclaimer } from '../components/LfDisclaimer';
import { LfIcon } from '../components/LfIcon';
import { LfPicker } from '../components/LfPicker';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfSwitch } from '../components/LfSwitch';
import { LfText } from '../components/LfText';
import { withdrawAccountNative } from '../lib/account-safety-native.ts';
import { openLegalDocument } from '../lib/legal-native.ts';
import { useLabels, useLocale } from '../lib/locale-native';
import { currentMobileUserId } from '../lib/mobile-api-native.ts';
import {
  loadTrustProfile,
  logoutCurrentDeviceNative,
  updateTrustProfileSettings,
} from '../lib/trust-profile-native.ts';
import { SCR_A08_LABEL } from '../screens/scr-a08-labels.ts';
import {
  createInitialProfileState,
  profileReducer,
} from '../screens/scr-a08-profile-state.ts';
import { colors, gutter, radius, size, space } from '../theme/tokens';

const RING_SIZE = size.iconButton * 2;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = space[9] + space[5];
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_STROKE = space[4] - StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: gutter.app, gap: space[7] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter.app },
  iconButton: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1 },
  trustCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.xl,
    padding: space[7],
  },
  ring: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringValue: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  stats: { flex: 1 },
  settingText: { flex: 1 },
  legalButton: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  legalLabel: { flex: 1 },
});

interface ReminderRowProps {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange(value: boolean): void;
}

function ReminderRow({ label, value, disabled, onChange }: ReminderRowProps): React.JSX.Element {
  return (
    <LfRow gap={4}>
      <LfIcon name="notifications-none" color="textSecondary" />
      <View style={styles.settingText}><LfText>{label}</LfText></View>
      <LfSwitch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </LfRow>
  );
}

/**
 * 언어 선택 행 (PO 2026-08-20: 기기 언어 자동 + 수동 전환).
 *
 * 선택지 문구는 **그 언어의 이름을 그 언어로** 적는다 — 지금 화면 언어를 못 읽는
 * 사용자가 자기 언어를 찾는 자리라, 현재 언어로 번역해 두면 정작 필요한 사람이 못 읽는다.
 */
const LOCALE_NAME: Record<Locale, string> = { ko: '한국어', en: 'English' };

function LanguageRow(): React.JSX.Element {
  const LABEL = useLabels(SCR_A08_LABEL);
  const { locale, setLocale } = useLocale();
  return (
    <LfRow gap={3}>
      {LOCALES.map((candidate) => {
        const selected = candidate === locale;
        const name = LOCALE_NAME[candidate];
        return (
          <LfButton
            key={candidate}
            grow
            // 선택 상태를 색이 아니라 문구로도 말한다. 스크린리더에는 selected 로도 전한다.
            label={selected ? LABEL.languageSelected(name) : name}
            accessibilityLabel={selected ? LABEL.languageSelected(name) : LABEL.languageSelect(name)}
            accessibilityState={{ selected }}
            variant={selected ? 'filled' : 'outlined'}
            onPress={() => setLocale(candidate)}
          />
        );
      })}
    </LfRow>
  );
}

export default function ProfileScreen(): React.JSX.Element {
  const LABEL = useLabels(SCR_A08_LABEL);
  const router = useRouter();
  const [state, dispatch] = useReducer(profileReducer, undefined, createInitialProfileState);
  const nextLoadId = useRef(0);
  const nextUpdateId = useRef(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawFailed, setWithdrawFailed] = useState(false);

  const load = useCallback(async () => {
    const loadId = ++nextLoadId.current;
    dispatch({ type: 'LOAD_STARTED', loadId });
    try {
      dispatch({ type: 'LOAD_SUCCEEDED', loadId, profile: await loadTrustProfile() });
    } catch {
      dispatch({ type: 'LOAD_FAILED', loadId });
    }
  }, []);

  // 닉네임 편집 등 다른 화면에서 바꾼 값이 돌아올 때 보이도록 포커스마다 다시 읽는다.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = useCallback(async (reminders: ReminderPreferences) => {
    const updateId = ++nextUpdateId.current;
    dispatch({ type: 'UPDATE_STARTED', updateId, reminders });
    try {
      const response = await updateTrustProfileSettings(reminders);
      dispatch({ type: 'UPDATE_SUCCEEDED', updateId, response });
    } catch {
      dispatch({ type: 'UPDATE_FAILED', updateId });
    }
  }, []);

  const chooseHour = useCallback(() => {
    if (state.saving || state.displayedReminders === null) return;
    Alert.alert(
      LABEL.reminderHourTitle,
      undefined,
      [
        ...REMINDER_HOURS.map((hour) => ({
          text: LABEL.reminderHourChoice(hour),
          onPress: () => void save({ ...state.displayedReminders!, remind_hour: hour }),
        })),
        { text: LABEL.cancel, style: 'cancel' as const },
      ],
    );
  }, [LABEL, save, state.displayedReminders, state.saving]);

  const confirmLogout = useCallback(() => {
    Alert.alert(LABEL.logoutTitle, LABEL.logoutBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.logout,
        style: 'destructive',
        onPress: async () => {
          dispatch({ type: 'LOGOUT_STARTED' });
          try {
            await logoutCurrentDeviceNative(await currentMobileUserId());
          } catch {
            dispatch({ type: 'LOGOUT_FAILED' });
          }
        },
      },
    ]);
  }, [LABEL]);

  const confirmWithdraw = useCallback((activeCount: number) => {
    setWithdrawFailed(false);
    Alert.alert(LABEL.withdrawTitle, LABEL.withdrawWarning(activeCount), [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.withdrawContinue,
        onPress: () => Alert.alert(LABEL.withdrawFinalTitle, LABEL.withdrawFinalBody, [
          { text: LABEL.cancel, style: 'cancel' },
          {
            text: LABEL.withdraw,
            style: 'destructive',
            onPress: async () => {
              setWithdrawing(true);
              try {
                await withdrawAccountNative();
              } catch {
                setWithdrawing(false);
                setWithdrawFailed(true);
              }
            },
          },
        ]),
      },
    ]);
  }, [LABEL]);

  const body = state.loading || (state.profile === null && !state.loadFailed) ? (
    <View style={styles.centered}><LfText secondary>{LABEL.loading}</LfText></View>
  ) : state.profile === null ? (
    <LfStack grow center gap={4}>
      <LfText align="center" secondary>{LABEL.loadError}</LfText>
      <LfButton
        accessibilityLabel={LABEL.retryAccessibility}
        label={LABEL.retry}
        variant="text"
        onPress={() => void load()}
      />
    </LfStack>
  ) : (
    <ScrollView contentContainerStyle={styles.content}>
      <LfRow gap={5}>
        <LfAvatar
          nickname={state.profile.nickname}
          profileImageUrl={state.profile.profile_image_url}
          accessibilityLabel={LABEL.profileImage(state.profile.nickname)}
        />
        <View style={styles.profileText}>
          <LfText variant="subtitle">{state.profile.nickname}</LfText>
          <LfText variant="caption">{LABEL.connected}</LfText>
          {/^사용자(?:[0-9a-f]{4})?$/iu.test(state.profile.nickname) && (
            <LfButton
              label={LABEL.nicknameSetup}
              variant="text"
              size="compact"
              onPress={() => router.push('/profile-nickname')}
            />
          )}
        </View>
      </LfRow>

      <View style={styles.trustCard}>
        <LfRow gap={7}>
          <View style={styles.ring}>
            <Svg
              width={RING_SIZE}
              height={RING_SIZE}
              accessibilityRole="image"
              accessibilityLabel={state.profile.keep_rate === null
                ? `${LABEL.keepRate} ${LABEL.aggregating}`
                : LABEL.keepRateAccessibility(state.profile.keep_rate)}
            >
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke={colors.surface}
                strokeWidth={RING_STROKE}
              />
              {state.profile.keep_rate !== null && (
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, state.profile.keep_rate)) / 100)}
                  rotation="-90"
                  origin={`${RING_CENTER}, ${RING_CENTER}`}
                />
              )}
            </Svg>
            <View pointerEvents="none" style={styles.ringValue}>
              <LfText variant="subtitle">
                {state.profile.keep_rate === null
                  ? LABEL.aggregating
                  : LABEL.keepRatePercent(state.profile.keep_rate)}
              </LfText>
            </View>
          </View>
          <View style={styles.stats}>
            <LfText variant="sectionTitle">{LABEL.keepRate}</LfText>
            <LfText>{`${LABEL.completed(state.profile.completed_count)} · ${LABEL.broken(state.profile.broken_count)}`}</LfText>
            <LfText variant="caption">{`${LABEL.disputed(state.profile.disputed_count)} · ${LABEL.unresolved(state.profile.unresolved_count)}`}</LfText>
            <LfText variant="caption">{LABEL.active(state.profile.active_count)}</LfText>
            <LfText variant="caption">{LABEL.excluded}</LfText>
          </View>
        </LfRow>
      </View>

      <LfText variant="sectionTitle">{LABEL.reminderTitle}</LfText>
      <LfCard>
        <LfStack gap={4}>
          {state.displayedReminders !== null && (
            <>
              <ReminderRow label={LABEL.remindD7} value={state.displayedReminders.remind_d7} disabled={state.saving} onChange={(value) => void save({ ...state.displayedReminders!, remind_d7: value })} />
              <ReminderRow label={LABEL.remindD3} value={state.displayedReminders.remind_d3} disabled={state.saving} onChange={(value) => void save({ ...state.displayedReminders!, remind_d3: value })} />
              <ReminderRow label={LABEL.remindD1} value={state.displayedReminders.remind_d1} disabled={state.saving} onChange={(value) => void save({ ...state.displayedReminders!, remind_d1: value })} />
              <ReminderRow label={LABEL.remindDday} value={state.displayedReminders.remind_dday} disabled={state.saving} onChange={(value) => void save({ ...state.displayedReminders!, remind_dday: value })} />
              <LfPicker
                accessibilityLabel={LABEL.reminderHour(state.displayedReminders.remind_hour)}
                value={LABEL.reminderHourValue(state.displayedReminders.remind_hour)}
                placeholder={LABEL.reminderHourTitle}
                disabled={state.saving}
                onPress={chooseHour}
              />
            </>
          )}
          {state.saveFailed && <LfText secondary>{LABEL.saveError}</LfText>}
        </LfStack>
      </LfCard>

      <LfText variant="sectionTitle">{LABEL.languageTitle}</LfText>
      <LfCard>
        <LanguageRow />
      </LfCard>

      <LfText variant="sectionTitle">{LABEL.legalTitle}</LfText>
      <LfCard>
        <LfStack gap={2}>
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.termsAccessibility} style={styles.legalButton} onPress={() => void openLegalDocument('TERMS')}>
            <LfIcon name="description" color="textSecondary" />
            <View style={styles.legalLabel}><LfText>{LABEL.terms}</LfText></View>
            <LfIcon name="chevron-right" color="textMuted" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.privacyAccessibility} style={styles.legalButton} onPress={() => void openLegalDocument('PRIVACY')}>
            <LfIcon name="privacy-tip" color="textSecondary" />
            <View style={styles.legalLabel}><LfText>{LABEL.privacy}</LfText></View>
            <LfIcon name="chevron-right" color="textMuted" />
          </Pressable>
        </LfStack>
      </LfCard>
      <LfDisclaimer />
      <LfCard>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LABEL.blockedUsers}
          style={styles.legalButton}
          onPress={() => router.push('/blocked-users')}
        >
          <LfIcon name="block" color="textSecondary" />
          <View style={styles.legalLabel}><LfText>{LABEL.blockedUsers}</LfText></View>
          <LfIcon name="chevron-right" color="textMuted" />
        </Pressable>
      </LfCard>
      <LfButton label={LABEL.logout} variant="danger" disabled={state.loggingOut} onPress={confirmLogout} />
      {state.logoutFailed && <LfText secondary>{LABEL.logoutError}</LfText>}
      <LfButton
        label={LABEL.withdraw}
        variant="danger"
        disabled={withdrawing}
        onPress={() => confirmWithdraw(state.profile!.active_count)}
      />
      {withdrawFailed && <LfText secondary>{LABEL.withdrawError}</LfText>}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={(
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.back} style={styles.iconButton} onPress={() => router.back()}>
            <LfIcon name="arrow-back" />
          </Pressable>
        )}
      />
      {body}
    </SafeAreaView>
  );
}
