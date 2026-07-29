import { Route, Routes, useParams } from 'react-router-dom';

import { ROUTE } from './routes.ts';
import { ScrW06LinkExpired } from './screens/scr-w06-link-expired.tsx';

// ── 아래 둘은 골격 확인용 자리표시자다. SCR-W01 이 들어오면 대체된다.
// 화면 파일은 SCR-ID 를 파일명으로 갖고 한 화면당 한 파일이다(CLAUDE.md §5-4).

function InvitePlaceholder(): React.JSX.Element {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="lf-screen">
      <p className="lf-caption" data-testid="invite-token">
        {token}
      </p>
    </div>
  );
}

function AuthCallbackPlaceholder(): React.JSX.Element {
  return <div className="lf-screen" />;
}


export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path={ROUTE.invite} element={<InvitePlaceholder />} />
      <Route path={ROUTE.authCallback} element={<AuthCallbackPlaceholder />} />
      {/* 모르는 경로는 존재하지 않는 초대와 같다. 토큰이 붙은 정상 경로에서 오는
          만료·사용됨·취소·차단은 SCR-W01 이 invite-resolve 의 실패 코드를 그대로 넘긴다. */}
      <Route path="*" element={<ScrW06LinkExpired reason="E_NOT_FOUND" />} />
    </Routes>
  );
}
