import {
  LOCALES,
  REMINDER_HOURS,
  type Locale,
  type ReminderPreferences,
  type SlotStatusResponse,
} from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAdSlot } from '../components/LfAdSlot';
import { LfAppBar } from '../components/LfAppBar';
import { LfAvatar } from '../components/LfAvatar';
import { LfBottomNav } from '../components/LfBottomNav';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfDisclaimer } from '../components/LfDisclaimer';
import { LfIcon } from '../components/LfIcon';
import { LfPicker } from '../components/LfPicker';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfSwitch } from '../components/LfSwitch';
import { LfText } from '../components/LfText';
import { LfTrustRing } from '../components/LfTrustRing';
import { SlotPaywallSheet } from '../components/slot-paywall-sheet.tsx';
import { withdrawAccountNative } from '../lib/account-safety-native.ts';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { openLegalDocument } from '../lib/legal-native.ts';
import { useLabels, useLocale } from '../lib/locale-native';
import { currentMobileUserId } from '../lib/mobile-api-native.ts';
import { loadSlotStatus } from '../lib/slots-native.ts';
import {
  loadTrustProfile,
  logoutCurrentDeviceNative,
  updateTrustProfileSettings,
} from '../lib/trust-profile-native.ts';
import { SCR_A08_LABEL } from '../screens/scr-a08-labels.ts';
import { SLOT_LABEL } from '../screens/slot-labels.ts';
import {
  createInitialProfileState,
  profileReducer,
} from '../screens/scr-a08-profile-state.ts';
import { colors, gutter, radius, size, space } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  content: { padding: gutter.app, paddingBottom: space[9], gap: space[7] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter.app },
  profileText: { flex: 1 },
  trustCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.xl,
    padding: space[7],
  },
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
      <LfIcon name="notifications" color="record" />
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
  const SLOT = useLabels(SLOT_LABEL);
  const router = useRouter();
  const [state, dispatch] = useReducer(profileReducer, undefined, createInitialProfileState);
  const nextLoadId = useRef(0);
  const nextUpdateId = useRef(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawFailed, setWithdrawFailed] = useState(false);
  const [legalDocumentFailed, setLegalDocumentFailed] = useState(false);
  // 슬롯 현황은 보조 정보다 — 조회 실패가 프로필 화면을 막지 않도록 profile 상태와 분리한다.
  const [slot, setSlot] = useState<SlotStatusResponse | null>(null);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  // F-12 확대(PO 2026-08-24): 프로필 하단 1구좌. 끄면 렌더 자체를 하지 않는다.
  const [adsEnabled, setAdsEnabled] = useState(false);

  async function handleLegalDocument(kind: 'TERMS' | 'PRIVACY'): Promise<void> {
    setLegalDocumentFailed(false);
    try {
      await openLegalDocument(kind);
    } catch {
      setLegalDocumentFailed(true);
    }
  }

  useEffect(() => {
    let active = true;
    void readAdsEnabled().then((enabled) => {
      if (active) setAdsEnabled(enabled);
    });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    const loadId = ++nextLoadId.current;
    dispatch({ type: 'LOAD_STARTED', loadId });
    try {
      dispatch({ type: 'LOAD_SUCCEEDED', loadId, profile: await loadTrustProfile() });
    } catch {
      dispatch({ type: 'LOAD_FAILED', loadId });
    }
  }, []);

  const loadSlot = useCallback(async () => {
    try {
      setSlot(await loadSlotStatus());
    } catch {
      // 실패하면 행을 숨긴다 — 결제 진입점 하나가 빠질 뿐 프로필은 정상이어야 한다.
      setSlot(null);
    }
  }, []);

  // 닉네임 편집 등 다른 화면에서 바꾼 값이 돌아올 때 보이도록 포커스마다 다시 읽는다.
  useFocusEffect(useCallback(() => { void load(); void loadSlot(); }, [load, loadSlot]));

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
      <LfText variant="error" align="center">{LABEL.loadError}</LfText>
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
          <LfTrustRing rate={state.profile.keep_rate} />
          <View style={styles.stats}>
            <LfText variant="sectionTitle">{LABEL.keepRate}</LfText>
            <LfText>{`${LABEL.completed(state.profile.completed_count)} · ${LABEL.broken(state.profile.broken_count)}`}</LfText>
            <LfText variant="caption">{`${LABEL.disputed(state.profile.disputed_count)} · ${LABEL.unresolved(state.profile.unresolved_count)}`}</LfText>
            <LfText variant="caption">{LABEL.active(state.profile.active_count)}</LfText>
            <LfText variant="caption">{LABEL.excluded}</LfText>
          </View>
        </LfRow>
      </View>

      {slot !== null && (
        <>
          <LfText variant="sectionTitle">{SLOT.profileTitle}</LfText>
          <LfCard>
            <LfRow gap={4}>
              <LfIcon name="bookmark" color="record" />
              <View style={styles.settingText}>
                <LfText accessibilityLabel={SLOT.usageAccessibility(slot.used, slot.capacity)}>
                  {SLOT.usage(slot.used, slot.capacity)}
                </LfText>
                <LfText variant="caption">{SLOT.profileExplain}</LfText>
              </View>
              <LfButton
                label={SLOT.profileAdd}
                accessibilityLabel={SLOT.profileAddAccessibility}
                variant="tonal"
                size="compact"
                onPress={() => setSlotSheetOpen(true)}
              />
            </LfRow>
          </LfCard>
        </>
      )}

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
          {state.saveFailed && <LfText variant="error">{LABEL.saveError}</LfText>}
        </LfStack>
      </LfCard>

      <LfText variant="sectionTitle">{LABEL.languageTitle}</LfText>
      <LfCard>
        <LanguageRow />
      </LfCard>

      <LfText variant="sectionTitle">{LABEL.legalTitle}</LfText>
      <LfCard>
        <LfStack gap={2}>
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.termsAccessibility} style={styles.legalButton} onPress={() => void handleLegalDocument('TERMS')}>
            <LfIcon name="description" color="record" />
            <View style={styles.legalLabel}><LfText>{LABEL.terms}</LfText></View>
            <LfIcon name="arrow_forward" color="textMuted" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.privacyAccessibility} style={styles.legalButton} onPress={() => void handleLegalDocument('PRIVACY')}>
            <LfIcon name="privacy_tip" color="record" />
            <View style={styles.legalLabel}><LfText>{LABEL.privacy}</LfText></View>
            <LfIcon name="arrow_forward" color="textMuted" />
          </Pressable>
          {legalDocumentFailed && <LfText variant="error">{LABEL.legalDocumentError}</LfText>}
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
          <LfIcon name="block" color="record" />
          <View style={styles.legalLabel}><LfText>{LABEL.blockedUsers}</LfText></View>
          <LfIcon name="arrow_forward" color="textMuted" />
        </Pressable>
      </LfCard>
      <LfButton label={LABEL.logout} variant="danger" disabled={state.loggingOut} onPress={confirmLogout} />
      {state.logoutFailed && <LfText variant="error">{LABEL.logoutError}</LfText>}
      <LfButton
        label={LABEL.withdraw}
        variant="danger"
        disabled={withdrawing}
        onPress={() => confirmWithdraw(state.profile!.active_count)}
      />
      {withdrawFailed && <LfText variant="error">{LABEL.withdrawError}</LfText>}
      <LfAdSlot enabled={adsEnabled} />
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <LfAppBar title={LABEL.title} />
      <View style={styles.body}>{body}</View>
      <SlotPaywallSheet
        visible={slotSheetOpen}
        reason="manage"
        onClose={() => setSlotSheetOpen(false)}
        onPurchased={setSlot}
      />
      <LfBottomNav
        active="profile"
        onHomePress={() => router.replace('/home')}
        onCreatePress={() => router.push('/promise/edit')}
        onProfilePress={() => undefined}
      />
    </SafeAreaView>
  );
}
