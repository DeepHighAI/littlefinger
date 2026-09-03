import type { Localized } from '@littlefinger/shared';

/**
 * 공개 홈(/) — 로그인·토큰 없이 앱의 목적을 설명하는 페이지. Google OAuth 브랜드 인증이
 * "홈페이지에 앱 목적 설명, 로그인 화면이 먼저 보이지 않을 것, 동의 화면 앱 이름과 일치"를
 * 요구한다(2026-09-03). 문구는 Play 등록정보(`docs/setup/play-store-listing.md` §1-3·§1-4)의
 * 승인본에서 가져왔고, §8-3 문구 가드(계약·서명·법적·효력·공증·증거·판결)를 지킨다.
 * SCR-ID 가 없어 파일명이 하는 일을 말한다(account-deletion 과 같은 규칙).
 */

const ko = {
  name: '리틀핑거',
  tagline: '둘이 지키는 약속 기록',
  motto: '새끼손가락 걸고, 약속!',
  purpose: [
    '리틀핑거는 두 사람이 함께 정한 약속을 하나의 기록으로 남기고, 종료일까지 잊지 않게 챙겨주는 상호 약속 관리 서비스예요.',
    '약속을 만드는 사람은 Android 앱을 쓰고, 상대는 카카오톡으로 받은 링크에서 앱 설치 없이 내용을 확인하고 승인해요.',
  ],
  howTitle: '이렇게 사용해요',
  how: [
    '약속 작성 — 약속 내용, 지킬 사람, 종료일, 보상과 벌칙까지 적어 두면 나중에 말이 엇갈리지 않아요.',
    '카톡으로 초대 — 링크 하나면 끝. 상대는 앱을 설치하지 않아도, 아이폰에서도 웹으로 열어 승인할 수 있어요.',
    '함께 확정 — 두 사람이 모두 승인해야 약속이 시작돼요. 확정된 약속 기록은 그대로 보관됩니다.',
    '리마인드 — D-7 / D-3 / D-1 / 당일에 알려드려요.',
    '이행 확인 — 종료일이 되면 두 사람에게 "약속 지켜졌나요?" 하고 물어봐요.',
    '증인 — 친구를 증인으로 부르면 두 사람의 약속을 옆에서 확인해 줘요.',
    '약속 지킴율 — 내가 지키기로 한 약속을 얼마나 지켰는지 프로필에 쌓여요.',
  ],
  principlesTitle: '리틀핑거가 지키는 원칙',
  principles: [
    '두 사람이 함께 정합니다. 내용을 바꾸는 것도, 약속을 그만두는 것도 양쪽이 동의해야 해요.',
    '확정된 기록은 바뀌지 않습니다. 바꾸고 싶으면 새 버전으로 다시 합의해요.',
    '앱은 판정하지 않습니다. 서로 답이 엇갈리면 두 사람의 이야기를 나란히 기록만 해요.',
    '벌칙은 적어 두는 기록일 뿐입니다. 리틀핑거는 돈을 맡아 두거나 대신 받아 주지 않아요.',
  ],
  linksTitle: '안내',
  playLink: 'Google Play에서 받기',
  privacyLink: '개인정보처리방침',
  termsLink: '이용약관',
  accountDeletionLink: '계정 삭제 안내',
  contact: '문의: task@deephigh.ai',
  company: '주식회사 딥하이',
};

const en = {
  name: 'Littlefinger',
  tagline: 'The promises you two keep',
  motto: "Pinky swear, it's a promise!",
  purpose: [
    'Littlefinger keeps the promise two people made together as one record and looks after it until the end date.',
    'The person who writes the promise uses the Android app; the other person opens a KakaoTalk link and approves on the web, with nothing to install.',
  ],
  howTitle: 'How it works',
  how: [
    'Write it down — the promise, who keeps it, the end date, the reward and the forfeit. Nothing is left to memory.',
    'Invite by KakaoTalk — one link. The other person approves on the web, with nothing to install, iPhone included.',
    'Confirm together — the promise starts only once you both approve, and the confirmed record stays as it is.',
    'Reminders — D-7 / D-3 / D-1 and the day itself.',
    'Check in — on the end date you both answer "was it kept?".',
    'Witnesses — bring a friend in to look on and confirm what you agreed.',
    'Keep rate — your profile builds up how many of your own promises you kept.',
  ],
  principlesTitle: 'What Littlefinger will not do',
  principles: [
    'Nothing moves without both of you. Edits and cancellations need both approvals.',
    'A confirmed record is never rewritten. Changing it means agreeing on a new version.',
    'The app never decides who is right. If your answers differ, both sides are recorded next to each other.',
    'A forfeit is text you wrote down, nothing more. Littlefinger never holds or collects money.',
  ],
  linksTitle: 'Links',
  playLink: 'Get it on Google Play',
  privacyLink: 'Privacy Policy',
  termsLink: 'Terms of Service',
  accountDeletionLink: 'Account deletion',
  contact: 'Support: task@deephigh.ai',
  company: 'DeepHigh Co., Ltd.',
} satisfies typeof ko;

export const HOME_LABEL: Localized<typeof ko> = { ko, en };
