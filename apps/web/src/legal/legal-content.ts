import {
  LEGAL_DOCUMENT_LABELS_BY_LOCALE,
  type LegalDocumentKind,
  type Localized,
} from '@littlefinger/shared';

/**
 * 확정판 법무 문서 전문 (버전·시행일 정본은 shared `LEGAL_DOCUMENTS`).
 *
 * 본문 속 정책 수치(90일·365일·72시간·10분·야간 시간대)는 **일부러 리터럴**이다 —
 * 약관은 버전이 고정된 문서라 config 변경이 공지 없이 문구를 바꾸면 안 된다.
 * 대신 legal-document.test.tsx 의 드리프트 가드가 config 정본과 대조해서,
 * 수치가 바뀌면 테스트가 깨져 의식적인 개정판(버전 올림)을 강제한다.
 *
 * en 은 참고용 번역본이며 한국어판이 우선한다(약관 제20조·방침 12항에 명시).
 */

interface LegalSection {
  title: string;
  paragraphs: readonly string[];
}

interface LegalContent {
  title: string;
  sections: readonly LegalSection[];
}

// 사업자 정보 (PO 제공 2026-08-22). 두 문서가 같은 원본을 쓴다.
const KO_OPERATOR_LINES = [
  '상호: 주식회사 딥하이',
  '대표이사: 심충섭',
  '주소: 대구광역시 북구 검단로 50 (복현동, 복현서한타운) 110동 202호',
  '사업자등록번호: 798-86-01094',
  '대표번호: 02-3443-1028',
] as const;

const EN_OPERATOR_LINES = [
  'Company name: DeepHigh Co., Ltd.',
  'CEO: Chungseob Shim',
  'Address: 110-dong 202-ho, 50 Geomdan-ro, Buk-gu, Daegu, Republic of Korea',
  'Business registration number: 798-86-01094',
  'Phone: +82-2-3443-1028',
] as const;

