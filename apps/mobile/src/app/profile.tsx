import {
  LOCALES,
  REMINDER_HOURS,
  type ReminderPreferences,
  type SlotStatusResponse,
} from '@littlefinger/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { backOrHome } from '../lib/back-or-home.ts';
import { LfAdSlot } from '../components/LfAdSlot';
import { LfAppBar } from '../components/LfAppBar';
import { LfAvatar } from '../components/LfAvatar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfDisclaimer } from '../components/LfDisclaimer';
import { LfIcon } from '../components/LfIcon';
import { LfPicker } from '../components/LfPicker';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfSegmented } from '../components/LfSegmented';
import { LfStatusTile } from '../components/LfStatusTile';
import { LfSwitch } from '../components/LfSwitch';
import { LfText } from '../components/LfText';
import { LfTrustRing } from '../components/LfTrustRing';
import { SlotPaywallSheet } from '../components/slot-paywall-sheet.tsx';
import { withdrawAccountNative } from '../lib/account-safety-native.ts';
import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { privacyOptionsRequired, showAdsPrivacyOptions } from '../lib/ads-consent-native.ts';
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
import { APP_VERSION_LABEL } from '../screens/app-version-labels.ts';
import { SLOT_LABEL } from '../screens/slot-labels.ts';
import { MOBILE_CHROME_LABEL } from '../screens/mobile-chrome-labels.ts';
import {
  createInitialProfileState,
  profileReducer,
} from '../screens/scr-a08-profile-state.ts';
import { colors, border, gutter, radius, size, space } from '../theme/tokens';

/** README 본문 위 22 · 설정 행 아이콘 18 · 아바타 옐로 그림자 3 — 토큰 없음, ADR 0020 예외 */
const BODY_TOP = 22;
const SETTINGS_ICON = 18;
const AVATAR_SHADOW = 3;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  // 본문 22 20 20 16 · 블록 간 14
  content: {
    paddingTop: BODY_TOP,
    paddingRight: space[8],
    paddingBottom: space[8],
    paddingLeft: gutter.app,
    gap: space[6],
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter.app },
  profileText: { flex: 1, minWidth: 0 },
  avatarShadow: {
    borderRadius: radius.pill,
    boxShadow: [{ offsetX: AVATAR_SHADOW, offsetY: AVATAR_SHADOW, blurRadius: 0, spreadDistance: 0, color: colors.primaryContainer }],
  },
  stats: { flex: 1, minWidth: 0 },
  settingText: { flex: 1, minWidth: 0 },
  // 설정 행 48h · 행 사이 점선
  settingsRow: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  divided: { borderTopWidth: border.dashed, borderTopColor: colors.outline, borderStyle: 'dashed' },
  legalLabel: { flex: 1, minWidth: 0 },
});

interface ReminderRowProps {
  label: string;
  value: boolean;
  disabled: boolean;
  divided?: boolean;
  onChange(value: boolean): void;
}

function ReminderRow({ label, value, disabled, divided = false, onChange }: ReminderRowProps): React.JSX.Element {
  return (
    <View style={[styles.settingsRow, divided && styles.divided]}>
      <LfIcon name="notifications" size={SETTINGS_ICON} />
      <View style={styles.settingText}><LfText variant="label">{label}</LfText></View>
      <LfSwitch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </View>
  );
}

function LanguageRow(): React.JSX.Element {
  const LABEL = useLabels(SCR_A08_LABEL);
  const { locale, setLocale } = useLocale();
  return (
    <LfSegmented
      accessibilityLabel={LABEL.languageTitle}
      // 선택 상태를 색이 아니라 문구로도 말한다. 스크린리더에는 selected 로도 전한다.
      items={LOCALES.map((candidate) => {
        const selected = candidate === locale;
        const name = LABEL.languageNames[candidate];
        return {
          key: candidate,
          label: selected ? LABEL.languageSelected(name) : name,
          accessibilityLabel: selected ? LABEL.languageSelected(name) : LABEL.languageSelect(name),
        };
      })}
      value={locale}
      onChange={setLocale}
    />
  );
}

