import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

/** 카카오 말풍선 마크 — 공유 버튼(A04) 라벨 옆 18. 갤러리 `.lf-btn--kakao > svg` 와 같은 경로 */
const KAKAO_MARK_SIZE = 18;

export function KakaoMark(): React.JSX.Element {
  return (
    <Svg width={KAKAO_MARK_SIZE} height={KAKAO_MARK_SIZE} viewBox="0 0 24 24" testID="kakao-mark">
      <Path
        fill={colors.onKakao}
        d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.6 21c-.1.4.3.7.6.5l4.1-2.7c.5.1 1.1.1 1.7.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"
      />
    </Svg>
  );
}
