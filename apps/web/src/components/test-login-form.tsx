import { useState } from 'react';

import { signInWithTestAccount } from '../lib/web-auth.ts';

const TITLE_LABEL = '테스트 로그인 (개발 서버 전용)';
const EMAIL_LABEL = '테스트 이메일';
const PASSWORD_LABEL = '테스트 비밀번호';
const SUBMIT_LABEL = '테스트 계정으로 로그인';
const ERROR_LABEL = '테스트 로그인에 실패했습니다. 계정 정보를 확인해 주세요.';

/**
 * 테스트 전용 이메일 로그인 폼. `import.meta.env.DEV` 가 아닐 때는 null 을
 * 반환하므로 `vite build` 산출물(배포 웹)에는 절대 렌더되지 않는다.
 *
 * 로그인 성공 시 새로고침한다 — 카카오 경로는 리다이렉트 복귀로 화면이 세션을
 * 다시 읽지만, 비밀번호 로그인은 제자리라서 각 화면의 세션 초기화 로직을
 * 다시 태우는 가장 값싼 방법이 새로고침이다. 테스트 전용이므로 충분하다.
 */
export function TestLoginForm(): React.JSX.Element | null {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // vitest(MODE='test')에서도 숨긴다 — 화면 테스트는 제품 화면만 봐야 하고,
  // 이 폼의 동작은 자기 테스트가 MODE 를 development 로 스텁해 검증한다.
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return null;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFailed(false);
    try {
      await signInWithTestAccount(email.trim(), password);
      window.location.reload();
    } catch {
      setSubmitting(false);
      setFailed(true);
    }
  }

  return (
    <form className="lf-stack lf-gap-3" onSubmit={(event) => void handleSubmit(event)}>
      <p className="lf-caption lf-text-center">{TITLE_LABEL}</p>
      <input
        className="lf-input"
        type="email"
        aria-label={EMAIL_LABEL}
        placeholder={EMAIL_LABEL}
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        className="lf-input"
        type="password"
        aria-label={PASSWORD_LABEL}
        placeholder={PASSWORD_LABEL}
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button
        className="lf-btn lf-btn--outlined lf-btn--block"
        type="submit"
        disabled={submitting || email.trim() === '' || password === ''}
      >
        {SUBMIT_LABEL}
      </button>
      {failed && (
        <p className="lf-caption lf-text-center" role="alert">
          {ERROR_LABEL}
        </p>
      )}
    </form>
  );
}
