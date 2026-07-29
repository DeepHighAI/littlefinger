import { Route, Routes, useParams } from 'react-router-dom';

import { ROUTE } from './routes.ts';

// ── 아래 셋은 골격 확인용 자리표시자다. SCR-W01/W06 이 들어오면 대체된다.
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

function NotFoundPlaceholder(): React.JSX.Element {
  return (
    <div className="lf-screen">
      <p className="lf-caption" data-testid="not-found">
        링크를 찾을 수 없어요.
      </p>
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path={ROUTE.invite} element={<InvitePlaceholder />} />
      <Route path={ROUTE.authCallback} element={<AuthCallbackPlaceholder />} />
      <Route path="*" element={<NotFoundPlaceholder />} />
    </Routes>
  );
}
