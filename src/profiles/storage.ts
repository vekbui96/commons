/**
 * The chosen profile's id, remembered on this device. Wrapped in try/catch
 * like src/ui/theme.ts: private windows and blocked storage must still render
 * (the choice then lasts for this page view only).
 */
export const PROFILE_STORAGE_KEY = "commons.profile";

export function readProfileId(): string | undefined {
  try {
    return localStorage.getItem(PROFILE_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveProfileId(id: string): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, id);
  } catch {
    // Storage unavailable.
  }
}

export function clearProfileId(): void {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }
}
