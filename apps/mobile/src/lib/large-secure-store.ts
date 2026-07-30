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
    await this.deps.secureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    await this.deps.asyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encrypted));
  }

  async removeItem(key: string): Promise<void> {
    await this.deps.asyncStorage.removeItem(key);
    await this.deps.secureStore.deleteItemAsync(key);
  }
}
