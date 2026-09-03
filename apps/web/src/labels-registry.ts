import type { Localized } from '@littlefinger/shared';

import { LEGAL_CONTENT_BY_LOCALE } from './legal/legal-content.ts';
import { ACCOUNT_DELETION_LABEL } from './screens/account-deletion-labels.ts';
import { HOME_LABEL } from './screens/home-labels.ts';
import { RESPONSE_COMPLETE_LABEL } from './screens/response-complete-labels.ts';
import { SCR_W01_LABEL } from './screens/scr-w01-labels.ts';
import { SCR_W02_LABEL } from './screens/scr-w02-labels.ts';
import { SCR_W03_LABEL } from './screens/scr-w03-labels.ts';
import { SCR_W04_LABEL } from './screens/scr-w04-labels.ts';
import { SCR_W05_LABEL } from './screens/scr-w05-labels.ts';
import { SCR_W06_LABEL } from './screens/scr-w06-labels.ts';

/**
 * 수락 웹의 모든 이중언어 카탈로그. 화면 코드가 아니라 **패리티 테스트가** 읽는다 —
 * 카탈로그를 새로 만들고 여기 등록을 잊으면 i18n-parity.test.ts 가 실패한다.
 * `satisfies typeof ko` 는 컴파일 타임 가드고, 이 레지스트리는 그 가드 밖에 남는
 * 런타임 드리프트(키 경로·로케일 키 누락)를 잡는 두 번째 층이다.
 */
export const WEB_LABEL_CATALOGS = {
  SCR_W01_LABEL,
  SCR_W02_LABEL,
  SCR_W03_LABEL,
  SCR_W04_LABEL,
  SCR_W05_LABEL,
  SCR_W06_LABEL,
  RESPONSE_COMPLETE_LABEL,
  LEGAL_CONTENT_BY_LOCALE,
  ACCOUNT_DELETION_LABEL,
  HOME_LABEL,
} satisfies Record<string, Localized<unknown>>;
