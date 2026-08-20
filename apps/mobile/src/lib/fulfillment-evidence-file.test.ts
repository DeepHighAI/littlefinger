const copyMock = jest.fn();

// new File(Paths.cache, name) 합성과 copy 호출만 흉내 낸다.
class FakeFile {
  readonly uri: string;
  copy = copyMock;
  constructor(...parts: Array<string | { uri: string }>) {
    this.uri = parts
      .map((part) => (typeof part === 'string' ? part : part.uri))
      .join('');
  }
}

// isolateModules 는 뒤늦은 레이지 require 를 막으므로 일반 레지스트리에서 로드한다.
function loadModule(): typeof import('./fulfillment-evidence-file.ts') {
  return require('./fulfillment-evidence-file.ts') as typeof import('./fulfillment-evidence-file.ts');
}

describe('toUploadableEvidenceUri', () => {
  beforeEach(() => {
    jest.resetModules();
    copyMock.mockReset();
    jest.doMock('expo-file-system', () => ({
      File: FakeFile,
      Paths: { cache: { uri: 'file:///cache/' } },
    }));
  });

  afterEach(() => {
    jest.dontMock('expo-file-system');
    jest.resetModules();
  });

  it('content:// 자산은 캐시 사본을 만들고 그 file:// 경로를 돌려준다', async () => {
    copyMock.mockResolvedValue(undefined);
    const { toUploadableEvidenceUri } = loadModule();

    const uri = await toUploadableEvidenceUri(
      'content://media/1',
      'key-1',
      'photo.jpg',
    );

    expect(uri).toBe('file:///cache/evidence-key-1.jpg');
    expect(copyMock).toHaveBeenCalledTimes(1);
    expect(copyMock.mock.calls[0]?.[0]?.uri).toBe(
      'file:///cache/evidence-key-1.jpg',
    );
    expect(copyMock.mock.calls[0]?.[1]).toEqual({ overwrite: true });

    // 이미 file:// 인 자산은 복사 없이 그대로 쓴다.
    expect(
      await toUploadableEvidenceUri('file:///pick.jpg', 'key-1', 'pick.jpg'),
    ).toBe('file:///pick.jpg');
    expect(copyMock).toHaveBeenCalledTimes(1);
  });

  it('복사가 실패하면 원본 URI 로 그대로 업로드를 시도한다', async () => {
    copyMock.mockRejectedValue(new Error('EACCES'));
    const { toUploadableEvidenceUri } = loadModule();

    expect(
      await toUploadableEvidenceUri('content://media/2', 'key-2', 'photo.jpg'),
    ).toBe('content://media/2');
  });
});
