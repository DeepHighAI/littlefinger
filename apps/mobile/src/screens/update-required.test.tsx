import { fireEvent, render } from '@testing-library/react-native';

import { openAndroidStore } from '../lib/minimum-app-version-native.ts';
import UpdateRequiredScreen from '../app/update-required';

jest.mock('../lib/minimum-app-version-native.ts', () => ({ openAndroidStore: jest.fn() }));

describe('EC-I04 업데이트 차단 화면', () => {
  test('업데이트 안내와 스토어 동작만 제공하며 광고가 없다', async () => {
    const view = await render(<UpdateRequiredScreen />);
    expect(view.getByText('업데이트 후 이용해 주세요.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: '스토어로 이동' }));
    expect(openAndroidStore).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });
});
