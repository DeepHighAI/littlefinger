const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

export function asMinimumAppVersion(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const version = (value as Record<string, unknown>)['value'];
  return typeof version === 'string' && VERSION_PATTERN.test(version) ? version : null;
}

function versionParts(value: string): readonly number[] | null {
  if (!VERSION_PATTERN.test(value)) return null;
  return value.split('.').map(Number);
}

export function isAppVersionOutdated(current: string, minimum: string): boolean {
  const currentParts = versionParts(current);
  const minimumParts = versionParts(minimum);
  if (currentParts === null || minimumParts === null) return false;
  for (let index = 0; index < 3; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (currentPart !== minimumPart) return currentPart < minimumPart;
  }
  return false;
}
