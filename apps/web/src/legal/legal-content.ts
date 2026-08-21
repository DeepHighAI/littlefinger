import {
  LEGAL_DOCUMENT_LABELS_BY_LOCALE,
  type LegalDocumentKind,
  type Localized,
} from '@littlefinger/shared';

interface LegalSection {
  title: string;
  paragraphs: readonly string[];
}

interface LegalDraftContent {
  title: string;
  sections: readonly LegalSection[];
}

const koLabels = {
  draftBadge: '비배포용 초안',
  draftNotice:
    '이 문서는 개발 검증용 초안입니다. 실제 사업자 정보 입력과 법률 검토 전에는 배포할 수 없습니다.',
  missingOperator:
    '[배포 전 입력 필요: 사업자명·대표자·사업자등록번호·주소·고객지원 연락처]',
  missingPrivacyOfficer:
    '[배포 전 입력 필요: 개인정보 보호책임자 이름·직책·이메일·전화번호]',
  missingTransfers:
    '[배포 전 입력 필요: 수탁자별 국가·이전 일시와 방법·보유기간 확인]',
  termsTitle: '이용약관',
  privacyTitle: '개인정보 처리방침',
};

// 법무 검토 전 초안(PO 2026-08-20) — 검토 결과로만 바꾼다.
const enLabels = {
  draftBadge: 'Draft — not for distribution',
  draftNotice:
    'This document is a draft for development verification. It must not be distributed before the actual business information is entered and legal review is complete.',
  missingOperator:
    '[To be completed before release: business name, representative, business registration number, address, customer support contact]',
  missingPrivacyOfficer:
    '[To be completed before release: privacy officer name, title, email, phone number]',
  missingTransfers:
    '[To be completed before release: country per processor, timing and method of transfer, retention period]',
  // 문서 제목은 공용 라벨이 원본 — 여기서 따로 쓰면 두 벌이 된다.
  termsTitle: LEGAL_DOCUMENT_LABELS_BY_LOCALE.en.TERMS,
  privacyTitle: LEGAL_DOCUMENT_LABELS_BY_LOCALE.en.PRIVACY,
} satisfies typeof koLabels;

export const LEGAL_DRAFT_LABELS_BY_LOCALE: Localized<typeof koLabels> = {
  ko: koLabels,
  en: enLabels,
};

