import { useState } from 'react';
import { Send, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAddReply } from '@/hooks/useRequest';

interface RequestMessagesProps {
  requestId: string;
  userId: string;
  canSendInternal: boolean;
}

export function RequestMessages({ 
  requestId, 
  userId, 
  canSendInternal 
}: RequestMessagesProps) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const { toast } = useToast();
  const addReply = useAddReply();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: 'Message Required',
        description: 'Please enter a message before sending.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addReply.mutateAsync({
        requestId,
        userId,
        message: message.trim(),
        isInternal: canSendInternal ? isInternal : false,
      });
      
      toast({
        title: 'Message Sent',
        description: isInternal 
          ? 'Internal note added successfully.' 
          : 'Reply sent to student.',
      });
      
      setMessage('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Textarea
          placeholder={isInternal ? "Add an internal note (only visible to staff)..." : "Reply to student..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className={isInternal ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : ""}
        />
        {isInternal && (
          <div className="absolute top-2 right-2">
            <Lock className="h-4 w-4 text-amber-600" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {canSendInternal && (
          <div className="flex items-center gap-2">
            <Switch
              id="internal-note"
              checked={isInternal}
              onCheckedChange={setIsInternal}
            />
            <Label 
              htmlFor="internal-note" 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Internal note only (not visible to student)
            </Label>
          </div>
        )}
        
        <Button 
          type="submit" 
          disabled={addReply.isPending || !message.trim()}
          className="gap-2 ml-auto"
        >
          {addReply.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isInternal ? 'Add Note' : 'Send Reply'}
        </Button>
      </div>
    </form>
  );
}
