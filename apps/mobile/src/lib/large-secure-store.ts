import * as aesjs from 'aes-js';

interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface LargeSecureStoreDeps {
  asyncStorage: AsyncStorageLike;
  secureStore: SecureStoreLike;
  randomBytes(): Uint8Array;
}

export class LargeSecureStore {
  constructor(private readonly deps: LargeSecureStoreDeps) {}

  async getItem(key: string): Promise<string | null> {
    const encrypted = await this.deps.asyncStorage.getItem(key);
    if (encrypted === null) return null;

    const encryptionKeyHex = await this.deps.secureStore.getItemAsync(key);
    if (encryptionKeyHex === null) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(encrypted)));
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = this.deps.randomBytes();
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    // 세션은 SecureStore 한도를 넘는다. 작은 AES 키만 보안 저장소에 두고 원문은 남기지 않는다.
    const previousKey = await this.deps.secureStore.getItemAsync(key);
    await this.deps.secureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    try {
      await this.deps.asyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encrypted));
    } catch (error) {
      try {
        if (previousKey === null) await this.deps.secureStore.deleteItemAsync(key);
        else await this.deps.secureStore.setItemAsync(key, previousKey);
      } catch {
        // 원래 쓰기 실패를 유지한다. 호출자는 같은 값을 다시 저장해 복구한다.
      }
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    const encrypted = await this.deps.asyncStorage.getItem(key);
    await this.deps.asyncStorage.removeItem(key);
    try {
      await this.deps.secureStore.deleteItemAsync(key);
    } catch (error) {
      if (encrypted !== null) {
        try {
          await this.deps.asyncStorage.setItem(key, encrypted);
        } catch {
          // 삭제 실패를 우선 보고한다. 다음 초기 write가 남은 키를 안전하게 교체한다.
        }
      }
      throw error;
    }
  }
}
