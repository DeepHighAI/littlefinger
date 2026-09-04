interface SafeQueryString {
  parse(value: string): Record<string, string | string[] | null>;
  stringify(
    value: Record<string, unknown>,
    options?: { sort?: boolean | ((left: string, right: string) => number) },
  ): string;
}

const queryString = require('./query-string-safe.js') as SafeQueryString;
const { createSafeQueryStringResolver } = require('../../metro.safe-query-resolver.js') as {
  createSafeQueryStringResolver: (projectRoot: string) => (
    context: { resolveRequest: () => unknown },
    moduleName: string,
    platform: string,
  ) => unknown;
};

describe('외부 딥링크 쿼리 파서', () => {
  test('Expo Router의 query-string 요청을 안전한 로컬 파서로 치환한다', () => {
    const resolveRequest = createSafeQueryStringResolver('C:/mobile');
    const resolved = resolveRequest(
      { resolveRequest: () => null },
      'query-string',
      'android',
    );

    expect(resolved).toMatchObject({
      type: 'sourceFile',
      filePath: expect.stringMatching(/query-string-safe\.js$/u),
    });
  });

  test('정상 파라미터와 중복 키를 기존 형식으로 파싱한다', () => {
    expect(queryString.parse('?token=a%20b&tag=one&tag=two')).toEqual({
      token: 'a b',
      tag: ['one', 'two'],
    });
    expect(queryString.stringify({ token: 'a b', tag: ['one', 'two'] }, { sort: false }))
      .toBe('token=a%20b&tag=one&tag=two');
  });

  test('깨진 인코딩과 과도하게 긴 입력을 예외 없이 거부한다', () => {
    expect(queryString.parse('token=%E0%A4%A')).toEqual({ token: '%E0%A4%A' });
    expect(queryString.parse(`token=${'a'.repeat(8192)}`)).toEqual({});
  });
});