const ko: Record<LegalDocumentKind, LegalContent> = {
  TERMS: {
    title: LEGAL_DOCUMENT_LABELS_BY_LOCALE.ko.TERMS,
    sections: [
      {
        title: '제1조 (목적)',
        paragraphs: [
          '이 약관은 주식회사 딥하이(이하 "회사")가 제공하는 리틀핑거 서비스(이하 "서비스")의 이용에 관하여 회사와 사용자 사이의 권리·의무와 책임, 그 밖에 필요한 사항을 정하는 것을 목적으로 합니다.',
        ],
      },
      {
        title: '제2조 (정의)',
        paragraphs: [
          '① "서비스"란 두 사람이 합의한 약속의 내용과 진행 상태를 기록하고 확인하도록 돕기 위해 회사가 제공하는 리틀핑거 앱과 웹을 말합니다.',
          '② "사용자"란 이 약관에 동의하고 서비스에 가입한 사람을 말합니다.',
          '③ "약속"이란 사용자가 서비스에 기록하는 합의 내용으로, 제목·내용·보상·벌칙·기한 등을 포함합니다.',
          '④ "참여자"란 하나의 약속에 관계된 사용자로, 약속을 만드는 작성자, 약속을 승인하는 상대방, 약속을 지켜보는 증인을 말합니다.',
          '⑤ "초대 링크"란 작성자가 상대방이나 증인을 초대하기 위해 발급하는 1회용 링크를 말합니다.',
          '⑥ "확정 기록"이란 상대방의 승인으로 확정된 약속의 내용과 그 무결성 확인을 위한 기록 지문을 말합니다.',
        ],
      },
      {
        title: '제3조 (약관의 게시와 개정)',
        paragraphs: [
          '① 회사는 이 약관을 서비스 안의 링크와 웹 페이지에 항상 게시합니다.',
          '② 회사는 관계 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있습니다.',
          '③ 약관을 개정하는 경우 적용일과 개정 사유를 밝혀 적용일 7일 전부터 서비스 안에서 공지하며, 사용자에게 불리한 변경은 적용일 30일 전부터 공지합니다.',
          '④ 사용자는 개정 약관에 동의하지 않으면 서비스 이용을 중단하고 탈퇴할 수 있으며, 공지 기간이 지난 뒤 서비스를 계속 이용하면 개정 약관에 동의한 것으로 봅니다.',
          '⑤ 이 약관에서 정하지 않은 사항은 관계 법령과 서비스 안의 개별 안내에 따릅니다.',
        ],
      },
      {
        title: '제4조 (이용계약의 체결)',
        paragraphs: [
          '① 이용계약은 가입하려는 사람이 이 약관과 개인정보 처리방침의 내용을 확인한 뒤 카카오 또는 Google 계정으로 로그인함으로써 체결되며, 이때 이 약관에 동의한 것으로 기록됩니다.',
          '② 만 14세 미만인 사람은 서비스에 가입할 수 없습니다.',
          '③ 회사는 타인의 계정이나 정보를 도용한 가입, 부정한 목적의 가입, 과거 이용제한 이력이 있는 사람의 가입에 대해 승낙을 거부하거나 이용계약을 해지할 수 있습니다.',
        ],
      },
      {
        title: '제5조 (계정의 관리)',
        paragraphs: [
          '① 계정은 가입한 본인만 이용할 수 있으며, 로그인 수단인 카카오·Google 계정의 관리 책임은 사용자에게 있습니다.',
          '② 사용자는 자신의 계정이 도용된 사실을 알게 되면 즉시 회사에 알리고 안내에 따라야 합니다.',
        ],
      },
      {
        title: '제6조 (개인정보의 보호)',
        paragraphs: [
          '회사는 관계 법령에 따라 사용자의 개인정보를 보호하며, 개인정보의 처리에 관한 사항은 별도로 게시하는 개인정보 처리방침에 따릅니다.',
        ],
      },
      {
        title: '제7조 (서비스의 내용)',
        paragraphs: [
          '① 회사가 제공하는 서비스는 다음과 같습니다.',
          '1. 약속의 작성과 기록',
          '2. 초대 링크를 통한 상대방·증인 초대와 승인',
          '3. 확정 기록과 기록 지문의 생성·보존',
          '4. 리마인드 등 알림',
          '5. 이행 확인과 결과 기록',
          '6. 증빙 사진 첨부(선택)',
          '7. 약속 지킴율 등 통계 표시',
          '② 서비스는 무료로 제공됩니다.',
        ],
      },
      {
        title: '제8조 (서비스의 성격과 한계)',
        paragraphs: [
          '① 서비스는 당사자 사이의 약속을 기록하고 잊지 않도록 돕는 도구이며, 회사는 약속의 당사자가 아닙니다.',
          '② 서비스의 기록(확정 기록과 기록 지문 포함)은 공증이나 전자계약이 아니며, 회사는 기록의 법적 효력을 보증하지 않습니다. 다만 양측의 승인 이력과 시각 정보는 분쟁 시 참고 자료로 활용될 수 있습니다.',
          '③ 회사는 금전이나 재산의 예치, 보상·벌칙의 집행이나 정산을 제공하지 않습니다. 보상과 벌칙은 당사자가 입력한 텍스트 기록입니다.',
          '④ 알림의 전달과 외부 메신저를 통한 초대 링크의 전달은 통신 환경에 따라 지연되거나 실패할 수 있습니다. 중요한 기한은 사용자가 직접 확인해야 합니다.',
        ],
      },
      {
        title: '제9조 (약속의 확정과 변경)',
        paragraphs: [
          '① 약속은 작성자가 작성하고 상대방이 내용을 확인하여 승인한 때에 확정됩니다.',
          '② 확정된 약속의 내용은 수정되지 않으며, 확정 후의 변경이나 파기는 참여자의 상호 동의를 거쳐 새로운 버전이나 상태로만 기록됩니다.',
          '③ 초대 링크는 발급 후 72시간 동안 1회만 사용할 수 있으며, 만료되면 작성자가 다시 발급할 수 있습니다.',
        ],
      },
      {
        title: '제10조 (분쟁에 대한 중립)',
        paragraphs: [
          '① 약속의 이행 여부에 대해 참여자 사이에 다툼이 있으면 서비스는 양쪽의 주장을 나란히 기록할 뿐, 누가 옳은지 판단하지 않습니다.',
          '② 참여자 사이의 분쟁은 당사자 간 협의나 관계 법령에 따른 절차로 해결하며, 회사는 이에 개입하지 않습니다.',
        ],
      },
      {
        title: '제11조 (알림)',
        paragraphs: [
          '① 회사는 약속의 진행에 필요한 알림을 앱 푸시와 서비스 안 알림으로 보냅니다.',
          '② 야간(21:00~08:00, 한국 시간)에는 예약된 알림을 보내지 않고 다음 날 아침으로 미룹니다.',
          '③ 기기 설정이나 네트워크 상태에 따라 알림이 전달되지 않을 수 있으며, 알림을 받지 못했다는 사정만으로 약속 기록의 내용이 달라지지 않습니다.',
        ],
      },
      {
        title: '제12조 (광고)',
        paragraphs: [
          '① 회사는 서비스 화면 중 회사가 정한 위치에 광고를 게재할 수 있습니다. 약속의 작성·검토·승인·이행 확인 화면과 초대 링크로 접속하는 웹 화면에는 광고를 게재하지 않습니다.',
          '② 광고는 Google AdMob 등 외부 광고 사업자를 통해 제공될 수 있으며, 이와 관련한 정보 처리는 개인정보 처리방침에 따릅니다.',
        ],
      },
      {
        title: '제13조 (사용자의 의무)',
        paragraphs: [
          '① 사용자는 다음 행위를 해서는 안 됩니다.',
          '1. 타인의 계정 이용, 타인의 정보 도용, 타인 사칭',
          '2. 법령이나 공서양속에 어긋나는 내용의 기록',
          '3. 타인의 명예를 훼손하거나 권리를 침해하는 내용의 기록',
          '4. 타인의 개인정보를 동의 없이 수집하거나 공개하는 행위',
          '5. 자동화된 접근, 취약점 악용 등 서비스의 안정적 운영을 방해하는 행위',
          '6. 회사의 사전 동의 없는 영리 목적의 서비스 이용',
          '② 사용자는 관계 법령, 이 약관, 서비스 안의 안내를 지켜야 합니다.',
        ],
      },
      {
        title: '제14조 (콘텐츠의 권리와 책임)',
        paragraphs: [
          '① 사용자가 입력한 약속 내용과 증빙 사진 등 콘텐츠에 대한 권리는 해당 사용자에게 있습니다.',
          '② 콘텐츠는 같은 약속의 참여자에게 공개되며, 회사는 서비스의 제공·유지·개선과 기록 보존에 필요한 범위에서만 콘텐츠를 처리합니다.',
          '③ 콘텐츠에 대한 책임은 이를 작성한 사용자에게 있으며, 회사는 콘텐츠가 법령이나 이 약관에 위반된다고 판단되면 관계 법령에 따라 노출 제한 등 필요한 조치를 할 수 있습니다.',
        ],
      },
      {
        title: '제15조 (서비스의 변경과 중단)',
        paragraphs: [
          '① 회사는 운영상·기술상 필요에 따라 서비스의 전부나 일부를 변경하거나 중단할 수 있으며, 사용자에게 불리한 중대한 변경이나 중단은 미리 공지합니다.',
          '② 천재지변, 설비 장애, 로그인·클라우드 등 외부 서비스의 장애로 서비스가 일시 중단될 수 있습니다.',
        ],
      },
      {
        title: '제16조 (이용제한)',
        paragraphs: [
          '① 회사는 사용자가 이 약관을 위반하거나 서비스의 정상 운영을 방해하면 경고, 일시 정지, 영구 정지의 방법으로 이용을 제한할 수 있습니다.',
          '② 이용제한에 이의가 있는 사용자는 회사에 이의를 제기할 수 있으며, 회사는 이유가 정당하다고 인정하면 이용을 재개합니다.',
        ],
      },
      {
        title: '제17조 (탈퇴와 기록의 보존)',
        paragraphs: [
          '① 사용자는 언제든지 서비스 안의 탈퇴 기능으로 이용계약을 해지할 수 있습니다.',
          '② 탈퇴하면 계정 정보는 개인정보 처리방침에 따라 파기됩니다. 다만 다른 참여자의 기록을 보호하기 위해 확정된 약속 기록은 탈퇴한 사용자를 식별할 수 없는 상태로 남을 수 있습니다.',
        ],
      },
      {
        title: '제18조 (손해배상과 면책)',
        paragraphs: [
          '① 회사나 사용자는 상대방의 귀책사유로 손해를 입으면 관계 법령에 따라 배상을 청구할 수 있습니다.',
          '② 회사는 무료로 제공되는 서비스와 관련하여 회사의 고의나 중대한 과실이 없는 한 책임을 지지 않습니다.',
          '③ 회사는 약속 자체의 내용, 약속의 이행이나 불이행, 참여자 사이의 분쟁에 대해 책임을 지지 않습니다.',
        ],
      },
      {
        title: '제19조 (준거법과 관할)',
        paragraphs: [
          '① 이 약관과 서비스 이용에는 대한민국 법이 적용됩니다.',
          '② 서비스 이용에 관하여 회사와 사용자 사이에 소송이 생기면 민사소송법에 따른 관할 법원에 제기합니다.',
        ],
      },
      {
        title: '제20조 (언어)',
        paragraphs: [
          '이 약관은 한국어로 작성되며, 영어 번역본은 이해를 돕기 위한 것입니다. 한국어판과 번역본 사이에 차이가 있으면 한국어판이 우선합니다.',
        ],
      },
      {
        title: '부칙',
        paragraphs: ['이 약관은 2026년 8월 22일부터 적용됩니다.'],
      },
      {
        title: '회사 정보',
        paragraphs: KO_OPERATOR_LINES,
      },
    ],
  },
  PRIVACY: {
    title: LEGAL_DOCUMENT_LABELS_BY_LOCALE.ko.PRIVACY,
    sections: [
      {
        title: '개요',
        paragraphs: [
          '주식회사 딥하이(이하 "회사")는 리틀핑거 서비스(이하 "서비스")를 제공하면서 「개인정보 보호법」 등 관계 법령을 준수하며, 사용자의 개인정보를 안전하게 보호하기 위해 이 처리방침을 둡니다. 이 방침은 회사가 어떤 개인정보를 어떤 목적으로 처리하고 어떻게 보호하는지 알립니다.',
        ],
      },
      {
        title: '1. 처리하는 개인정보의 항목과 수집 방법',
        paragraphs: [
          '① 회사는 다음 개인정보를 처리합니다.',
          '가입·로그인(필수): 카카오 회원번호 또는 Google 계정 식별자, 닉네임',
          '가입·로그인(선택): 프로필 이미지, 이메일(선택 동의한 경우 인증 시스템에만 저장되며 서비스는 이를 이용하지 않습니다)',
          '서비스 이용 과정에서 생성: 약속 기록(제목·내용·보상·벌칙·기한 등), 승인·이행 확인 기록, 알림 기록, 기기 푸시 토큰, 접속 기록(IP 주소와 브라우저 정보는 복원할 수 없는 일방향 해시로만 저장)',
          '증빙 사진(선택): 첨부 시 위치 정보(EXIF)를 제거한 뒤 저장',
          '② 개인정보는 카카오·Google 로그인 시 인증 제공자로부터 제공받거나, 사용자가 서비스를 이용하는 과정에서 생성·수집됩니다.',
          '③ 회사는 전화번호, 연락처 목록, 위치정보를 수집하지 않습니다.',
        ],
      },
      {
        title: '2. 개인정보의 처리 목적',
        paragraphs: [
          '가입, 로그인, 사용자 식별',
          '약속의 작성·초대·승인·이행 확인 등 서비스 제공',
          '확정 기록의 무결성 확인(기록 지문 생성)',
          '알림 전달',
          '부정 이용 방지, 보안 사고 대응, 분쟁 대응',
          '앱 광고 게재(광고가 표시되는 경우)',
        ],
      },
      {
        title: '3. 개인정보의 처리와 보유 기간',
        paragraphs: [
          '계정 정보: 탈퇴할 때까지 보유하며, 탈퇴하면 지체 없이 파기합니다.',
          '확정된 약속 기록: 다른 참여자의 기록을 보호하기 위해 탈퇴한 사용자를 식별할 수 없는 상태로 보존될 수 있습니다.',
          '작성 중인 약속 초안: 마지막 수정일부터 90일이 지나면 삭제합니다.',
          '서비스 안 알림: 90일이 지나면 삭제합니다.',
          '증빙 사진: 약속 종결일부터 365일이 지나면 파일을 삭제합니다.',
          '초대 링크: 발급 후 72시간 동안만 유효하며, 토큰은 복원할 수 없는 해시로만 저장합니다.',
          '관계 법령에 따라 보존이 필요한 정보(예: 통신비밀보호법에 따른 접속 기록 3개월)는 해당 기간 동안 보존합니다.',
        ],
      },
      {
        title: '4. 개인정보의 파기',
        paragraphs: [
          '보유 기간이 지났거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자 파일 형태의 정보는 복구할 수 없는 방법으로 삭제합니다.',
        ],
      },
      {
        title: '5. 개인정보의 제3자 제공',
        paragraphs: [
          '① 회사는 사용자의 동의가 있거나 법령에 근거가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.',
          '② 서비스의 성격상 닉네임, 프로필 이미지, 약속 지킴율, 약속의 내용과 진행 기록은 같은 약속의 참여자에게 공개됩니다.',
        ],
      },
      {
        title: '6. 개인정보 처리의 위탁과 국외 이전',
        paragraphs: [
          '① 회사는 서비스 제공을 위해 다음 업무를 위탁합니다.',
          'Supabase, Inc.(미국 법인): 데이터베이스·인증·파일 저장·서버 기능 운영. 데이터는 대한민국(서울) 리전에 저장됩니다.',
          'Google LLC(미국): Google 로그인, 푸시 알림 전달(Firebase Cloud Messaging), 웹 호스팅(Firebase Hosting), 광고가 표시되는 경우 Google AdMob',
          '650 Industries, Inc.(Expo, 미국): 앱 푸시 알림 발송 대행',
          '② 푸시 알림을 보내는 과정에서 기기 푸시 토큰과 알림 내용이 미국에 있는 Expo·Google 서버로 전송됩니다. 이전은 알림 발송 시 네트워크를 통해 이루어지며, 발송 처리에 필요한 기간 동안 보유됩니다.',
          '③ 사용자는 개인정보의 국외 이전을 거부할 수 있습니다. 다만 이 경우 푸시 알림 등 일부 기능의 제공이 불가능할 수 있습니다. 거부는 아래 개인정보 보호책임자에게 연락하여 할 수 있습니다.',
        ],
      },
      {
        title: '7. 광고와 자동 수집 장치',
        paragraphs: [
          '① 초대 링크로 접속하는 웹은 로그인 유지와 언어 설정을 위한 필수 저장소만 사용하며, 광고 쿠키나 행태 분석 쿠키를 사용하지 않습니다.',
          '② 앱 홈 화면에 광고가 표시되는 경우 Google AdMob이 광고 식별자 등을 수집할 수 있습니다. 기기 설정(광고 ID 재설정, 맞춤 광고 끄기)에서 이를 관리할 수 있습니다.',
        ],
      },
      {
        title: '8. 정보주체의 권리와 행사 방법',
        paragraphs: [
          '① 사용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.',
          '② 권리 행사는 서비스 안의 기능이나 아래 개인정보 보호책임자 연락처를 통해 할 수 있으며, 회사는 지체 없이 필요한 조치를 합니다.',
          '③ 삭제 요구는 다른 참여자의 확정 기록을 훼손하지 않는 범위에서 처리되며, 법령에 따라 보존해야 하는 정보는 처리가 제한될 수 있습니다.',
          '④ 만 14세 미만 아동은 서비스에 가입할 수 없으므로, 법정대리인 동의 절차를 두지 않습니다.',
        ],
      },
      {
        title: '9. 개인정보의 안전성 확보조치',
        paragraphs: [
          '전송 구간 암호화(HTTPS)',
          '행 단위 접근 통제와 최소 권한 원칙',
          '확정 기록의 위·변조를 확인하는 기록 지문(서버에서만 생성)',
          '초대 링크 토큰, IP 주소, 브라우저 정보의 일방향 해시 저장',
          '증빙 사진의 비공개 저장소 보관과 10분 동안만 유효한 서명 URL 을 통한 접근',
          '증빙 사진의 위치 정보(EXIF) 제거',
        ],
      },
      {
        title: '10. 개인정보 보호책임자와 고충 처리',
        paragraphs: [
          '개인정보 보호책임자: 심충섭(대표이사)',
          '연락처: 02-3443-1028',
          '사용자는 서비스를 이용하면서 생긴 개인정보 관련 문의, 불만, 피해 구제 요청을 개인정보 보호책임자에게 할 수 있으며, 회사는 지체 없이 답변하고 처리합니다.',
        ],
      },
      {
        title: '11. 권익침해에 대한 구제 방법',
        paragraphs: [
          '개인정보 침해에 대한 신고나 상담이 필요한 경우 다음 기관에 문의할 수 있습니다.',
          '개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)',
          '개인정보침해신고센터: 국번 없이 118 (privacy.kisa.or.kr)',
          '대검찰청: 국번 없이 1301 (www.spo.go.kr)',
          '경찰청: 국번 없이 182 (ecrm.cyber.go.kr)',
        ],
      },
      {
        title: '12. 처리방침의 변경',
        paragraphs: [
          '이 방침의 내용이 추가·삭제·수정되는 경우 시행 7일 전부터(사용자 권리에 중대한 변경이 있는 경우 30일 전부터) 서비스 안에서 알립니다.',
          '이 방침은 2026년 8월 22일부터 적용됩니다.',
          '이 방침은 한국어로 작성되며, 영어 번역본은 이해를 돕기 위한 것입니다. 차이가 있으면 한국어판이 우선합니다.',
        ],
      },
      {
        title: '회사 정보',
        paragraphs: KO_OPERATOR_LINES,
      },
    ],
  },
};

