import { useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { PageNav } from '@/components/navigation/PageNav';
import { Card, CardContent } from '@/components/ui/card';
import { MessageList } from '@/components/messages/MessageList';
import { MessageThread } from '@/components/messages/MessageThread';
import { ComposeMessage } from '@/components/messages/ComposeMessage';
import { useConversations } from '@/hooks/useMessages';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMyAssignment } from '@/hooks/useMyAssignment';
import { useAuth } from '@/contexts/AuthContext';

export default function Messages() {
  const { userId } = useParams<{ userId?: string }>();
  const { conversations, isLoading } = useConversations();
  const { role } = useAuth();
  const { data: myAssignment } = useMyAssignment();

  // Auto-populate recipient for students
  const defaultRecipientId = role === 'student' 
    ? myAssignment?.case_manager_id 
    : undefined;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {userId && (
          <PageNav fallback="/messages" backLabel="All conversations" />
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <PageHeader
            title="Messages"
            description={role === 'student' 
              ? "Private communication with your case manager" 
              : "Private communication with staff and students"}
          />
          <ComposeMessage defaultRecipientId={defaultRecipientId} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Conversation List - hide on mobile when a thread is open */}
          <Card className={`lg:col-span-1 border border-border/50 ${userId ? 'hidden lg:block' : ''}`}>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Conversations</h3>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <MessageList conversations={conversations} activeUserId={userId} />
              )}
            </CardContent>
          </Card>

          {/* Message Thread */}
          <Card className={`lg:col-span-2 border border-border/50 min-h-[500px] lg:min-h-[600px] ${!userId ? 'hidden lg:block' : ''}`}>
            {userId ? (
              <MessageThread otherUserId={userId} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">Select a conversation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a conversation from the list or start a new one
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