const ko: Record<LegalDocumentKind, LegalDraftContent> = {
  TERMS: {
    title: koLabels.termsTitle,
    sections: [
      {
        title: '서비스 이용계약',
        paragraphs: [
          '리틀핑거는 두 사람이 합의한 약속의 내용과 진행 상태를 기록하고 확인하도록 돕는 서비스입니다. 사용자가 카카오 또는 Google로 시작하면 이 약관에 동의한 것으로 기록됩니다.',
        ],
      },
      {
        title: '계정',
        paragraphs: [
          '계정은 Supabase Auth의 카카오·Google OAuth로 생성합니다. 사용자는 자신의 계정과 로그인 수단을 안전하게 관리해야 하며, 다른 사람의 계정을 이용해서는 안 됩니다.',
        ],
      },
      {
        title: '약속 기록',
        paragraphs: [
          '약속은 작성, 초대, 상대방 승인 뒤 확정됩니다. 확정된 버전은 수정하지 않으며 이후 변경은 별도 버전과 상호 동의로 기록합니다.',
        ],
      },
      {
        title: '서비스 이용',
        paragraphs: [
          '서비스는 리마인드, 이행 확인, 선택적 증빙 사진과 참여자 기록을 제공합니다. 알림 전달이나 네트워크 연결이 항상 보장되지는 않으므로 사용자는 중요한 일정을 직접 확인해야 합니다.',
        ],
      },
      {
        title: '금지 행위',
        paragraphs: [
          '불법 또는 타인의 권리를 침해하는 내용, 개인정보를 부당하게 노출하는 내용, 서비스 안정성을 해치는 자동화·공격·사칭을 금지합니다.',
        ],
      },
      {
        title: '기록 보존과 탈퇴',
        paragraphs: [
          '작성 중 초안과 알림은 정책 기간 뒤 정리될 수 있습니다. 확정 기록은 참여자의 기록 보호를 위해 탈퇴 뒤에도 비식별 상태로 보존될 수 있습니다.',
        ],
      },
      {
        title: '서비스 변경과 중단',
        paragraphs: [
          '보안, 법령, 운영상 필요에 따라 기능이 변경되거나 일시 중단될 수 있습니다. 중요한 변경은 서비스 안에서 알립니다.',
        ],
      },
      {
        title: '책임과 면책',
        paragraphs: [
          '서비스는 금전 예치, 벌칙 자동 집행, 공증 또는 법률효과를 보장하지 않습니다. 보상과 벌칙은 당사자가 입력한 텍스트 기록입니다.',
        ],
      },
      {
        title: '분쟁 해결',
        paragraphs: [
          '리틀핑거는 어느 당사자가 옳은지 판단하지 않습니다. 분쟁이 생기면 참여자 사이의 대화와 관계 법령에 따른 절차로 해결합니다.',
        ],
      },
      {
        title: '운영자 정보',
        paragraphs: [koLabels.missingOperator],
      },
    ],
  },
  PRIVACY: {
    title: koLabels.privacyTitle,
    sections: [
      {
        title: '처리하는 개인정보',
        paragraphs: [
          '카카오 회원번호 또는 Google 계정 식별자, 선택 동의한 닉네임과 프로필 이미지, 약속 내용과 승인·이행 기록, 해시 처리한 IP와 User-Agent, 기기 푸시 토큰, 선택한 증빙 사진을 처리합니다. 서비스는 이메일과 전화번호를 이용하지 않으며, 인증 제공자가 전달한 이메일은 인증 시스템 외부에 저장하지 않습니다.',
        ],
      },
      {
        title: '처리 목적',
        paragraphs: [
          '로그인과 계정 식별, 약속 작성·초대·승인·이행 확인, 알림 전달, 기록 무결성 확인, 악용 방지와 보안 대응을 위해 처리합니다.',
        ],
      },
      {
        title: '보유 및 이용기간',
        paragraphs: [
          '작성 중 초안과 알림은 최대 90일 뒤 정리합니다. 증빙은 약속 종결일을 기준으로 365일 보관한 뒤 파일을 삭제합니다. 확정된 약속 기록은 참여자 사이의 기록 보존을 위해 비식별 계정과 함께 유지될 수 있습니다.',
        ],
      },
      {
        title: '제3자 제공',
        paragraphs: [
          '법령상 근거가 있거나 정보주체가 동의한 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.',
        ],
      },
      {
        title: '처리위탁과 국외 처리',
        paragraphs: [
          '카카오 로그인, Google 로그인, Supabase 인증·데이터·파일 저장, Expo와 Firebase Cloud Messaging의 푸시 전달, Firebase Hosting의 웹 제공 과정에서 처리가 이루어질 수 있습니다.',
          koLabels.missingTransfers,
        ],
      },
      {
        title: '정보주체의 권리',
        paragraphs: [
          '사용자는 자신의 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 다른 참여자의 확정 기록을 훼손하지 않는 범위에서 관계 법령에 따라 처리합니다.',
        ],
      },
      {
        title: '안전성 확보조치',
        paragraphs: [
          '최소 권한과 행 단위 접근 통제, 서버 전용 무결성 처리, 초대·IP·User-Agent의 해시 저장, 비공개 증빙 저장소와 10분 서명 URL, 사진 위치 메타데이터 제거를 적용합니다.',
        ],
      },
      {
        title: '개인정보 보호책임자',
        paragraphs: [koLabels.missingPrivacyOfficer, koLabels.missingOperator],
      },
      {
        title: '방침 변경',
        paragraphs: [
          '이 방침이 변경되면 시행일과 변경 내용을 서비스 안에서 알립니다. 현재 문서는 비배포용 초안이며 효력이 있는 최종 방침이 아닙니다.',
        ],
      },
    ],
  },
};

