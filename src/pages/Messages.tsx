import { useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { MessageList } from '@/components/messages/MessageList';
import { MessageThread } from '@/components/messages/MessageThread';
import { ComposeMessage } from '@/components/messages/ComposeMessage';
import { useConversations } from '@/hooks/useMessages';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Messages() {
  const { userId } = useParams<{ userId?: string }>();
  const { conversations, isLoading } = useConversations();

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Messages"
            description="Private communication with other staff members"
          />
          <ComposeMessage />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Conversation List */}
          <Card className="lg:col-span-1 border border-border/50">
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
          <Card className="lg:col-span-2 border border-border/50 min-h-[600px]">
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
