import { backOrHome } from './back-or-home.ts';

test.each([true, false])('뒤로가기 이력 유무(%s)에 따라 이전 화면 또는 홈으로 이동한다', (canGoBack) => {
  const router = { canGoBack: () => canGoBack, back: jest.fn(), replace: jest.fn() };
  backOrHome(router);
  if (canGoBack) {
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  } else {
    expect(router.replace).toHaveBeenCalledWith('/home');
    expect(router.back).not.toHaveBeenCalled();
  }
});
