import type { Localized } from '@littlefinger/shared';
import { View } from 'react-native';

import { useLabels } from '../lib/locale-native';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfFieldProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string | undefined;
  children: React.ReactNode;
}

// 필수/선택 접미는 모든 입력 화면이 공유하는 문구라 화면 카탈로그가 아니라 여기 산다.
const SUFFIX_LABEL: Localized<{ required: string; optional: string }> = {
  ko: { required: ' · 필수', optional: ' · 선택' },
  en: { required: ' · Required', optional: ' · Optional' },
};

export function LfField({
  label,
  required = false,
  optional = false,
  error,
  children,
}: LfFieldProps): React.JSX.Element {
  const SUFFIX = useLabels(SUFFIX_LABEL);
  const suffix = required ? SUFFIX.required : optional ? SUFFIX.optional : '';

  return (
    <View>
      <LfStack gap={3}>
        <LfText variant="sectionTitle">
          {label}
          {suffix}
        </LfText>
        {children}
        {error !== undefined && (
          <LfText accessibilityRole="alert" accessibilityLiveRegion="polite" variant="caption">
            {error}
          </LfText>
        )}
      </LfStack>
    </View>
  );
}
