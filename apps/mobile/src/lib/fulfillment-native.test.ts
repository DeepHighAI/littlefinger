describe('fulfillment native module loading', () => {
  it('does not load the image picker before the user selects evidence', async () => {
    jest.doMock('expo-image-picker', () => {
      throw new Error('ExponentImagePicker is unavailable');
    });
    jest.doMock('./mobile-api-native.ts', () => ({
      callMobileFunctionNative: jest.fn(),
      callMobileMultipartFunctionNative: jest.fn(),
      currentMobileUserId: jest.fn(),
    }));
    jest.doMock('./supabase-native.ts', () => ({
      getMobileEncryptedStorage: () => ({
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      }),
    }));

    expect(() => {
      jest.isolateModules(() => {
        const module =
          require('./fulfillment-native.ts') as typeof import('./fulfillment-native.ts');
        expect(module.loadFulfillmentDetail).toEqual(expect.any(Function));
      });
    }).not.toThrow();
  });
});
