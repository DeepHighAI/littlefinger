import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { renderHomeStaticMarkup } from './src/screens/home-static.ts';

/**
 * 공개 홈(/)의 본문을 `index.html` 에 미리 넣는다. Google OAuth 브랜드 인증의 자동 검사가
 * JavaScript 없이 HTML 만 읽기 때문이다(home-static.ts 참조). `app.html` 은 그대로 빈 셸이라
 * 초대 등 다른 경로에는 홈 문구가 깜빡이지 않는다 — firebase.json 이 `**` 를 `/app.html` 로
 * 재작성한다.
 */
function homePrerender(): Plugin {
  return {
    name: 'lf-home-prerender',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (!context.filename.endsWith('index.html')) return html;
        return html.replace('<div id="root"></div>', `<div id="root">${renderHomeStaticMarkup()}</div>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), homePrerender()],
  // `.env` 는 저장소 루트에 하나뿐이다(`.env.example` 이 VITE_ 두 줄을 거기에 적어 둔다).
  // 기본값이면 Vite 는 apps/web 만 뒤지므로 `VITE_SUPABASE_URL` 이 영영 비고, 증상은
  // 화면이 EC-C02 문구로 떨어지는 것 하나뿐이라 함수 장애와 구분되지 않는다.
  // 노출되는 것은 여전히 `VITE_` 접두사가 붙은 값뿐이다 — service_role 은 이름부터 걸린다.
  envDir: '../../',
  // apps/mobile 은 Expo 가 요구하는 React 버전을 **정확히** 고정한다. 그 값이 웹이 쓰는
  // 값과 갈라지는 순간 npm 이 apps/web 아래에 React 를 한 벌 더 깔고, react-router-dom 은
  // 호이스팅된 쪽을 잡아 "Invalid hook call" 로 죽는다. 타입 검사도 빌드도 통과하고
  // 브라우저에서만 드러나는 종류의 고장이라 여기서 못박는다.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // tsconfig.base.json 의 target 과 맞춘다. 둘이 어긋나면 타입 검사만 통과하고
    // 번들에는 구형 문법이 남는다.
    target: 'es2022',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        app: fileURLToPath(new URL('app.html', import.meta.url)),
      },
    },
  },
});
