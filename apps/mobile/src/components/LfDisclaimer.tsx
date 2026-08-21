import { LEGAL_DISCLAIMER_BY_LOCALE } from '@littlefinger/shared';
import type { TextProps } from 'react-native';

import { useLabels } from '../lib/locale-native';
import { LfText } from './LfText';

export type LfDisclaimerProps = Omit<TextProps, 'children' | 'style'>;

/**
 * 법적 고지. 문구는 **상수 그대로** 렌더하고 prop 으로 받지 않는다(CLAUDE.md §8-2).
 * ko 는 verbatim 불변, en 은 법무 검토 전 DRAFT — 로케일 선택만 여기서 한다.
 */
export function LfDisclaimer(props: LfDisclaimerProps): React.JSX.Element {
  const disclaimer = useLabels(LEGAL_DISCLAIMER_BY_LOCALE);
  return (
    <LfText {...props} variant="disclaimer">
      {disclaimer}
    </LfText>
  );
}
