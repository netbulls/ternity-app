import { useState, useEffect } from 'react';
import { PROJECT_COLORS } from '@ternity/shared';
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
import { scaled } from '@/lib/scaled';
import {
  useCreateProject,
  useUpdateProject,
  useCreateClient,
  useAdminClients,
  type AdminProject,
} from '@/hooks/use-admin-projects';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, dialog is in edit mode. Otherwise, create mode. */
  project?: AdminProject | null;
}

export function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const isEdit = !!project;

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [description, setDescription] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const { data: allClients } = useAdminClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createClient = useCreateClient();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (project) {
        setName(project.name);
        setClientId(project.clientId);
        setColor(project.color);
        setDescription(project.description ?? '');
      } else {
        setName('');
        setClientId('');
        setColor(PROJECT_COLORS[0]);
        setDescription('');
      }
      setShowNewClient(false);
      setNewClientName('');
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let resolvedClientId = clientId;

    // If creating a new client inline, do it first
    if (showNewClient && newClientName.trim()) {
      try {
        const created = await createClient.mutateAsync({ name: newClientName.trim() });
        resolvedClientId = created.id;
      } catch {
        return; // toast already shown by hook
      }
    }

    if (!resolvedClientId) return;

    const data = {
      name: name.trim(),
      clientId: resolvedClientId,
      color,
      description: description.trim() || undefined,
    };

    if (isEdit) {
      updateProject.mutate(
        { id: project!.id, ...data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createProject.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending || createClient.isPending;
  const canSubmit = name.trim() && (clientId || (showNewClient && newClientName.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Project' : 'New Project'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update project details.' : 'Create a new project.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name" style={{ fontSize: scaled(12) }}>
              Name
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </div>

          {/* Client */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-client" style={{ fontSize: scaled(12) }}>
              Client
            </Label>
            {showNewClient ? (
              <div className="flex gap-2">
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="New client name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewClient(false);
                    setNewClientName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  id="project-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  style={{ fontSize: scaled(13) }}
                >
                  <option value="">Select client...</option>
                  {allClients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewClient(true)}
                  className="shrink-0 whitespace-nowrap text-primary"
                >
                  + New Client
                </Button>
              </div>
            )}
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <Label style={{ fontSize: scaled(12) }}>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-desc" style={{ fontSize: scaled(12) }}>
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description..."
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{ fontSize: scaled(13) }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
