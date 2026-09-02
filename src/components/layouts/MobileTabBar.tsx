import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MORE_TAB, mobileTabsForRole } from '@/lib/navigation';
import type { AppRole } from '@/types/database';

interface MobileTabBarProps {
  role: AppRole | null;
  unreadCount?: number;
  onMoreClick: () => void;
}

/**
 * Mobile-first bottom navigation. Shows the 4 primary destinations for the
 * current role plus a "More" tab that opens the full navigation drawer.
 */
export function MobileTabBar({ role, unreadCount = 0, onMoreClick }: MobileTabBarProps) {
  const { pathname } = useLocation();
  const tabs = mobileTabsForRole(role);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  const tabClass = (active: boolean) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
      active ? 'text-primary' : 'text-muted-foreground'
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        const showBadge = tab.href === '/messages' && unreadCount > 0;
        return (
          <Link key={tab.label} to={tab.href} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
            <span className="relative">
              <tab.icon className="h-5 w-5" />
              {showBadge && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span className="w-full truncate text-center">{tab.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMoreClick} className={tabClass(false)}>
        <MORE_TAB.icon className="h-5 w-5" />
        <span className="w-full truncate text-center">{MORE_TAB.label}</span>
      </button>
    </nav>
  );
}
