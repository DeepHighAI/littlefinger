import Constants from 'expo-constants';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import mobileAds, {
  AdsConsent,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  TestIds,
} from 'react-native-google-mobile-ads';

import { LfChip } from '../components/LfChip';
import { LfRow } from '../components/LfRow';
import { LfText } from '../components/LfText';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, radius, size, space, type as typography, weight } from '../theme/tokens';
import { createNativeAdLoader } from './admob-loader.ts';

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
    fontFamily: brandFontFamily(weight.bold),
    fontSize: typography.bodyLg,
    fontWeight: weight.bold,
  },
});

const load = createNativeAdLoader<NativeAd>({
  async gatherConsent() {
    await AdsConsent.gatherConsent();
  },
  async getConsentInfo() {
    return await AdsConsent.getConsentInfo();
  },
  async initialize() {
    await mobileAds().initialize();
  },
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

export async function loadNativeAd(): Promise<LittlefingerNativeAd | null> {
  return await load(configuredUnitId());
}

export function destroyNativeAd(ad: LittlefingerNativeAd): void {
  ad.destroy();
}

export function NativeAdCard({ ad }: { ad: LittlefingerNativeAd }): React.JSX.Element {
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
            <LfText variant="sectionTitle">{ad.headline}</LfText>
          </NativeAsset>
          {ad.advertiser !== null && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <LfText secondary>{ad.advertiser}</LfText>
            </NativeAsset>
          )}
        </View>
        <LfChip label={SCR_A02_LABEL.advertisement} tone="neutral" />
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
