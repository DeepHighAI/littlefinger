// 안드로이드 포토 피커의 content:// URI 는 일부 문서 제공자에서 멀티파트 fetch 가 읽지
// 못한다(F7). 업로드 전에 캐시의 file:// 사본으로 바꾸되, 복사 실패가 곧 업로드 불가는
// 아니므로 실패하면 원본 URI 로 그대로 시도한다.
export async function toUploadableEvidenceUri(
  uri: string,
  idempotencyKey: string,
  fileName: string,
): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  try {
    // jest(VM 모듈 플래그 없음)에서도 도는 레이지 로딩은 동적 import 가 아니라 require 다.
    const { File, Paths } =
      require('expo-file-system') as typeof import('expo-file-system');
    const dotIndex = fileName.lastIndexOf('.');
    const extension = dotIndex > 0 ? fileName.slice(dotIndex) : '';
    const destination = new File(
      Paths.cache,
      `evidence-${idempotencyKey}${extension}`,
    );
    // 같은 멱등 키의 재시도가 이전 사본 위에 다시 쓸 수 있어야 한다.
    await new File(uri).copy(destination, { overwrite: true });
    return destination.uri;
  } catch {
    return uri;
  }
}
