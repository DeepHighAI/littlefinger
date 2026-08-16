import * as aesjs from 'aes-js';

const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/u;

function secureStoreKey(key: string): string {
  if (key.length > 0 && SECURE_STORE_KEY_PATTERN.test(key)) return key;
  return `lf.${aesjs.utils.hex.fromBytes(aesjs.utils.utf8.toBytes(key))}`;
}

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

    const encryptionKeyHex = await this.deps.secureStore.getItemAsync(secureStoreKey(key));
    if (encryptionKeyHex === null) return null;

    const parts = encrypted.split(':');
    let counter = new aesjs.Counter(1);
    let ciphertextHex = encrypted;
    if (parts[0] === 'v2') {
      const counterHex = parts[1];
      const versionedCiphertextHex = parts[2];
      if (parts.length !== 3 || counterHex === undefined || versionedCiphertextHex === undefined) {
        throw new Error('Invalid encrypted value');
      }
      counter = new aesjs.Counter(aesjs.utils.hex.toBytes(counterHex));
      ciphertextHex = versionedCiphertextHex;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), counter);
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(ciphertextHex)));
  }

  async setItem(key: string, value: string): Promise<void> {
    const secureKey = secureStoreKey(key);
    const existingKeyHex = await this.deps.secureStore.getItemAsync(secureKey);
    const encryptionKey =
      existingKeyHex === null
        ? this.deps.randomBytes()
        : Uint8Array.from(aesjs.utils.hex.toBytes(existingKeyHex));
    const counterBytes = this.deps.randomBytes().slice(0, 16);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(counterBytes));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    // 갱신 중 앱이 종료돼도 마지막 암호문과 키의 조합이 깨지지 않도록 기존 키를 유지한다.
    if (existingKeyHex === null) {
      await this.deps.secureStore.setItemAsync(
        secureKey,
        aesjs.utils.hex.fromBytes(encryptionKey),
      );
    }
    await this.deps.asyncStorage.setItem(
      key,
      `v2:${aesjs.utils.hex.fromBytes(counterBytes)}:${aesjs.utils.hex.fromBytes(encrypted)}`,
    );
  }

  async removeItem(key: string): Promise<void> {
    const encrypted = await this.deps.asyncStorage.getItem(key);
    await this.deps.asyncStorage.removeItem(key);
    try {
      await this.deps.secureStore.deleteItemAsync(secureStoreKey(key));
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
