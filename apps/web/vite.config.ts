import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
  },
});
