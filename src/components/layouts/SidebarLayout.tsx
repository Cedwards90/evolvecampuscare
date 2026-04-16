import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Clock, 
  WifiOff, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  ChevronRight,
  Globe,
  Search,
  HelpCircle,
  Shield,
  MessageSquare,
  FolderOpen,
  Building2,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOffline } from '@/contexts/OfflineContext';
import { useUnreadCount } from '@/hooks/useMessages';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
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
import { cn } from '@/lib/utils';
import type { AppRole } from '@/types/database';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  children?: NavItem[];
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['student', 'case_manager', 'admin'] },
  { label: 'Submit Request', href: '/student-submitting-a-support-request', icon: FileText, roles: ['student'] },
  { label: 'Track Requests', href: '/student-tracking-request-status-scheduling-meeting', icon: Clock, roles: ['student'] },
  { label: 'Offline Drafts', href: '/student-creating-offline-draft-request', icon: WifiOff, roles: ['student'] },
  { label: 'Manage Requests', href: '/case-manager-managing-student-requests', icon: Users, roles: ['case_manager'] },
  { label: 'Student Folders', href: '/student-folders', icon: FolderOpen, roles: ['case_manager', 'admin'] },
  { label: 'Messages', href: '/messages', icon: MessageSquare, roles: ['student', 'case_manager', 'admin'] },
  { label: 'Admin Dashboard', href: '/admin-monitoring-reassigning-requests', icon: BarChart3, roles: ['admin'] },
  { label: 'User Management', href: '/admin/users', icon: Shield, roles: ['admin'] },
  { label: 'Organizations', href: '/admin/organizations', icon: Building2, roles: ['admin'] },
  { label: 'Surveys', href: '/admin/surveys', icon: ClipboardList, roles: ['case_manager', 'admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['student', 'case_manager', 'admin'] },
];

const bottomNavItems: NavItem[] = [
  { label: 'Help Center', href: '/support', icon: HelpCircle, roles: ['student', 'case_manager', 'admin'] },
];

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, role, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { isOnline } = useOffline();
  const location = useLocation();
  const { data: unreadCount } = useUnreadCount();
  
  // Enable real-time message notifications for staff
  useRealtimeMessages();

  const filteredNavItems = navItems.filter(item => role && item.roles.includes(role)).map(item => {
    if (item.href === '/messages' && unreadCount && unreadCount > 0) {
      return { ...item, badge: unreadCount };
    }
    return item;
  });
  const filteredBottomNavItems = bottomNavItems.filter(item => role && item.roles.includes(role));

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border/40 bg-card transition-all duration-300 hidden lg:flex flex-col",
          sidebarCollapsed ? "w-[70px]" : "w-[260px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-border/40 px-4">
          <img 
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp" 
            alt="Evolve Foundation" 
            className={cn("w-auto transition-all", sidebarCollapsed ? "h-7" : "h-8")}
          />
        </div>

        {/* Navigation Label */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Navigation
            </span>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0 transition-transform duration-200" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                      {!item.badge && <ChevronRight className="h-4 w-4 opacity-50" />}
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-border/40 p-3">
          {filteredBottomNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:translate-x-1",
                sidebarCollapsed && "justify-center hover:translate-x-0"
              )}
            >
              <item.icon className="h-5 w-5" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}

          {/* Promo Card */}
          {!sidebarCollapsed && (
            <div className="mt-4 rounded-lg border border-border/40 bg-muted/50 p-4 text-center">
              <div className="mb-2 flex justify-center">
                <div className="rounded-full bg-primary/10 p-2">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h4 className="text-sm font-semibold">Support Center</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Get help and support for any academic or personal issues.
              </p>
              <Button size="sm" className="mt-3 w-full" asChild>
                <Link to="/support">Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-[260px] border-r border-border/40 bg-card transition-transform duration-300 lg:hidden flex flex-col",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-border/40 px-4">
          <img 
            src="https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp" 
            alt="Evolve Foundation" 
            className="h-8 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        sidebarCollapsed ? "lg:ml-[70px]" : "lg:ml-[260px]"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-1 sm:gap-3 border-b border-border/40 bg-card px-2 sm:px-4 lg:px-6">
          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden flex-shrink-0"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Sidebar Toggle (Desktop) */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex flex-shrink-0"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
            <span className="font-semibold truncate">
              {(() => {
                const allNavItems = [...navItems, ...bottomNavItems];
                const match = allNavItems.find(item => location.pathname === item.href);
                return match?.label || 'Dashboard';
              })()}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search - desktop only */}
          <div className="hidden lg:flex relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-muted/50 border-0"
            />
          </div>

          {/* Offline indicator */}
          {!isOnline && <OfflineIndicator />}

          {/* Language selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('es')}>
                Español
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <NotificationsDropdown />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
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
                  <span className="text-xs text-muted-foreground capitalize mt-1">
                    {role?.replace('_', ' ')}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
