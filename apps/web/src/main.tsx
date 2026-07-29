import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.tsx';

// 순서가 의미를 갖는다: 토큰 → 기본 → 컴포넌트 → 화면별.
// 뒤에 오는 파일이 앞의 값을 덮으므로, 이 순서가 바뀌면 화면별 규칙이 컴포넌트 기본값에
// 먹힌다. design-reference 의 HTML 도 같은 순서로 링크한다.
// 원본 tokens.css 가 Google CDN 에서 받아오던 둘. 이제 둘 다 자체 호스팅이다(04 §5-3).
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';

import './styles/tokens.css';
import './styles/icons.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens/web.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root 가 없다. index.html 이 바뀌었는지 확인한다.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
