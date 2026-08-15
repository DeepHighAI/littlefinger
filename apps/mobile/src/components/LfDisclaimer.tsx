import { LEGAL_DISCLAIMER } from '@littlefinger/shared';
import type { TextProps } from 'react-native';

import { LfText } from './LfText';

export type LfDisclaimerProps = Omit<TextProps, 'children' | 'style'>;

export function LfDisclaimer(props: LfDisclaimerProps): React.JSX.Element {
  return (
    <LfText {...props} variant="disclaimer">
      {LEGAL_DISCLAIMER}
    </LfText>
  );
}
