let pending = false;

export async function runIntentionalSignOut(
  signOut: () => Promise<void>,
): Promise<void> {
  pending = true;
  try {
    await signOut();
  } catch (error) {
    pending = false;
    throw error;
  }
}

export function consumeIntentionalSignOut(): boolean {
  const intentional = pending;
  pending = false;
  return intentional;
}
