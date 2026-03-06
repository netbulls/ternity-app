import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { SelectPopover } from '@/components/ui/select-popover';
import { scaled } from '@/lib/scaled';
import {
  useCreateLeaveType,
  useUpdateAdminLeaveType,
  useAdminLeaveTypeGroups,
  type AdminLeaveType,
  type LeaveVisibility,
} from '@/hooks/use-leave';

const LEAVE_TYPE_COLORS = [
  '#00D4AA', // teal (brand)
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#F59E0B', // amber
  '#14B8A6', // teal-2
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F97316', // orange
] as const;

interface LeaveTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, dialog is in edit mode. Otherwise, create mode. */
  leaveType?: AdminLeaveType | null;
}

export function LeaveTypeDialog({ open, onOpenChange, leaveType }: LeaveTypeDialogProps) {
  const isEdit = !!leaveType;

  const [name, setName] = useState('');
  const [daysPerYear, setDaysPerYear] = useState(0);
  const [color, setColor] = useState<string>(LEAVE_TYPE_COLORS[0]);
  const [deducted, setDeducted] = useState(true);
  const [groupId, setGroupId] = useState('');
  const [visibility, setVisibility] = useState<LeaveVisibility>('all');

  const { data: allGroups } = useAdminLeaveTypeGroups();
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateAdminLeaveType();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (leaveType) {
        setName(leaveType.name);
        setDaysPerYear(leaveType.daysPerYear);
        setColor(leaveType.color ?? LEAVE_TYPE_COLORS[0]);
        setDeducted(leaveType.deducted);
        setGroupId(leaveType.groupId ?? '');
        setVisibility(leaveType.visibility);
      } else {
        setName('');
        setDaysPerYear(0);
        setColor(LEAVE_TYPE_COLORS[0]);
        setDeducted(true);
        setGroupId('');
        setVisibility('all');
      }
    }
  }, [open, leaveType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: name.trim(),
      daysPerYear,
      color,
      deducted,
      groupId: groupId || null,
      visibility,
    };

    if (isEdit) {
      updateLeaveType.mutate(
        { id: leaveType!.id, ...data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createLeaveType.mutate(data, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = createLeaveType.isPending || updateLeaveType.isPending;
  const canSubmit = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Leave Type' : 'New Leave Type'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update leave type details.' : 'Create a new leave type.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type-name" style={{ fontSize: scaled(12) }}>
              Name
            </Label>
            <Input
              id="leave-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave type name"
              autoFocus
            />
          </div>

          {/* Days per year */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type-days" style={{ fontSize: scaled(12) }}>
              Days per year
            </Label>
            <Input
              id="leave-type-days"
              type="number"
              min={0}
              value={daysPerYear}
              onChange={(e) => setDaysPerYear(parseInt(e.target.value, 10) || 0)}
              placeholder="0"
            />
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <Label style={{ fontSize: scaled(12) }}>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Group */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type-group" style={{ fontSize: scaled(12) }}>
              Group <span className="text-muted-foreground">(optional)</span>
            </Label>
            <SelectPopover
              value={groupId}
              onChange={setGroupId}
              items={[
                { value: '', label: 'No group' },
                ...(allGroups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
              ]}
              placeholder="No group"
            />
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type-visibility" style={{ fontSize: scaled(12) }}>
              Visibility
            </Label>
            <SelectPopover
              value={visibility}
              onChange={(v) => setVisibility(v as LeaveVisibility)}
              items={[
                { value: 'all', label: 'All' },
                { value: 'contractor', label: 'B2B only' },
                { value: 'employee', label: 'Employee only' },
              ]}
              placeholder="All"
            />
          </div>

          {/* Deducted */}
          <div className="flex items-center gap-2">
            <input
              id="leave-type-deducted"
              type="checkbox"
              checked={deducted}
              onChange={(e) => setDeducted(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="leave-type-deducted" style={{ fontSize: scaled(12) }}>
              Deducted from allowance
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Leave Type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
