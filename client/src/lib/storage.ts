/**
 * localStorage can throw (private mode, disabled storage, quota). The app must keep working
 * without it, so every access is wrapped and failures fall back silently.
 */
export const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not persisted; the in-memory state still applies for this session.
  }
};
