const STORAGE_KEY = 'akansha-session-titles';
export const CHAT_SESSION_TITLES_UPDATED = 'akansha-session-titles-updated';

export function readSessionTitles(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSessionTitle(sessionId: string, title: string) {
  if (typeof window === 'undefined') return;

  const normalizedTitle = title.trim();
  const titles = readSessionTitles();

  if (!normalizedTitle) {
    delete titles[sessionId];
  } else {
    titles[sessionId] = normalizedTitle;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
  window.dispatchEvent(
    new CustomEvent(CHAT_SESSION_TITLES_UPDATED, {
      detail: {
        sessionId,
        title: normalizedTitle,
      },
    })
  );
}

export function getSessionTitle(sessionId: string, fallbackTitle: string) {
  const titles = readSessionTitles();
  return titles[sessionId] || fallbackTitle;
}
