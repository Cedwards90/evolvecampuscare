import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  FileText, 
  UserPlus, 
  AlertTriangle,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useNotifications, 
  useUnreadNotificationCount, 
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification 
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  request_created: FileText,
  new_request: FileText,
  unassigned_request: UserPlus,
  request_assigned: UserPlus,
  status_change: AlertTriangle,
  emergency: AlertTriangle,
  message: MessageSquare,
  appointment: Calendar,
  default: Bell,
};

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
  };

  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || notificationIcons.default;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer focus:bg-accent",
                  !notification.is_read && "bg-primary/5"
                )}
                asChild
              >
                {notification.link ? (
                  <Link 
                    to={notification.link} 
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <NotificationContent notification={notification} getIcon={getIcon} />
                  </Link>
                ) : (
                  <div onClick={() => handleNotificationClick(notification)}>
                    <NotificationContent notification={notification} getIcon={getIcon} />
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link to="/notifications">View all notifications</Link>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationContent({ 
  notification, 
  getIcon 
}: { 
  notification: Notification; 
  getIcon: (type: string) => React.ReactNode;
}) {
  return (
    <>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        notification.is_read ? "bg-muted" : "bg-primary/10 text-primary"
      )}>
        {getIcon(notification.type)}
      </div>
      <div className="flex-1 space-y-1">
        <p className={cn(
          "text-sm line-clamp-1",
          !notification.is_read && "font-medium"
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {!notification.is_read && (
        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
    </>
  );
}
