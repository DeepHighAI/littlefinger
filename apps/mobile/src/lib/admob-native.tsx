import Constants from 'expo-constants';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  BannerAd,
  BannerAdSize,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { REWARD_SHOW_TIMEOUT_MS, type RewardAction } from '@littlefinger/shared';

import { LfChip } from '../components/LfChip';
import { LfRow } from '../components/LfRow';
import { LfText } from '../components/LfText';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { textFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type as typography, weight } from '../theme/tokens';
import { createAdsGate, createNativeAdLoader } from './admob-loader.ts';
import { gatherAdsConsent, getAdsConsentSnapshot, subscribeAdsConsent } from './ads-consent-native.ts';
import { useLabels } from './locale-native';

export type LittlefingerNativeAd = NativeAd;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: space[5],
    padding: space[7],
    paddingTop: space[9],
  },
  copy: { flex: 1 },
  icon: {
    borderRadius: radius.sm,
    height: size.touchMin,
    width: size.touchMin,
  },
  cta: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: size.touchMin,
    paddingHorizontal: space[8],
  },
  ctaText: {
    color: colors.onPrimary,
    fontFamily: textFontFamily(weight.bold),
    fontSize: typography.bodyLg,
    fontWeight: weight.bold,
  },
});

// 배너·네이티브·보상형이 같은 관문을 지난다 — 동의 없이 SDK 를 초기화하는 경로가 하나도 없어야 한다.
const prepareAds = createAdsGate({
  async gatherConsent() {
    await gatherAdsConsent();
  },
  async getConsentInfo() {
    const before = getAdsConsentSnapshot();
    const info = await AdsConsent.getConsentInfo();
    return { canRequestAds: info.canRequestAds && !before.suspended && before === getAdsConsentSnapshot() };
  },
  async initialize() {
    await mobileAds().initialize();
  },
});

export async function ensureAdsReady(): Promise<boolean> {
  const before = getAdsConsentSnapshot();
  if (before.suspended) return false;
  const ready = await prepareAds();
  return ready && before === getAdsConsentSnapshot();
}

const load = createNativeAdLoader<NativeAd>({
  ensureReady: ensureAdsReady,
  async createAd(unitId) {
    return await NativeAd.createForAdRequest(unitId);
  },
});

function configuredUnitId(): string {
  const value = Constants.expoConfig?.extra?.['admob'];
  if (typeof value === 'object' && value !== null && 'nativeUnitId' in value) {
    const unitId = value.nativeUnitId;
    if (typeof unitId === 'string' && unitId.length > 0) return unitId;
  }
  return TestIds.NATIVE;
}

function admobExtra(): Record<string, unknown> {
  const value = Constants.expoConfig?.extra?.['admob'];
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function configuredExtraUnitId(key: string, fallback: string): string {
  const value = admobExtra()[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function bannerUnitId(): string {
  return configuredExtraUnitId('bannerUnitId', TestIds.ADAPTIVE_BANNER);
}

export function rewardedUnitId(action: RewardAction): string {
  if (action === 'DURATION_30D') {
    return configuredExtraUnitId('rewardedDurationUnitId', TestIds.REWARDED);
  }
  if (action === 'RETENTION_30D') {
    return configuredExtraUnitId('rewardedRetentionUnitId', TestIds.REWARDED);
  }
  return configuredExtraUnitId('rewardedWitnessUnitId', TestIds.REWARDED);
}

export type RewardedAdResult = 'EARNED' | 'DISMISSED' | 'UNAVAILABLE';

export async function showRewardedAd(input: {
  action: RewardAction;
  opaqueUserId: string;
  intentId: string;
}): Promise<RewardedAdResult> {
  try {
    if (!await ensureAdsReady()) return 'UNAVAILABLE';
    return await new Promise<RewardedAdResult>((resolve) => {
      const ad = RewardedAd.createForAdRequest(rewardedUnitId(input.action), {
        serverSideVerificationOptions: {
          userId: input.opaqueUserId,
          customData: input.intentId,
        },
      });
      let earned = false;
      let settled = false;
      // SDK 가 LOADED 도 ERROR 도 내지 않으면 화면이 영원히 '광고 준비 중'에 머문다 — 시간이 지나면
      // '지금은 볼 수 없음'으로 접는다. 시청 시간은 재지 않으므로 LOADED 에서 타이머를 푼다.
      const timeout = setTimeout(() => finish('UNAVAILABLE'), REWARD_SHOW_TIMEOUT_MS);
      const subscriptions = [
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          clearTimeout(timeout);
          ad.show().catch(() => finish('UNAVAILABLE'));
        }),
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
        ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned ? 'EARNED' : 'DISMISSED')),
        ad.addAdEventListener(AdEventType.ERROR, () => finish('UNAVAILABLE')),
        subscribeAdsConsent(() => finish('UNAVAILABLE')),
      ];
      function finish(result: RewardedAdResult): void {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        for (const unsubscribe of subscriptions) unsubscribe();
        resolve(result);
      }
      ad.load();
    });
  } catch {
    return 'UNAVAILABLE';
  }
}

export function AdaptiveBanner({
  onLoaded,
  onFailed,
}: {
  onLoaded(): void;
  onFailed(): void;
}): React.JSX.Element {
  return (
    <BannerAd
      unitId={bannerUnitId()}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdLoaded={onLoaded}
      onAdFailedToLoad={onFailed}
    />
  );
}

export async function loadNativeAd(): Promise<LittlefingerNativeAd | null> {
  return await load(configuredUnitId());
}

export function destroyNativeAd(ad: LittlefingerNativeAd): void {
  ad.destroy();
}

export function NativeAdCard({ ad }: { ad: LittlefingerNativeAd }): React.JSX.Element {
  const LABEL = useLabels(SCR_A02_LABEL);
  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <LfRow gap={4}>
        {ad.icon !== null && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.copy}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <LfText variant="eyebrow">{ad.headline}</LfText>
          </NativeAsset>
          {ad.advertiser !== null && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <LfText secondary>{ad.advertiser}</LfText>
            </NativeAsset>
          )}
        </View>
        <LfChip label={LABEL.advertisement} tone="paper" kind="meta" />
      </LfRow>
      <NativeAsset assetType={NativeAssetType.BODY}>
        <LfText secondary>{ad.body}</LfText>
      </NativeAsset>
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ad.callToAction}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{ad.callToAction}</Text>
        </Pressable>
      </NativeAsset>
    </NativeAdView>
  );
}
