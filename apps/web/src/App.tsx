import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import { LocaleSwitch } from './components/LocaleSwitch.tsx';
import { LocaleProvider } from './lib/locale.tsx';
import { watchSignInProvision } from './lib/user-provision.ts';
import { ROUTE } from './routes.ts';
import { AccountDeletion } from './screens/account-deletion.tsx';
import { Home } from './screens/home.tsx';
import { ResponseComplete } from './screens/response-complete.tsx';
import { LegalDocument } from './screens/legal-document.tsx';
import { ScrW01InviteLanding } from './screens/scr-w01-invite-landing.tsx';
import { ScrW02PromiseReview } from './screens/scr-w02-promise-review.tsx';
import { ScrW03ApprovalComplete } from './screens/scr-w03-approval-complete.tsx';
import { ScrW04ParticipantPromises } from './screens/scr-w04-participant-promises.tsx';
import { ScrW05WitnessConfirm } from './screens/scr-w05-witness-confirm.tsx';
import { ScrW06LinkExpired } from './screens/scr-w06-link-expired.tsx';

// 카카오 로그인이 돌아오는 자리는 아직 골격이다. 화면 파일은 SCR-ID 를 파일명으로 갖고
// 한 화면당 한 파일이다(CLAUDE.md §5-4).

function AuthCallbackPlaceholder(): React.JSX.Element {
  return <div className="lf-screen" />;
}


export function App(): React.JSX.Element {
  // 화면이 아니라 App 이 건다 — OAuth 리다이렉트가 돌아오는 화면이 늘어도(지금은 SCR-W01
  // 뿐이다) 로그인 직후의 users 행 보정이 빠지지 않는다.
  useEffect(() => watchSignInProvision(), []);

  return (
    <LocaleProvider>
    <Routes>
      <Route path={ROUTE.home} element={<Home />} />
      <Route path={ROUTE.terms} element={<LegalDocument kind="TERMS" />} />
      <Route path={ROUTE.privacy} element={<LegalDocument kind="PRIVACY" />} />
      <Route path={ROUTE.accountDeletion} element={<AccountDeletion />} />
      <Route path={ROUTE.invite} element={<ScrW01InviteLanding />} />
      <Route path={ROUTE.review} element={<ScrW02PromiseReview />} />
      <Route path={ROUTE.witnessJoin} element={<ScrW05WitnessConfirm />} />
      <Route path={ROUTE.witness} element={<ScrW05WitnessConfirm />} />
      <Route path={ROUTE.approvalComplete} element={<ScrW03ApprovalComplete />} />
      <Route path={ROUTE.promises} element={<ScrW04ParticipantPromises />} />
      {/* 거절·수정 제안 종결. SCR-ID 가 없어 파일명이 하는 일을 말한다(그 파일의 주석 참조). */}
      <Route path={ROUTE.responseComplete} element={<ResponseComplete />} />
      <Route path={ROUTE.authCallback} element={<AuthCallbackPlaceholder />} />
      {/* 모르는 경로는 존재하지 않는 초대와 같다. 토큰이 붙은 정상 경로에서 오는
          만료·사용됨·취소·차단은 SCR-W01 이 invite-resolve 의 실패 코드를 그대로 넘긴다. */}
      <Route path="*" element={<ScrW06LinkExpired reason="E_NOT_FOUND" />} />
    </Routes>
    {/* 모든 화면 위의 고정 오버레이 — .lf-screen 이 absolute 전면이라 여기서만 얹을 수 있다. */}
    <LocaleSwitch />
    </LocaleProvider>
  );
}
