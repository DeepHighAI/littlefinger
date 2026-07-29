import { Route, Routes } from 'react-router-dom';

import { ROUTE } from './routes.ts';
import { ScrW01InviteLanding } from './screens/scr-w01-invite-landing.tsx';
import { ScrW02PromiseReview } from './screens/scr-w02-promise-review.tsx';
import { ScrW03ApprovalComplete } from './screens/scr-w03-approval-complete.tsx';
import { ScrW06LinkExpired } from './screens/scr-w06-link-expired.tsx';

// 카카오 로그인이 돌아오는 자리는 아직 골격이다. 화면 파일은 SCR-ID 를 파일명으로 갖고
// 한 화면당 한 파일이다(CLAUDE.md §5-4).

function AuthCallbackPlaceholder(): React.JSX.Element {
  return <div className="lf-screen" />;
}


export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path={ROUTE.invite} element={<ScrW01InviteLanding />} />
      <Route path={ROUTE.review} element={<ScrW02PromiseReview />} />
      <Route path={ROUTE.approvalComplete} element={<ScrW03ApprovalComplete />} />
      <Route path={ROUTE.authCallback} element={<AuthCallbackPlaceholder />} />
      {/* 모르는 경로는 존재하지 않는 초대와 같다. 토큰이 붙은 정상 경로에서 오는
          만료·사용됨·취소·차단은 SCR-W01 이 invite-resolve 의 실패 코드를 그대로 넘긴다. */}
      <Route path="*" element={<ScrW06LinkExpired reason="E_NOT_FOUND" />} />
    </Routes>
  );
}
