import { ICON_CODEPOINT, type IconName } from './icon-codepoints.ts';

/**
 * 아이콘은 언제나 이 컴포넌트를 거친다 — 화면은 아이콘을 직접 그리지 않는다
 * (CLAUDE.md §5-4 가 앱 쪽에 요구하는 규칙과 같다. 교체 지점을 한 파일에 둔다).
 *
 * 리가처('link_off')가 아니라 코드포인트를 쓴다. 리가처를 남기려면 폰트 서브셋이 사실상
 * 불가능하고(아이콘 이름이 a-z·_ 뿐이라 liga 클로저가 전량을 끌고 온다: 실측 5220 KB →
 * 4655 KB), 폰트가 늦게 오면 화면에 'link_off' 라는 **낱말**이 그대로 보인다.
 */
export function LfIcon({ name, className }: { name: IconName; className?: string }): React.JSX.Element {
  return (
    <span
      className={className ? `material-symbols-rounded ${className}` : 'material-symbols-rounded'}
      // 아이콘은 언제나 옆의 글자를 되풀이한다. 상태를 색·모양만으로 전달하지 않는다는
      // 접근성 원칙(§8)상 의미는 항상 글자가 지고, 아이콘은 장식이다.
      aria-hidden="true"
    >
      {String.fromCodePoint(ICON_CODEPOINT[name])}
    </span>
  );
}

export type { IconName };
