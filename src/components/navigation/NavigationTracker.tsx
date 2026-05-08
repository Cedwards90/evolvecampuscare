import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordNavigation } from '@/lib/navigationHistory';

/**
 * Mounted once inside <BrowserRouter>. Records every in-app location change
 * into the navigation history stack so <BackButton /> can return safely.
 */
export function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    recordNavigation(location.pathname, location.search);
  }, [location.pathname, location.search]);

  return null;
}
