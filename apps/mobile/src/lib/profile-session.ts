export interface ProfileSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ProfileSessionDeps {
  platform: string;
  storage: ProfileSessionStorage;
  resolveCurrentAndroidToken(): Promise<string>;
  unregister(token: string, idempotencyKey: string): Promise<unknown>;
  randomUuid(): string;
  signOut(): Promise<void>;
}

export function registeredPushTokenStorageKey(userId: string): string {
  return `push-token:${userId}`;
}

export async function logoutCurrentDevice(
  userId: string,
  deps: ProfileSessionDeps,
): Promise<void> {
  const storageKey = registeredPushTokenStorageKey(userId);
  const cached = await deps.storage.getItem(storageKey);
  const token = deps.platform !== 'android'
    ? null
    : cached ?? await deps.resolveCurrentAndroidToken();

  if (token !== null) await deps.unregister(token, deps.randomUuid());
  await deps.signOut();
  if (cached !== null) await deps.storage.removeItem(storageKey);
}
