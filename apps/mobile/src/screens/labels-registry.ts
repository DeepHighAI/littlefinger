import type { Localized } from '@littlefinger/shared';

import { BLOCKED_USERS_LABEL } from './blocked-users-labels.ts';
import { INVITE_LABEL } from './invite-labels.ts';
import { INVITE_REVIEW_LABEL } from './invite-review-labels.ts';
import { LOGIN_LABEL } from './login-labels.ts';
import { MOBILE_CHROME_LABEL } from './mobile-chrome-labels.ts';
import { MOD_02_LABEL } from './mod-02-labels.ts';
import { MOD_03_LABEL } from './mod-03-completion-celebration-labels.ts';
import { NOT_FOUND_LABEL } from './not-found-labels.ts';
import { ONBOARDING_LABEL } from './onboarding-labels.ts';
import { PROFILE_NICKNAME_LABEL } from './profile-nickname-labels.ts';
import { PROMISE_EDIT_LABEL } from './promise-edit-labels.ts';
import { SCR_A02_LABEL } from './scr-a02-labels.ts';
import { MOD_01_LABEL, SCR_A05_LABEL } from './scr-a05-labels.ts';
import { SCR_A06_LABEL } from './scr-a06-labels.ts';
import { SCR_A07_LABEL, SCR_A07_NOTIFICATION_SEMANTIC_LABEL } from './scr-a07-labels.ts';
import { SCR_A08_LABEL } from './scr-a08-labels.ts';
import { SCR_A09_LABEL } from './scr-a09-labels.ts';
import { SLOT_LABEL } from './slot-labels.ts';
import { UPDATE_REQUIRED_LABEL } from './update-required-labels.ts';

/**
 * 앱의 모든 이중언어 카탈로그. 화면 코드가 아니라 **패리티 테스트가** 읽는다 —
 * `*-labels.ts` 를 새로 만들고 여기 등록을 잊으면 i18n-parity.test.ts 가 실패한다.
 * 웹 `apps/web/src/labels-registry.ts` 와 같은 규칙의 앱 쪽 거울이다.
 */
export const MOBILE_LABEL_CATALOGS = {
  BLOCKED_USERS_LABEL,
  INVITE_LABEL,
  INVITE_REVIEW_LABEL,
  LOGIN_LABEL,
  MOBILE_CHROME_LABEL,
  MOD_01_LABEL,
  MOD_02_LABEL,
  MOD_03_LABEL,
  NOT_FOUND_LABEL,
  ONBOARDING_LABEL,
  PROFILE_NICKNAME_LABEL,
  PROMISE_EDIT_LABEL,
  SCR_A02_LABEL,
  SCR_A05_LABEL,
  SCR_A06_LABEL,
  SCR_A07_LABEL,
  SCR_A07_NOTIFICATION_SEMANTIC_LABEL,
  SCR_A08_LABEL,
  SCR_A09_LABEL,
  SLOT_LABEL,
  UPDATE_REQUIRED_LABEL,
} satisfies Record<string, Localized<unknown>>;
