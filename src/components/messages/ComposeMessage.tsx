import { useState, useEffect } from 'react';
import { Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
import { getInitials } from '@/lib/utils';
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSendMessage, useStaffMembers } from '@/hooks/useMessages';
import { useToast } from '@/hooks/use-toast';

interface ComposeMessageProps {
  trigger?: React.ReactNode;
  defaultRecipientId?: string;
  defaultSubject?: string;
  studentId?: string;
  requestId?: string;
}

export function ComposeMessage({
  trigger,
  defaultRecipientId,
  defaultSubject,
  studentId,
  requestId,
}: ComposeMessageProps) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(defaultRecipientId || '');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [content, setContent] = useState('');
  const { toast } = useToast();

  const { data: staffMembers, isLoading: loadingStaff } = useStaffMembers();
  const sendMessage = useSendMessage();
  
  // Wait until staff members are loaded before syncing recipient
  const isReady = !loadingStaff && staffMembers !== undefined;

  // Sync recipientId when defaultRecipientId becomes available (async loading)
  useEffect(() => {
    if (defaultRecipientId && isReady) {
      setRecipientId(defaultRecipientId);
    }
  }, [defaultRecipientId, isReady]);

  // Sync subject when defaultSubject becomes available
  useEffect(() => {
    if (defaultSubject && !subject) {
      setSubject(defaultSubject);
    }
  }, [defaultSubject]);



  const handleSend = async () => {
    if (!recipientId || !content.trim()) return;

    try {
      await sendMessage.mutateAsync({
        recipientId,
        content: content.trim(),
        subject: subject.trim() || undefined,
        studentId,
        requestId,
      });
      toast({
        title: 'Message sent',
        description: 'Your message has been sent successfully.',
      });
      setOpen(false);
      setRecipientId(defaultRecipientId || '');
      setSubject(defaultSubject || '');
      setContent('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Send className="h-4 w-4 mr-2" />
            New Message
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Send a private message to your case manager or support staff
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">To</Label>
            <Select value={recipientId} onValueChange={setRecipientId} disabled={!!defaultRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {loadingStaff ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  staffMembers?.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.full_name || member.email}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              placeholder="Message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Message</Label>
            <Textarea
              id="content"
              placeholder="Write your message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!recipientId || !content.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