export default function ProfileScreen(): React.JSX.Element {
  const LABEL = useLabels(SCR_A08_LABEL);
  const SLOT = useLabels(SLOT_LABEL);
  const VERSION = useLabels(APP_VERSION_LABEL);
  const CHROME = useLabels(MOBILE_CHROME_LABEL);
  const router = useRouter();
  const [state, dispatch] = useReducer(profileReducer, undefined, createInitialProfileState);
  const nextLoadId = useRef(0);
  const nextUpdateId = useRef(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawFailed, setWithdrawFailed] = useState(false);
  const [legalDocumentFailed, setLegalDocumentFailed] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyFailed, setPrivacyFailed] = useState(false);
  const privacyOpening = useRef(false);
  // 슬롯 현황은 보조 정보다 — 조회 실패가 프로필 화면을 막지 않도록 profile 상태와 분리한다.
  const [slot, setSlot] = useState<SlotStatusResponse | null>(null);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  // F-12 확대(PO 2026-08-24): 프로필 하단 1구좌. 끄면 렌더 자체를 하지 않는다.
  const [adsEnabled, setAdsEnabled] = useState(false);

  function handleBack(): void {
    backOrHome(router);
  }

  useFocusEffect(useCallback(() => {
    let active = true;
    void privacyOptionsRequired().then((required) => {
      if (active) setPrivacyRequired(required);
    }).catch(() => {
      // 재조회 실패로 기존 진입점을 없애지 않는다. 다음 포커스에서 다시 확인한다.
    });
    return () => { active = false; };
  }, []));

  async function handleAdsPrivacy(): Promise<void> {
    if (privacyOpening.current) return;
    privacyOpening.current = true;
    setPrivacyBusy(true);
    setPrivacyFailed(false);
    try {
      await showAdsPrivacyOptions();
      setPrivacyRequired(await privacyOptionsRequired());
    } catch {
      setPrivacyFailed(true);
    } finally {
      privacyOpening.current = false;
      setPrivacyBusy(false);
    }
  }

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
        <View style={styles.avatarShadow}>
          <LfAvatar
            nickname={state.profile.nickname}
            profileImageUrl={state.profile.profile_image_url}
            accessibilityLabel={LABEL.profileImage(state.profile.nickname)}
            size="xl"
          />
        </View>
        <View style={styles.profileText}>
          <LfText variant="cardTitle">{state.profile.nickname}</LfText>
          <LfText variant="meta">{LABEL.connected}</LfText>
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

      <LfCard>
        <LfRow gap={7}>
          <LfTrustRing rate={state.profile.keep_rate} />
          <View style={styles.stats}>
            <LfText variant="eyebrow">{LABEL.keepRate}</LfText>
            <LfText variant="bodyStrong">{`${LABEL.completed(state.profile.completed_count)} · ${LABEL.broken(state.profile.broken_count)}`}</LfText>
            <LfText variant="micro">{`${LABEL.disputed(state.profile.disputed_count)} · ${LABEL.unresolved(state.profile.unresolved_count)}`}</LfText>
            <LfText variant="micro">{LABEL.active(state.profile.active_count)}</LfText>
            <LfText variant="micro">{LABEL.excluded}</LfText>
          </View>
        </LfRow>
      </LfCard>

      {slot !== null && (
        <>
          <LfText variant="eyebrow">{SLOT.profileTitle}</LfText>
          <LfCard shadow={false}>
            <LfRow gap={5}>
              <LfStatusTile icon="bookmark" tone="sky" />
              <View style={styles.settingText}>
                <LfText variant="label" accessibilityLabel={SLOT.usageAccessibility(slot.used, slot.capacity)}>
                  {SLOT.usage(slot.used, slot.capacity)}
                </LfText>
                <LfText variant="meta">{SLOT.profileExplain}</LfText>
              </View>
              <LfButton
                label={SLOT.profileAdd}
                accessibilityLabel={SLOT.profileAddAccessibility}
                variant="tonal"
                onPress={() => setSlotSheetOpen(true)}
              />
            </LfRow>
          </LfCard>
        </>
      )}

      <LfText variant="eyebrow">{LABEL.reminderTitle}</LfText>
      <LfCard shadow={false}>
        <LfStack gap={2}>
          {state.displayedReminders !== null && (
            <>
              <ReminderRow label={LABEL.remindD7} value={state.displayedReminders.remind_d7} disabled={state.saving} onChange={(value) => void save({ ...state.displayedReminders!, remind_d7: value })} />
              <ReminderRow label={LABEL.remindD3} value={state.displayedReminders.remind_d3} disabled={state.saving} divided onChange={(value) => void save({ ...state.displayedReminders!, remind_d3: value })} />
              <ReminderRow label={LABEL.remindD1} value={state.displayedReminders.remind_d1} disabled={state.saving} divided onChange={(value) => void save({ ...state.displayedReminders!, remind_d1: value })} />
              <ReminderRow label={LABEL.remindDday} value={state.displayedReminders.remind_dday} disabled={state.saving} divided onChange={(value) => void save({ ...state.displayedReminders!, remind_dday: value })} />
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

      <LfText variant="eyebrow">{LABEL.languageTitle}</LfText>
      <LanguageRow />

      <LfCard shadow={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHROME.history}
          style={styles.settingsRow}
          onPress={() => router.push('/history')}
        >
          <LfIcon name="history" size={SETTINGS_ICON} />
          <View style={styles.legalLabel}><LfText variant="label">{CHROME.history}</LfText></View>
          <LfIcon name="arrow_forward" size={SETTINGS_ICON} />
        </Pressable>
      </LfCard>

      <LfText variant="eyebrow">{LABEL.legalTitle}</LfText>
      <LfCard shadow={false}>
        <LfStack>
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.termsAccessibility} style={styles.settingsRow} onPress={() => void handleLegalDocument('TERMS')}>
            <LfIcon name="description" size={SETTINGS_ICON} />
            <View style={styles.legalLabel}><LfText variant="label">{LABEL.terms}</LfText></View>
            <LfIcon name="arrow_forward" size={SETTINGS_ICON} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={LABEL.privacyAccessibility} style={[styles.settingsRow, styles.divided]} onPress={() => void handleLegalDocument('PRIVACY')}>
            <LfIcon name="privacy_tip" size={SETTINGS_ICON} />
            <View style={styles.legalLabel}><LfText variant="label">{LABEL.privacy}</LfText></View>
            <LfIcon name="arrow_forward" size={SETTINGS_ICON} />
          </Pressable>
          {legalDocumentFailed && <LfText variant="error">{LABEL.legalDocumentError}</LfText>}
          {privacyRequired && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={LABEL.adsPrivacy}
              accessibilityState={{ disabled: privacyBusy, busy: privacyBusy }}
              disabled={privacyBusy}
              style={[styles.settingsRow, styles.divided]}
              onPress={() => void handleAdsPrivacy()}
            >
              <LfIcon name="privacy_tip" size={SETTINGS_ICON} />
              <View style={styles.legalLabel}><LfText variant="label">{LABEL.adsPrivacy}</LfText></View>
              <LfIcon name="arrow_forward" size={SETTINGS_ICON} />
            </Pressable>
          )}
          {privacyFailed && <LfText variant="error">{LABEL.adsPrivacyError}</LfText>}
        </LfStack>
      </LfCard>
      <LfDisclaimer />
      <LfCard shadow={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LABEL.blockedUsers}
          style={styles.settingsRow}
          onPress={() => router.push('/blocked-users')}
        >
          <LfIcon name="block" size={SETTINGS_ICON} />
          <View style={styles.legalLabel}><LfText variant="label">{LABEL.blockedUsers}</LfText></View>
          <LfIcon name="arrow_forward" size={SETTINGS_ICON} />
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
      <LfText variant="meta" align="center" testID="app-version">
        {VERSION.version(nativeApplicationVersion ?? VERSION.unavailable, nativeBuildVersion ?? VERSION.unavailable)}
      </LfText>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading="back"
        leadingAccessibilityLabel={CHROME.back}
        onLeadingPress={handleBack}
      />
      <View style={styles.body}>{body}</View>
      <SlotPaywallSheet
        visible={slotSheetOpen}
        reason="manage"
        onClose={() => setSlotSheetOpen(false)}
        onPurchased={setSlot}
      />
    </SafeAreaView>
  );
}
