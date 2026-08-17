import { View } from 'react-native';

import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfFieldProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string | undefined;
  children: React.ReactNode;
}

export function LfField({
  label,
  required = false,
  optional = false,
  error,
  children,
}: LfFieldProps): React.JSX.Element {
  const suffix = required ? ' · 필수' : optional ? ' · 선택' : '';

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
