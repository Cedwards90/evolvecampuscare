import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Mail, MessageSquare, AlertCircle, UserPlus, Calendar, FileText } from 'lucide-react';
import { useNotificationSettings, useUpdateNotificationSettings, NotificationSettings as NotificationSettingsType } from '@/hooks/useSiteSettings';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const NOTIFICATION_TYPES = [
  {
    key: 'new_request' as const,
    label: 'New Request Notifications',
    description: 'Notify case managers and admins when students submit new requests',
    icon: FileText,
  },
  {
    key: 'status_change' as const,
    label: 'Status Change Notifications',
    description: 'Notify students when their request status changes',
    icon: AlertCircle,
  },
  {
    key: 'assignment' as const,
    label: 'Assignment Notifications',
    description: 'Notify case managers when requests are assigned to them',
    icon: UserPlus,
  },
  {
    key: 'invitation' as const,
    label: 'User Invitation Emails',
    description: 'Send email invitations when inviting new users',
    icon: Mail,
  },
  {
    key: 'weekly_summary' as const,
    label: 'Weekly Case Manager Summaries',
    description: 'Send weekly digest emails to case managers',
    icon: Calendar,
  },
  {
    key: 'checkin_reminders' as const,
    label: 'Weekly Student Check-In Reminders',
    description: 'Automatically email students each week to complete their check-in',
    icon: Bell,
  },
];

export function NotificationSettings() {
  const { data: settings, isLoading } = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<NotificationSettingsType | null>(null);
  const [showDisableEmailDialog, setShowDisableEmailDialog] = useState(false);
  const [pendingEmailDisable, setPendingEmailDisable] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleToggle = async (
    field: 'email_enabled' | 'in_app_enabled' | keyof NotificationSettingsType['types'],
    value: boolean
  ) => {
    if (!localSettings) return;

    // Show confirmation dialog for disabling all emails
    if (field === 'email_enabled' && !value) {
      setPendingEmailDisable(true);
      setShowDisableEmailDialog(true);
      return;
    }

    await applyToggle(field, value);
  };

  const applyToggle = async (
    field: 'email_enabled' | 'in_app_enabled' | keyof NotificationSettingsType['types'],
    value: boolean
  ) => {
    if (!localSettings) return;

    let newSettings: NotificationSettingsType;

    if (field === 'email_enabled' || field === 'in_app_enabled') {
      newSettings = { ...localSettings, [field]: value };
    } else {
      newSettings = {
        ...localSettings,
        types: { ...localSettings.types, [field]: value },
      };
    }

    setLocalSettings(newSettings);

    try {
      await updateSettings.mutateAsync(newSettings);
      toast({
        title: 'Settings updated',
        description: 'Notification settings have been saved.',
      });
    } catch (error) {
      // Revert on error
      setLocalSettings(localSettings);
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const confirmDisableEmails = async () => {
    setShowDisableEmailDialog(false);
    if (pendingEmailDisable) {
      await applyToggle('email_enabled', false);
      setPendingEmailDisable(false);
    }
  };

  if (isLoading || !localSettings) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Control site-wide notification behavior for all users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggles */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Master Controls
            </h4>
            
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="email-toggle" className="font-medium">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to users
                  </p>
                </div>
              </div>
              <Switch
                id="email-toggle"
                checked={localSettings.email_enabled}
                onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
                disabled={updateSettings.isPending}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="inapp-toggle" className="font-medium">
                    In-App Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show notifications in the app
                  </p>
                </div>
              </div>
              <Switch
                id="inapp-toggle"
                checked={localSettings.in_app_enabled}
                onCheckedChange={(checked) => handleToggle('in_app_enabled', checked)}
                disabled={updateSettings.isPending}
              />
            </div>
          </div>

          <Separator />

          {/* Per-type Toggles */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Notification Types
            </h4>
            
            {NOTIFICATION_TYPES.map((type) => {
              const Icon = type.icon;
              const isEnabled = localSettings.types[type.key];
              const isDisabled = updateSettings.isPending || 
                (!localSettings.email_enabled && !localSettings.in_app_enabled);

              return (
                <div
                  key={type.key}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isDisabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label htmlFor={`${type.key}-toggle`} className="font-medium">
                        {type.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={`${type.key}-toggle`}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(type.key, checked)}
                    disabled={isDisabled}
                  />
                </div>
              );
            })}
          </div>

          {(!localSettings.email_enabled && !localSettings.in_app_enabled) && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                ⚠️ All notifications are currently disabled. Users will not receive any alerts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisableEmailDialog} onOpenChange={setShowDisableEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Email Notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all email notifications across the platform, including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>New request alerts to case managers</li>
                <li>Status updates to students</li>
                <li>Assignment notifications</li>
                <li>User invitations</li>
                <li>Weekly summaries</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEmailDisable(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisableEmails}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable Emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
