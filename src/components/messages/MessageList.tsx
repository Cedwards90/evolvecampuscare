import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn, getInitials } from '@/lib/utils';
import type { Conversation } from '@/types/messages';

interface MessageListProps {
  conversations: Conversation[];
  activeUserId?: string;
}

export function MessageList({ conversations, activeUserId }: MessageListProps) {

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-lg">No conversations yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Start a conversation with a team member
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => (
        <Link
          key={conversation.other_user.user_id}
          to={`/messages/${conversation.other_user.user_id}`}
        >
          <Card
            className={cn(
              'p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
              activeUserId === conversation.other_user.user_id && 'border-primary bg-primary/5',
              conversation.unread_count > 0 && 'bg-accent/50'
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(conversation.other_user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">
                    {conversation.other_user.full_name || 'Unknown User'}
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(conversation.last_message.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {conversation.last_message.content}
                </p>
                {conversation.unread_count > 0 && (
                  <Badge variant="default" className="mt-2 text-xs">
                    {conversation.unread_count} unread
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
