// In-memory navigation history with scroll position capture.
// Singleton stack used by <NavigationTracker /> and <BackButton />.

export interface NavEntry {
  pathname: string;
  search: string;
  scrollY: number;
  timestamp: number;
}

const MAX_ENTRIES = 30;
const stack: NavEntry[] = [];

export function recordNavigation(pathname: string, search: string) {
  // Stamp scroll on the previous entry before pushing the new one.
  if (stack.length > 0) {
    stack[stack.length - 1].scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  }
  // Avoid consecutive duplicates of same path+search.
  const last = stack[stack.length - 1];
  if (last && last.pathname === pathname && last.search === search) return;
  stack.push({ pathname, search, scrollY: 0, timestamp: Date.now() });
  if (stack.length > MAX_ENTRIES) stack.shift();
}

/** Most recent entry whose pathname differs from the current path. */
export function getPreviousEntry(currentPath: string): NavEntry | null {
  for (let i = stack.length - 2; i >= 0; i--) {
    if (stack[i].pathname !== currentPath) return stack[i];
  }
  return null;
}

export function getStackSize() {
  return stack.length;
}