// 법무 검토 전 초안(PO 2026-08-20) — 검토 결과로만 바꾼다.
const en = {
  TERMS: {
    title: enLabels.termsTitle,
    sections: [
      {
        title: 'Service agreement',
        paragraphs: [
          'Littlefinger is a service that helps two people record and confirm the content and progress of a promise they have agreed on. When a user starts with Kakao or Google, they are recorded as having agreed to these terms.',
        ],
      },
      {
        title: 'Accounts',
        paragraphs: [
          'Accounts are created through Kakao and Google OAuth on Supabase Auth. Users must keep their account and sign-in credentials secure and must not use another person’s account.',
        ],
      },
      {
        title: 'Promise records',
        paragraphs: [
          'A promise is confirmed after it is written, an invitation is sent, and the partner approves it. A confirmed version is never edited; later changes are recorded as a separate version with mutual consent.',
        ],
      },
      {
        title: 'Using the service',
        paragraphs: [
          'The service provides reminders, fulfillment checks, optional evidence photos, and participant records. Notification delivery and network connectivity are not always guaranteed, so users must check important dates themselves.',
        ],
      },
      {
        title: 'Prohibited conduct',
        paragraphs: [
          'Content that is illegal or infringes the rights of others, content that improperly exposes personal information, and automation, attacks, or impersonation that harm the stability of the service are prohibited.',
        ],
      },
      {
        title: 'Record retention and account deletion',
        paragraphs: [
          'Drafts in progress and notifications may be cleaned up after the policy period. To protect the records of other participants, confirmed records may be retained in de-identified form even after account deletion.',
        ],
      },
      {
        title: 'Service changes and suspension',
        paragraphs: [
          'Features may be changed or temporarily suspended for security, legal, or operational reasons. Important changes are announced within the service.',
        ],
      },
      {
        title: 'Liability and disclaimers',
        paragraphs: [
          'The service does not provide money escrow, automatic penalty enforcement, notarization, or any guarantee of legal effect. Rewards and penalties are text records entered by the parties.',
        ],
      },
      {
        title: 'Dispute resolution',
        paragraphs: [
          'Littlefinger does not judge which party is right. If a dispute arises, it is resolved through conversation between the participants and through procedures under applicable law.',
        ],
      },
      {
        title: 'Operator information',
        paragraphs: [enLabels.missingOperator],
      },
    ],
  },
  PRIVACY: {
    title: enLabels.privacyTitle,
    sections: [
      {
        title: 'Personal information we process',
        paragraphs: [
          'We process the Kakao member number or Google account identifier, the nickname and profile image provided under optional consent, promise content and approval and fulfillment records, hashed IP addresses and User-Agent strings, device push tokens, and optional evidence photos. The service does not use email addresses or phone numbers, and any email passed by the authentication provider is not stored outside the authentication system.',
        ],
      },
      {
        title: 'Purposes of processing',
        paragraphs: [
          'We process personal information for sign-in and account identification; for writing, inviting, approving, and confirming fulfillment of promises; for delivering notifications; for verifying record integrity; and for preventing abuse and responding to security incidents.',
        ],
      },
      {
        title: 'Retention and use period',
        paragraphs: [
          'Drafts in progress and notifications are cleaned up after at most 90 days. Evidence files are kept for 365 days from the promise closing date and then deleted. Confirmed promise records may be kept together with a de-identified account to preserve the record between participants.',
        ],
      },
      {
        title: 'Provision to third parties',
        paragraphs: [
          'We do not provide personal information to third parties except where there is a legal basis or the data subject has consented.',
        ],
      },
      {
        title: 'Outsourced and overseas processing',
        paragraphs: [
          'Processing may occur through Kakao sign-in, Google sign-in, Supabase authentication, data, and file storage, push delivery by Expo and Firebase Cloud Messaging, and web serving by Firebase Hosting.',
          enLabels.missingTransfers,
        ],
      },
      {
        title: 'Rights of data subjects',
        paragraphs: [
          'Users may request access to, correction of, deletion of, or suspension of processing of their personal information. Requests are handled under applicable law to the extent that they do not damage another participant’s confirmed records.',
        ],
      },
      {
        title: 'Security measures',
        paragraphs: [
          'We apply least-privilege and row-level access control, server-only integrity processing, hashed storage of invite tokens, IP addresses, and User-Agent strings, a private evidence store with 10-minute signed URLs, and removal of location metadata from photos.',
        ],
      },
      {
        title: 'Privacy officer',
        paragraphs: [enLabels.missingPrivacyOfficer, enLabels.missingOperator],
      },
      {
        title: 'Policy changes',
        paragraphs: [
          'When this policy changes, the effective date and the changes are announced within the service. The current document is a draft not for distribution and is not the final policy in effect.',
        ],
      },
    ],
  },
} satisfies typeof ko;

export const LEGAL_DRAFT_CONTENT_BY_LOCALE: Localized<typeof ko> = { ko, en };