// 참고용 번역본 — 한국어판이 우선한다. 법무 검토 결과가 나오면 그 결과로만 바꾼다.
const en = {
  TERMS: {
    title: LEGAL_DOCUMENT_LABELS_BY_LOCALE.en.TERMS,
    sections: [
      {
        title: 'Article 1 (Purpose)',
        paragraphs: [
          'These Terms set out the rights, obligations, and responsibilities between DeepHigh Co., Ltd. (the "Company") and users regarding the use of the Littlefinger service (the "Service"), together with other necessary matters.',
        ],
      },
      {
        title: 'Article 2 (Definitions)',
        paragraphs: [
          '1. "Service" means the Littlefinger app and web provided by the Company to help two people record and confirm the content and progress of a promise they have agreed on.',
          '2. "User" means a person who has agreed to these Terms and signed up for the Service.',
          '3. "Promise" means the agreed content a user records in the Service, including its title, content, reward, penalty, and due date.',
          '4. "Participant" means a user involved in a promise: the creator who writes it, the partner who approves it, and any witness who watches over it.',
          '5. "Invite link" means the single-use link a creator issues to invite a partner or witness.',
          '6. "Confirmed record" means the content of a promise confirmed by the partner’s approval, together with the record fingerprint used to verify its integrity.',
        ],
      },
      {
        title: 'Article 3 (Posting and amending the Terms)',
        paragraphs: [
          '1. The Company keeps these Terms posted at links within the Service and on the web.',
          '2. The Company may amend these Terms to the extent this does not violate applicable law.',
          '3. When amending the Terms, the Company announces the effective date and the reasons within the Service from 7 days before the effective date, and from 30 days before for changes unfavorable to users.',
          '4. A user who does not agree to the amended Terms may stop using the Service and delete their account. Continuing to use the Service after the notice period counts as agreement to the amended Terms.',
          '5. Matters not covered by these Terms follow applicable law and individual notices within the Service.',
        ],
      },
      {
        title: 'Article 4 (Formation of the service agreement)',
        paragraphs: [
          '1. The service agreement is formed when a person reviews these Terms and the Privacy Policy and signs in with a Kakao or Google account, at which point their agreement to these Terms is recorded.',
          '2. Persons under 14 years of age may not sign up for the Service.',
          '3. The Company may refuse or later terminate an agreement made using another person’s account or information, for an improper purpose, or by a person with a history of use restrictions.',
        ],
      },
      {
        title: 'Article 5 (Account management)',
        paragraphs: [
          '1. An account may be used only by the person who created it, and the user is responsible for managing the Kakao or Google account used to sign in.',
          '2. A user who learns that their account has been compromised must notify the Company immediately and follow its guidance.',
        ],
      },
      {
        title: 'Article 6 (Protection of personal information)',
        paragraphs: [
          'The Company protects users’ personal information under applicable law. The processing of personal information is governed by the separately posted Privacy Policy.',
        ],
      },
      {
        title: 'Article 7 (Contents of the Service)',
        paragraphs: [
          '1. The Company provides the following:',
          '(1) writing and recording promises;',
          '(2) inviting and obtaining approval from partners and witnesses through invite links;',
          '(3) creating and preserving confirmed records and record fingerprints;',
          '(4) notifications such as reminders;',
          '(5) fulfillment checks and result records;',
          '(6) optional evidence photos;',
          '(7) statistics such as the promise keep rate.',
          '2. The Service is provided free of charge.',
        ],
      },
      {
        title: 'Article 8 (Nature and limits of the Service)',
        paragraphs: [
          '1. The Service is a tool that records promises between the parties and helps them not be forgotten. The Company is not a party to any promise.',
          '2. Records in the Service (including confirmed records and record fingerprints) are not notarization or an electronic contract, and the Company does not guarantee their legal effect. However, both parties’ approval history and timestamps may serve as reference material in a dispute.',
          '3. The Company does not hold money or property in escrow and does not enforce or settle rewards or penalties. Rewards and penalties are text records entered by the parties.',
          '4. Delivery of notifications and of invite links through external messengers may be delayed or fail depending on network conditions. Users must check important dates themselves.',
        ],
      },
      {
        title: 'Article 9 (Confirmation and changes of a promise)',
        paragraphs: [
          '1. A promise is confirmed when the creator writes it and the partner reviews and approves its content.',
          '2. The content of a confirmed promise is never edited. Changes or termination after confirmation are recorded only as a new version or state with the participants’ mutual consent.',
          '3. An invite link can be used once within 72 hours of issuance; after it expires, the creator may issue a new one.',
        ],
      },
      {
        title: 'Article 10 (Neutrality in disputes)',
        paragraphs: [
          '1. If participants disagree about whether a promise was kept, the Service records both claims side by side and does not judge who is right.',
          '2. Disputes between participants are resolved through discussion between the parties or procedures under applicable law; the Company does not intervene.',
        ],
      },
      {
        title: 'Article 11 (Notifications)',
        paragraphs: [
          '1. The Company sends notifications needed for the progress of a promise by app push and in-service notifications.',
          '2. Scheduled notifications are not sent at night (21:00–08:00 KST) and are deferred to the next morning.',
          '3. Notifications may not be delivered depending on device settings or network conditions, and non-receipt of a notification does not change the content of a promise record.',
        ],
      },
      {
        title: 'Article 12 (Advertising)',
        paragraphs: [
          '1. The Company may place advertisements in positions it designates within the Service. No advertisements are placed on the screens for writing, reviewing, approving, or confirming fulfillment of a promise, nor on the web pages opened through an invite link.',
          '2. Advertisements may be served through external advertising providers such as Google AdMob; related data processing is governed by the Privacy Policy.',
        ],
      },
      {
        title: 'Article 13 (User obligations)',
        paragraphs: [
          '1. Users must not:',
          '(1) use another person’s account, misappropriate another person’s information, or impersonate another person;',
          '(2) record content that violates the law or public order and morals;',
          '(3) record content that defames another person or infringes their rights;',
          '(4) collect or disclose another person’s personal information without consent;',
          '(5) interfere with the stable operation of the Service, including automated access or exploiting vulnerabilities;',
          '(6) use the Service for commercial purposes without the Company’s prior consent.',
          '2. Users must comply with applicable law, these Terms, and notices within the Service.',
        ],
      },
      {
        title: 'Article 14 (Rights and responsibility for content)',
        paragraphs: [
          '1. Rights to the content a user enters, such as promise content and evidence photos, belong to that user.',
          '2. Content is visible to the participants of the same promise, and the Company processes content only to the extent needed to provide, maintain, and improve the Service and to preserve records.',
          '3. Responsibility for content lies with the user who wrote it. If the Company judges that content violates the law or these Terms, it may take necessary measures under applicable law, such as restricting exposure.',
        ],
      },
      {
        title: 'Article 15 (Changes and suspension of the Service)',
        paragraphs: [
          '1. The Company may change or discontinue all or part of the Service for operational or technical reasons, and announces material changes or discontinuations unfavorable to users in advance.',
          '2. The Service may be temporarily suspended due to natural disasters, equipment failures, or failures of external services such as sign-in providers or cloud infrastructure.',
        ],
      },
      {
        title: 'Article 16 (Use restrictions)',
        paragraphs: [
          '1. If a user violates these Terms or interferes with the normal operation of the Service, the Company may restrict use by warning, temporary suspension, or permanent suspension.',
          '2. A user may object to a restriction, and the Company reinstates use if it finds the objection justified.',
        ],
      },
      {
        title: 'Article 17 (Account deletion and preservation of records)',
        paragraphs: [
          '1. A user may terminate the service agreement at any time using the account deletion feature within the Service.',
          '2. On deletion, account information is destroyed under the Privacy Policy. However, to protect the records of other participants, confirmed promise records may remain in a form that cannot identify the deleted user.',
        ],
      },
      {
        title: 'Article 18 (Damages and disclaimers)',
        paragraphs: [
          '1. The Company or a user may claim damages under applicable law for losses caused by the other party’s fault.',
          '2. For the Service provided free of charge, the Company is not liable absent intent or gross negligence on its part.',
          '3. The Company is not responsible for the content of any promise, its fulfillment or non-fulfillment, or disputes between participants.',
        ],
      },
      {
        title: 'Article 19 (Governing law and jurisdiction)',
        paragraphs: [
          '1. These Terms and use of the Service are governed by the laws of the Republic of Korea.',
          '2. Lawsuits between the Company and a user regarding use of the Service are brought before the court with jurisdiction under the Civil Procedure Act of Korea.',
        ],
      },
      {
        title: 'Article 20 (Language)',
        paragraphs: [
          'These Terms are written in Korean, and this English translation is provided for convenience. If the Korean version and a translation differ, the Korean version prevails.',
        ],
      },
      {
        title: 'Addendum',
        paragraphs: ['These Terms take effect on August 22, 2026.'],
      },
      {
        title: 'Company information',
        paragraphs: EN_OPERATOR_LINES,
      },
    ],
  },
  PRIVACY: {
    title: LEGAL_DOCUMENT_LABELS_BY_LOCALE.en.PRIVACY,
    sections: [
      {
        title: 'Overview',
        paragraphs: [
          'DeepHigh Co., Ltd. (the "Company") complies with the Personal Information Protection Act of Korea and other applicable laws in providing the Littlefinger service (the "Service"), and maintains this policy to protect users’ personal information. This policy explains what personal information the Company processes, for what purposes, and how it is protected.',
        ],
      },
      {
        title: '1. Personal information we process and how it is collected',
        paragraphs: [
          '(1) The Company processes the following personal information:',
          'Sign-up and sign-in (required): Kakao member number or Google account identifier, nickname',
          'Sign-up and sign-in (optional): profile image; email (stored only in the authentication system when optionally consented to; the Service does not use it)',
          'Generated while using the Service: promise records (title, content, reward, penalty, due date, and similar), approval and fulfillment records, notification records, device push tokens, and access records (IP addresses and browser information are stored only as irreversible one-way hashes)',
          'Evidence photos (optional): stored after location metadata (EXIF) is removed',
          '(2) Personal information is received from the authentication provider when signing in with Kakao or Google, or is generated and collected while the user uses the Service.',
          '(3) The Company does not collect phone numbers, contact lists, or location information.',
        ],
      },
      {
        title: '2. Purposes of processing',
        paragraphs: [
          'Sign-up, sign-in, and user identification',
          'Providing the Service: writing, inviting, approving, and confirming fulfillment of promises',
          'Verifying the integrity of confirmed records (generating record fingerprints)',
          'Delivering notifications',
          'Preventing abuse, responding to security incidents, and handling disputes',
          'Serving in-app advertisements (where advertisements are shown)',
        ],
      },
      {
        title: '3. Retention periods',
        paragraphs: [
          'Account information: retained until account deletion and destroyed without delay on deletion.',
          'Confirmed promise records: may be preserved in a form that cannot identify the deleted user, to protect the records of other participants.',
          'Promise drafts in progress: deleted 90 days after their last edit.',
          'In-service notifications: deleted after 90 days.',
          'Evidence photos: files deleted 365 days after the promise closing date.',
          'Invite links: valid for 72 hours after issuance; tokens are stored only as irreversible hashes.',
          'Information that must be preserved under applicable law (for example, access records for 3 months under the Protection of Communications Secrets Act) is preserved for the required period.',
        ],
      },
      {
        title: '4. Destruction of personal information',
        paragraphs: [
          'Personal information whose retention period has passed or whose processing purpose has been achieved is destroyed without delay. Electronic files are deleted using methods that make recovery impossible.',
        ],
      },
      {
        title: '5. Provision to third parties',
        paragraphs: [
          '(1) The Company does not provide personal information to third parties except with the user’s consent or where the law provides a basis.',
          '(2) By the nature of the Service, the nickname, profile image, promise keep rate, and the content and progress records of a promise are visible to the participants of that promise.',
        ],
      },
      {
        title: '6. Outsourced processing and overseas transfer',
        paragraphs: [
          '(1) The Company outsources the following work to provide the Service:',
          'Supabase, Inc. (a US company): operating the database, authentication, file storage, and server functions. Data is stored in the Republic of Korea (Seoul) region.',
          'Google LLC (US): Google sign-in, push notification delivery (Firebase Cloud Messaging), web hosting (Firebase Hosting), and Google AdMob where advertisements are shown',
          '650 Industries, Inc. (Expo, US): relaying app push notifications',
          '(2) When push notifications are sent, device push tokens and notification content are transmitted to Expo and Google servers in the United States. The transfer occurs over the network at the time of sending, and the data is held for the period needed to process delivery.',
          '(3) Users may refuse the overseas transfer of their personal information; in that case some features, such as push notifications, may become unavailable. Refusal can be made by contacting the privacy officer below.',
        ],
      },
      {
        title: '7. Advertising and automatic collection tools',
        paragraphs: [
          '(1) The web pages opened through an invite link use only essential storage for keeping you signed in and remembering your language, and use no advertising or behavioral analytics cookies.',
          '(2) Where advertisements are shown on the app home screen, Google AdMob may collect advertising identifiers. You can manage this in your device settings (resetting the advertising ID, turning off personalized ads).',
        ],
      },
      {
        title: '8. Rights of data subjects and how to exercise them',
        paragraphs: [
          '(1) Users may at any time request access to, correction of, deletion of, or suspension of processing of their personal information.',
          '(2) Rights may be exercised through features within the Service or by contacting the privacy officer below, and the Company takes necessary measures without delay.',
          '(3) Deletion requests are handled to the extent they do not damage another participant’s confirmed records, and processing may be limited for information that must be preserved by law.',
          '(4) Children under 14 cannot sign up for the Service, so no legal-guardian consent procedure is provided.',
        ],
      },
      {
        title: '9. Security measures',
        paragraphs: [
          'Encryption in transit (HTTPS)',
          'Row-level access control and the principle of least privilege',
          'Record fingerprints that detect tampering with confirmed records (generated only on the server)',
          'One-way hashed storage of invite link tokens, IP addresses, and browser information',
          'Private storage for evidence photos, accessed only through signed URLs valid for 10 minutes',
          'Removal of location metadata (EXIF) from evidence photos',
        ],
      },
      {
        title: '10. Privacy officer and grievance handling',
        paragraphs: [
          'Privacy officer: Chungseob Shim (CEO)',
          'Contact: +82-2-3443-1028',
          'Users may direct any privacy-related inquiries, complaints, or requests for remedy arising from use of the Service to the privacy officer, and the Company responds and handles them without delay.',
        ],
      },
      {
        title: '11. Remedies for infringement of rights',
        paragraphs: [
          'If you need to report or consult on a privacy infringement, you can contact the following organizations in Korea:',
          'Personal Information Dispute Mediation Committee: 1833-6972 (www.kopico.go.kr)',
          'Privacy Infringement Report Center: 118 (privacy.kisa.or.kr)',
          'Supreme Prosecutors’ Office: 1301 (www.spo.go.kr)',
          'National Police Agency: 182 (ecrm.cyber.go.kr)',
        ],
      },
      {
        title: '12. Changes to this policy',
        paragraphs: [
          'When this policy is added to, deleted from, or amended, the change is announced within the Service from 7 days before it takes effect, or from 30 days before for material changes to user rights.',
          'This policy takes effect on August 22, 2026.',
          'This policy is written in Korean, and this English translation is provided for convenience. If they differ, the Korean version prevails.',
        ],
      },
      {
        title: 'Company information',
        paragraphs: EN_OPERATOR_LINES,
      },
    ],
  },
} satisfies typeof ko;

export const LEGAL_CONTENT_BY_LOCALE: Localized<typeof ko> = { ko, en };
