// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { responseCompletePath, RESPONSE_OUTCOME, ROUTE } from '../routes.ts';
import { ResponseComplete } from './response-complete.tsx';

const TOKEN = 'a-b_c-d_e';

function renderAt(path: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTE.responseComplete} element={<ResponseComplete />} />
      </Routes>
    </MemoryRouter>,
  );
}

// vitest `globals` 가 꺼져 있어 Testing Library 의 자동 cleanup 이 등록되지 않는다.
afterEach(cleanup);

describe('거절·수정 제안 종결 화면', () => {
  it.each([
    [RESPONSE_OUTCOME.declined, '거절했어요. 작성자에게 알려드릴게요.'],
    [
      RESPONSE_OUTCOME.amendSuggested,
      '수정 제안을 보냈어요. 작성자가 내용을 고쳐 다시 보내면 알림을 받게 돼요.',
    ],
  ])('%s 는 PO 승인 문구를 그대로 그린다', (outcome, message) => {
    // 이 두 문장이 이 화면의 전부다(PO 2026-07-29). 한 글자라도 다르면 여기서 깨진다.
    renderAt(responseCompletePath(TOKEN, outcome));

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe(message);
    expect(screen.getByTestId('outcome-message')).toBe(heading);
  });

  it('두 결과가 서로 다른 문장을 쓴다', () => {
    // 하나로 뭉치면 "거절했는데 수정 제안했다고 나오는" 사고가 테스트를 통과한다.
    renderAt(responseCompletePath(TOKEN, RESPONSE_OUTCOME.declined));
    const declined = screen.getByTestId('outcome-message').textContent;
    cleanup();

    renderAt(responseCompletePath(TOKEN, RESPONSE_OUTCOME.amendSuggested));
    expect(screen.getByTestId('outcome-message').textContent).not.toBe(declined);
  });

  it('모르는 결과값은 없는 주소와 같이 다룬다', () => {
    // 주소를 손으로 고쳐 들어온 경우다. 설명할 문구가 없으니 지어내지 않는다.
    renderAt(`/i/${TOKEN}/responded/whatever`);

    expect(screen.getByTestId('reason').textContent).toBe('초대 링크를 찾을 수 없습니다.');
    expect(screen.queryByTestId('outcome-message')).toBeNull();
  });

  it('건너오자마자 문장이 포커스를 받는다', () => {
    // SCR-W02 가 `replace` 로 넘기면 눌렀던 버튼이 사라지고 포커스는 body 로 떨어진다.
    // 그러면 스크린리더는 화면이 바뀐 것도, 이 문장도 읽지 않는다.
    renderAt(responseCompletePath(TOKEN, RESPONSE_OUTCOME.declined));

    expect(document.activeElement).toBe(screen.getByTestId('outcome-message'));
  });

  it('광고도 CTA 도 없다', () => {
    // 수락 웹 전체에 광고가 없고(CLAUDE.md §8-1), 이 화면에서 갈 곳은 아직 없다 —
    // 있는 척하는 버튼은 문구도 목적지도 승인받지 않았다.
    const { container } = renderAt(responseCompletePath(TOKEN, RESPONSE_OUTCOME.declined));

    expect(container.querySelector('ins, iframe, .lf-ad, .lf-ad-slot')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
