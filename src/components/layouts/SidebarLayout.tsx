import { useState, useEffect } from 'react';
import { ChevronDown, Globe, LogOut, Menu, Search, Settings, Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOffline } from '@/contexts/OfflineContext';
import { useUnreadCount } from '@/hooks/useMessages';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { useRealtimeStudentAssignments } from '@/hooks/useRealtimeStudentAssignments';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { HelpButton } from '@/components/navigation/HelpButton';
import { MobileTabBar } from '@/components/layouts/MobileTabBar';
import { cn } from '@/lib/utils';
import {
  BOTTOM_NAV_ITEMS,
  FALLBACK_NAV_ITEMS,
  labelForPath,
  navGroupsForRole,
  type NavGroup,
  type NavItem,
} from '@/lib/navigation';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, role, roleError, isLoading, signOut, refreshProfile } = useAuth();
  const { setLanguage } = useLanguage();
  const { isOnline } = useOffline();
  const location = useLocation();
  const { data: unreadCount } = useUnreadCount();

  // Enable real-time message notifications for staff
  useRealtimeMessages();
  useRealtimeStudentAssignments(role === 'case_manager' ? user?.id : undefined);

  const withBadge = (item: NavItem): NavItem =>
    item.href === '/messages' && unreadCount && unreadCount > 0 ? { ...item, badge: unreadCount } : item;

  const filteredNavGroups: NavGroup[] = navGroupsForRole(role).map((group) => ({
    ...group,
    items: group.items.map(withBadge),
  }));

  const flatNavItems: NavItem[] = role
    ? filteredNavGroups.flatMap((g) => g.items)
    : FALLBACK_NAV_ITEMS;

  const filteredBottomNavItems = BOTTOM_NAV_ITEMS.filter((item) => role && item.roles.includes(role));

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isActive = (href: string) => location.pathname === href;

  // Track which nav groups are open. Persists per browser.
  const STORAGE_KEY = 'sidebar:openGroups';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Auto-open the group that contains the active route.
  useEffect(() => {
    const active = filteredNavGroups.find((g) => g.items.some((i) => isActive(i.href)));
    if (active && !openGroups[active.id]) {
      setOpenGroups((prev) => ({ ...prev, [active.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, role]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderNavLink = (item: NavItem, onClick?: () => void, compact = false) => (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive(item.href)
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && item.badge > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  const roleNotice = (
    <div className="mb-3 rounded-lg border border-border/40 bg-muted/40 p-3 text-xs text-muted-foreground">
      {roleError ? (
        <>
          <p className="mb-2">We couldn't load your account permissions.</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => refreshProfile()}>
            Retry
          </Button>
        </>
      ) : (
        <p>Your account is being set up. Please contact an administrator if this persists.</p>
      )}
    </div>
  );

  const renderGroups = (onNavigate?: () => void) => (
    <div className="space-y-3">
      {filteredNavGroups.map((group) => {
        if (group.items.length === 1) {
          return (
            <ul key={group.id} className="space-y-1">
              <li>{renderNavLink(group.items[0], onNavigate)}</li>
            </ul>
          );
        }
        const isOpen = openGroups[group.id] ?? false;
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <span>{group.label}</span>
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90')}
              />
            </button>
            {isOpen && (
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>{renderNavLink(item, onNavigate)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  const navSkeleton = (
    <ul className="space-y-1">
      {[...Array(6)].map((_, i) => (
        <li key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-screen max-w-full overflow-x-hidden bg-muted/30">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border/40 bg-card transition-all duration-300 md:flex',
          sidebarCollapsed ? 'w-[70px]' : 'w-[260px]'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-border/40 px-4">
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className={cn('w-auto transition-all', sidebarCollapsed ? 'h-7' : 'h-8')}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {isLoading ? (
            navSkeleton
          ) : (
            <>
              {!role && !sidebarCollapsed && roleNotice}
              {sidebarCollapsed || !role ? (
                <ul className="space-y-1">
                  {flatNavItems.map((item) => (
                    <li key={item.href}>{renderNavLink(item, undefined, sidebarCollapsed)}</li>
                  ))}
                </ul>
              ) : (
                renderGroups()
              )}
            </>
          )}
        </nav>

        <div className="border-t border-border/40 p-3">
          {filteredBottomNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <item.icon className="h-5 w-5" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer ("More") */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-border/40 bg-card transition-transform duration-300 md:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-border/40 px-4">
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className="h-8 w-auto"
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {isLoading ? (
            navSkeleton
          ) : (
            <>
              {!role && roleNotice}
              {!role ? (
                <ul className="space-y-1">
                  {flatNavItems.map((item) => (
                    <li key={item.href}>{renderNavLink(item, () => setMobileMenuOpen(false))}</li>
                  ))}
                </ul>
              ) : (
                renderGroups(() => setMobileMenuOpen(false))
              )}
            </>
          )}
        </nav>

        <div className="border-t border-border/40 p-3">
          {filteredBottomNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start gap-3 px-3 text-destructive hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn(
          'w-full min-w-0 max-w-full overflow-x-hidden transition-all duration-300',
          sidebarCollapsed ? 'md:ml-[70px] md:w-[calc(100%-70px)]' : 'md:ml-[260px] md:w-[calc(100%-260px)]'
        )}
      >
        {/* Top header — slim on mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border/40 bg-card px-2 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="hidden flex-shrink-0 md:flex"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobile: logo instead of a menu button (navigation lives in the bottom tab bar) */}
          <img
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp"
            alt="Evolve Foundation"
            className="h-7 w-auto md:hidden"
          />

          <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
            <span className="truncate font-semibold">{labelForPath(location.pathname)}</span>
          </div>

          <div className="flex-1" />

          <div className="relative hidden w-64 md:flex">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="border-0 bg-muted/50 pl-9" />
          </div>

          {!isOnline && <OfflineIndicator />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="Change language">
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('es')}>Español</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden sm:block">
            <HelpButton />
          </div>

          <NotificationsDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{profile?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                  <span className="mt-1 text-xs capitalize text-muted-foreground">{role?.replace('_', ' ')}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/support" className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  Help Center
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content — extra bottom padding so the mobile tab bar never covers it */}
        <main className="safe-content min-w-0 max-w-full overflow-x-hidden p-3 pb-24 sm:p-4 md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      <MobileTabBar role={role} unreadCount={unreadCount ?? 0} onMoreClick={() => setMobileMenuOpen(true)} />
      <PlatformAssistant />
    </div>
  );
}
