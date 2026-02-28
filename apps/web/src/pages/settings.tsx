import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings2, Palette, Link2, Download, Tags, Plus, Trash2, X } from 'lucide-react';
import { THEMES, ORG_TIMEZONE, PROJECT_COLORS, type ThemeId } from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import { BuildInfo } from '@/components/build-info';
import { SCALES, usePreferences } from '@/providers/preferences-provider';
import { Switch } from '@/components/ui/switch';
import { scaled } from '@/lib/scaled';
import { getTimezoneAbbr } from '@/lib/format';
import { ProjectSelector } from '@/components/timer/project-selector';
import { JiraIntegrations } from '@/components/jira/jira-integrations';
import { DownloadsContent } from '@/pages/downloads';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/use-reference-data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ── Tab definitions ──────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'tags', label: 'Tags', icon: Tags },
];

// ── Tab panels ───────────────────────────────────────────────────────────

function GeneralPanel() {
  const { user } = useAuth();
  const {
    defaultProjectId,
    setDefaultProject,
    confirmTimerSwitch,
    setConfirmTimerSwitch,
    tagsEnabled,
    setTagsEnabled,
  } = usePreferences();

  return (
    <div>
      {/* Account */}
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Account
        </h2>
        <div className="mt-1.5" style={{ fontSize: scaled(12) }}>
          <span className="text-foreground">{user?.displayName ?? '—'}</span>
          <span className="text-muted-foreground/40"> · </span>
          <span className={user?.globalRole === 'admin' ? 'text-primary' : 'text-muted-foreground'}>
            {user?.globalRole === 'admin' ? 'Admin' : 'Employee'}
          </span>
        </div>
        <div className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          {user?.email ?? '—'}
          {user?.phone && (
            <>
              <span className="text-muted-foreground/30"> · </span>
              {user.phone}
            </>
          )}
          <span className="text-muted-foreground/30"> · </span>
          {ORG_TIMEZONE}
          <span className="text-muted-foreground/50"> ({getTimezoneAbbr()})</span>
        </div>
      </div>

      {/* Default Project */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Default Project
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Pre-fills the project when starting a new timer or creating an entry.
        </p>
        <div className="mt-2">
          <ProjectSelector value={defaultProjectId} onChange={setDefaultProject} />
        </div>
      </div>

      {/* Timer */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Timer
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Controls how the timer behaves when switching between entries.
        </p>
        <label className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              Confirm before switching timers
            </div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
              Show a confirmation dialog when starting a new timer while another is running.
            </div>
          </div>
          <Switch checked={confirmTimerSwitch} onCheckedChange={setConfirmTimerSwitch} />
        </label>
      </div>

      {/* Tags */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Tags
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Personal tags for categorizing time entries.
        </p>
        <label className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <div className="font-medium text-foreground" style={{ fontSize: scaled(13) }}>
              Enable tags
            </div>
            <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
              Show tag pickers in entries, manual entry dialog, and filters.
            </div>
          </div>
          <Switch checked={tagsEnabled} onCheckedChange={setTagsEnabled} />
        </label>
      </div>
    </div>
  );
}

// ── Tag color palette ────────────────────────────────────────────────────

const TAG_COLORS = PROJECT_COLORS;

function TagPill({
  tag,
  onUpdate,
  onDelete,
  isPending,
}: {
  tag: { id: string; name: string; color: string | null };
  onUpdate: (data: { id: string; name?: string; color?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [editColor, setEditColor] = useState<string | null>(tag.color);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setEditName(tag.name);
      setEditColor(tag.color);
      setConfirmingDelete(false);
    }
  };

  const hasChanges = editName.trim() !== tag.name || editColor !== tag.color;

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed || !hasChanges) return;
    await onUpdate({ id: tag.id, name: trimmed, color: editColor });
    setOpen(false);
  };

  const handleDelete = async () => {
    await onDelete(tag.id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-colors hover:bg-accent',
            open && 'border-primary bg-accent',
          )}
          style={{ fontSize: scaled(12) }}
        >
          {tag.color && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
          )}
          <span className="text-foreground">{tag.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="start">
        <div className="space-y-3">
          {/* Name input */}
          <div>
            <label className="mb-1 block text-muted-foreground" style={{ fontSize: scaled(10) }}>
              Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hasChanges) handleSave();
                if (e.key === 'Escape') setOpen(false);
              }}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground focus:border-primary focus:outline-none"
              style={{ fontSize: scaled(12) }}
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="mb-1.5 block text-muted-foreground" style={{ fontSize: scaled(10) }}>
              Color
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditColor(null)}
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
                  editColor === null
                    ? 'border-foreground'
                    : 'border-border hover:border-muted-foreground/50',
                )}
                title="No color"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-all',
                    editColor === c
                      ? 'border-foreground'
                      : 'border-transparent hover:border-muted-foreground/50',
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          {confirmingDelete ? (
            <div className="flex items-center gap-2 border-t border-destructive/30 pt-2">
              <span className="shrink-0 text-destructive" style={{ fontSize: scaled(11) }}>
                Delete?
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="whitespace-nowrap rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  style={{ fontSize: scaled(11) }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="whitespace-nowrap rounded-md bg-destructive px-2.5 py-1 font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                  style={{ fontSize: scaled(11) }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-border pt-2">
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-destructive"
                style={{ fontSize: scaled(11) }}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
              <button
                onClick={handleSave}
                disabled={!editName.trim() || !hasChanges || isPending}
                className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                style={{ fontSize: scaled(11) }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagsPanel() {
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await createTag.mutateAsync({ name: trimmed });
    setNewName('');
  };

  const handleUpdate = async (data: { id: string; name?: string; color?: string | null }) => {
    await updateTag.mutateAsync(data);
  };

  const handleDelete = async (id: string) => {
    await deleteTag.mutateAsync(id);
  };

  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Tags
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Manage your personal tags. Click a tag to edit it.
      </p>

      {/* Pills wrap */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isLoading && (
          <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Loading...
          </span>
        )}
        {tags?.map((tag) => (
          <TagPill
            key={tag.id}
            tag={tag}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            isPending={updateTag.isPending || deleteTag.isPending}
          />
        ))}

        {/* Inline create — looks like a dashed pill */}
        <div className="inline-flex items-center gap-1 rounded-full border border-dashed border-border">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="New tag..."
            className="w-[100px] rounded-l-full bg-transparent py-1 pl-3 pr-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            style={{ fontSize: scaled(12) }}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createTag.isPending}
            className="mr-0.5 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-30"
            title="Add tag"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {tags?.length === 0 && !isLoading && (
        <p className="mt-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          No tags yet. Type a name above and press Enter to create one.
        </p>
      )}
    </div>
  );
}

function AppearancePanel() {
  const { theme, setTheme, scale, setScale } = usePreferences();

  return (
    <div>
      {/* Theme */}
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Theme
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Choose a color theme for the interface
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ThemeId)}
              className={cn(
                'rounded-lg border px-3.5 py-1.5 transition-all',
                theme === t.id
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
              style={{ fontSize: scaled(12) }}
            >
              {t.name}
              {t.badge ? ` (${t.badge})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Scale */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Scale
        </h2>
        <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
          Adjust the UI density
        </p>
        <div className="mt-2 flex gap-1.5">
          {SCALES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScale(s.value)}
              className={cn(
                'rounded-md border px-2.5 py-1 transition-all',
                scale === s.value
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
              style={{ fontSize: scaled(11) }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mt-6">
        <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
          Preview
        </h2>
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4">
          <p className="font-brand font-semibold text-foreground" style={{ fontSize: scaled(18) }}>
            Timer &amp; Entries
          </p>
          <p className="font-brand mt-1 font-bold text-foreground" style={{ fontSize: scaled(22) }}>
            14h 52m
          </p>
          <p className="mt-1 text-muted-foreground" style={{ fontSize: scaled(13) }}>
            Weekly summary across all projects and tags.
          </p>
          <p
            className="font-brand mt-1 font-normal uppercase tracking-wider text-muted-foreground"
            style={{ fontSize: scaled(10) }}
          >
            This week
          </p>
        </div>
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Integrations
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Connect external tools to link data with your time entries.
      </p>
      <div className="mt-3">
        <JiraIntegrations />
      </div>
    </div>
  );
}

function DownloadsPanel() {
  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Desktop App
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Download the Ternity desktop app for your platform.
      </p>
      <div className="mt-3">
        <DownloadsContent />
      </div>
    </div>
  );
}

// ── Settings Page ────────────────────────────────────────────────────────

const VALID_TABS = new Set(TABS.map((t) => t.id));

export function SettingsPage() {
  const { refreshFromServer, tagsEnabled } = usePreferences();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const isTabDisabled = (id: string) => id === 'tags' && !tagsEnabled;
  const activeTab = tab && VALID_TABS.has(tab) && !isTabDisabled(tab) ? tab : 'general';

  const setActiveTab = (id: string) => {
    navigate(`/settings/${id}`, { replace: true });
  };

  useEffect(() => {
    refreshFromServer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panels: Record<string, () => React.ReactNode> = {
    general: GeneralPanel,
    tags: TagsPanel,
    appearance: AppearancePanel,
    integrations: IntegrationsPanel,
    downloads: DownloadsPanel,
  };

  const Panel = panels[activeTab]!;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1
            className="font-brand font-semibold tracking-wide text-foreground"
            style={{ fontSize: scaled(18) }}
          >
            Settings
          </h1>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Manage your preferences and integrations
          </p>
        </div>
        <BuildInfo />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-border pb-px">
        {TABS.map((tab) => {
          const disabled = isTabDisabled(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              className={cn(
                'mb-[-1px] flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-brand font-medium uppercase tracking-wider transition-colors',
                disabled
                  ? 'cursor-not-allowed border-transparent text-muted-foreground/30'
                  : activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              style={{ fontSize: scaled(11), letterSpacing: '1px' }}
              title={disabled ? 'Enable tags in General settings first' : undefined}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className={activeTab === 'downloads' ? 'max-w-4xl' : 'max-w-2xl'}>
        <Panel />
      </div>
    </div>
  );
}
