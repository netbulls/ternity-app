const STORAGE_KEY = 'ternity-recent-projects';
const MAX_RECENT = 5;

export function getRecentProjectIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function trackRecentProject(projectId: string) {
  const ids = getRecentProjectIds();
  const updated = [projectId, ...ids.filter((id) => id !== projectId)].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
