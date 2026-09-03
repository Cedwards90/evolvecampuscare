import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useAddRequestLineItem,
  useDeleteRequestLineItem,
  useRequestLineItems,
} from '@/hooks/useRequestLineItems';
import { formatUsd } from '@/lib/financialAssistancePolicy';

/**
 * Staff-only itemization of a financial request so part of it can be approved.
 * Never rendered on student-facing surfaces.
 */
export function RequestLineItemsEditor({ requestId }: { requestId: string }) {
  const { data: items = [], isLoading } = useRequestLineItems(requestId);
  const addItem = useAddRequestLineItem(requestId);
  const deleteItem = useDeleteRequestLineItem(requestId);

  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [isEligible, setIsEligible] = useState(true);

  const eligibleTotal = items
    .filter((i) => i.is_eligible)
    .reduce((sum, i) => sum + i.amount, 0);
  const ineligibleTotal = items
    .filter((i) => !i.is_eligible)
    .reduce((sum, i) => sum + i.amount, 0);

  const handleAdd = async () => {
    const numeric = Number(amount);
    if (!label.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      toast.error('Enter a description and a positive amount');
      return;
    }
    try {
      await addItem.mutateAsync({ label: label.trim(), amount: numeric, is_eligible: isEligible });
      setLabel('');
      setAmount('');
      setIsEligible(true);
    } catch {
      toast.error('Could not add the line item');
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 min-w-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">Itemize this request (optional)</p>
        <p className="text-xs text-muted-foreground break-words">
          Break the request into line items to recommend a partial approval when only part of it
          qualifies under policy.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading line items…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No line items yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm min-w-0">
              <span className="min-w-0 flex-1 break-words">{item.label}</span>
              <span className="font-medium">{formatUsd(item.amount)}</span>
              <span
                className={
                  item.is_eligible
                    ? 'text-xs text-muted-foreground'
                    : 'text-xs text-amber-600 dark:text-amber-400'
                }
              >
                {item.is_eligible ? 'Eligible' : 'Ineligible'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${item.label}`}
                onClick={() => deleteItem.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <p className="text-xs text-muted-foreground break-words">
          Eligible {formatUsd(eligibleTotal)} · Excluded {formatUsd(ineligibleTotal)}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <Label htmlFor="line-item-label" className="text-xs">
            Description
          </Label>
          <Input
            id="line-item-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Work boots"
          />
        </div>
        <div className="w-28">
          <Label htmlFor="line-item-amount" className="text-xs">
            Amount
          </Label>
          <Input
            id="line-item-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="line-item-eligible" checked={isEligible} onCheckedChange={setIsEligible} />
          <Label htmlFor="line-item-eligible" className="text-xs">
            Eligible
          </Label>
        </div>
        <Button type="button" onClick={handleAdd} disabled={addItem.isPending} className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
