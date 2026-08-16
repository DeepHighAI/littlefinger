import type { LegalDocumentKind } from '@littlefinger/shared';

interface LegalSection {
  title: string;
  paragraphs: readonly string[];
}

interface LegalDraftContent {
  title: string;
  sections: readonly LegalSection[];
}

export const LEGAL_DRAFT_LABELS = {
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
} as const;

export const LEGAL_DRAFT_CONTENT: Record<LegalDocumentKind, LegalDraftContent> = {
  TERMS: {
    title: LEGAL_DRAFT_LABELS.termsTitle,
    sections: [
      {
        title: '서비스 이용계약',
        paragraphs: [
          '리틀핑거는 두 사람이 합의한 약속의 내용과 진행 상태를 기록하고 확인하도록 돕는 서비스입니다. 사용자가 카카오로 시작하면 이 약관에 동의한 것으로 기록됩니다.',
        ],
      },
      {
        title: '계정',
        paragraphs: [
          '계정은 Supabase Auth의 카카오 OAuth로 생성합니다. 사용자는 자신의 계정과 로그인 수단을 안전하게 관리해야 하며, 다른 사람의 계정을 이용해서는 안 됩니다.',
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
        paragraphs: [LEGAL_DRAFT_LABELS.missingOperator],
      },
    ],
  },
  PRIVACY: {
    title: LEGAL_DRAFT_LABELS.privacyTitle,
    sections: [
      {
        title: '처리하는 개인정보',
        paragraphs: [
          '카카오 회원번호, 선택 동의한 닉네임과 프로필 이미지, 약속 내용과 승인·이행 기록, 해시 처리한 IP와 User-Agent, 기기 푸시 토큰, 선택한 증빙 사진을 처리합니다. 이메일과 전화번호는 수집하지 않습니다.',
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
          '카카오 로그인, Supabase 인증·데이터·파일 저장, Expo와 Firebase Cloud Messaging의 푸시 전달, Cloudflare의 웹 제공 과정에서 처리가 이루어질 수 있습니다.',
          LEGAL_DRAFT_LABELS.missingTransfers,
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
        paragraphs: [LEGAL_DRAFT_LABELS.missingPrivacyOfficer, LEGAL_DRAFT_LABELS.missingOperator],
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
