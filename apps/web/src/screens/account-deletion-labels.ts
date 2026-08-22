import type { Localized } from '@littlefinger/shared';

/**
 * 계정 삭제 안내(/account-deletion) — Google Play 데이터 보안 양식이 요구하는
 * "웹에서 접근 가능한 계정 삭제 경로"다. SCR-ID 가 없어 파일명이 하는 일을 말한다
 * (response-complete 와 같은 규칙).
 */

const ko = {
  title: '계정 삭제 안내',
  intro:
    '리틀핑거 계정과 개인정보를 삭제하는 방법을 안내합니다. 삭제는 앱에서 직접 할 수 있고, 앱을 사용할 수 없는 경우 이메일로 요청할 수 있습니다.',
  sections: [
    {
      title: '앱에서 직접 삭제',
      paragraphs: [
        '리틀핑거 앱을 열고 프로필 화면에서 [탈퇴]를 누른 뒤 확인 절차를 마치면 즉시 처리됩니다.',
        '탈퇴하면 로그인이 차단되고, 계정 정보는 개인정보 처리방침에 따라 지체 없이 파기됩니다.',
      ],
    },
    {
      title: '앱을 사용할 수 없는 경우',
      paragraphs: [
        '가입에 사용한 계정 종류(카카오 또는 Google)와 닉네임을 적어 task@deephigh.ai 로 삭제를 요청해 주세요. 회사는 본인 확인 후 지체 없이 삭제합니다.',
        '전화 문의: 02-3443-1028 (주식회사 딥하이)',
      ],
    },
    {
      title: '삭제되는 정보와 남는 정보',
      paragraphs: [
        '계정 식별자, 닉네임, 프로필 이미지, 기기 푸시 토큰 등 계정 정보는 삭제됩니다.',
        '다른 참여자의 기록을 보호하기 위해, 확정된 약속 기록은 탈퇴한 사용자를 식별할 수 없는 상태로 남을 수 있습니다.',
        '관계 법령에 따라 보존해야 하는 정보(예: 접속 기록 3개월)는 해당 기간이 지난 뒤 파기됩니다.',
      ],
    },
  ],
  privacyLink: '개인정보 처리방침 보기',
};

const en = {
  title: 'Account Deletion',
  intro:
    'This page explains how to delete your Littlefinger account and personal information. You can delete your account directly in the app, or request deletion by email if you can no longer use the app.',
  sections: [
    {
      title: 'Delete directly in the app',
      paragraphs: [
        'Open the Littlefinger app, tap [Leave] on the profile screen, and complete the confirmation steps. Deletion takes effect immediately.',
        'After deletion, sign-in is blocked and your account information is destroyed without delay under the Privacy Policy.',
      ],
    },
    {
      title: 'If you can no longer use the app',
      paragraphs: [
        'Email task@deephigh.ai with the account type you signed up with (Kakao or Google) and your nickname. The Company verifies your identity and deletes the account without delay.',
        'Phone: +82-2-3443-1028 (DeepHigh Co., Ltd.)',
      ],
    },
    {
      title: 'What is deleted and what remains',
      paragraphs: [
        'Account information such as your account identifier, nickname, profile image, and device push tokens is deleted.',
        'To protect the records of other participants, confirmed promise records may remain in a form that cannot identify the deleted user.',
        'Information that must be preserved under applicable law (for example, access records for 3 months) is destroyed after the required period.',
      ],
    },
  ],
  privacyLink: 'View the Privacy Policy',
} satisfies typeof ko;

export const ACCOUNT_DELETION_LABEL: Localized<typeof ko> = { ko, en };
