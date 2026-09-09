import { useLocation } from 'react-router-dom';
import { INVITE_ACCOUNT_LABEL } from '@littlefinger/shared';
import { useState, type ReactNode } from 'react';

import { useLabels } from '../lib/locale.tsx';
import { getSupabase } from '../lib/supabase.ts';
import { useInviteAccount } from '../lib/use-invite-account.ts';

function InviteAccountConfirmation({ children }: { children: ReactNode }): React.JSX.Element {
  const L = useLabels(INVITE_ACCOUNT_LABEL);
  const account = useInviteAccount();
  const [busy, setBusy] = useState(false);
  async function changeAccount(): Promise<void> {
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signOut({ scope: 'local' });
      if (error !== null) throw error;
    } catch { account.setError(true); }
    finally { setBusy(false); }
  }
  if (!account.error && (account.session === null || account.confirmed)) return <>{children}</>;
  return (
    <div className="lf-screen lf-account-confirm">
      <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-7">
        <h1 className="lf-title">{L.title}</h1>
        {account.error ? <p role="alert">{L.error}</p> : account.session === undefined ? (
          <div role="status" aria-busy="true" />
        ) : (
          <>
            <div className="lf-card lf-card--web lf-card--fill">
              <p className="lf-eyebrow">{L.provider[account.provider]}</p>
              <p className="lf-title">{account.nickname ?? L.fallback}</p>
            </div>
            <p className="lf-body--secondary">{L.body}</p>
          </>
        )}
      </div>
      <div className="lf-screen__actions lf-screen__actions--web">
        {account.error ? (
          <button className="lf-btn lf-btn--filled lf-btn--block" onClick={account.retry}>{L.retry}</button>
        ) : account.session !== undefined ? (
          <>
            <button className="lf-btn lf-btn--filled lf-btn--block" disabled={busy || !account.ready} onClick={account.confirm}>{L.continue}</button>
            <button className="lf-btn lf-btn--outlined lf-btn--block" disabled={busy} onClick={() => void changeAccount()}>{L.change}</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function InviteAccountGate({ children }: { children: ReactNode }): React.JSX.Element {
  const { pathname } = useLocation();
  return <InviteAccountConfirmation key={pathname}>{children}</InviteAccountConfirmation>;
}
