import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ChevronRight, Folder, FolderOpen, FileText, Play } from 'lucide-react';
import { Section } from '@/dev/dev-toolbar';
import { ExplorationViewer, type Exploration } from '@/dev/exploration-viewer';
import { LAB_SECTIONS, timeAgo, type LabItem, type LabFeatureGroup } from '@/dev/lab-data';

function collectExplorations(groups: LabFeatureGroup[]): Exploration[] {
  return groups.flatMap((g) => [
    ...g.items.filter((i): i is Extract<LabItem, { kind: 'exploration' }> => i.kind === 'exploration'),
    ...(g.children ? collectExplorations(g.children) : []),
  ]);
}

const ALL_EXPLORATIONS: Exploration[] = LAB_SECTIONS.flatMap((s) => collectExplorations(s.groups));

export function LabSection() {
  const navigate = useNavigate();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const relativeTime = useMemo(() => {
    const map = new Map<string, string>();
    function indexGroups(groups: LabFeatureGroup[]) {
      for (const group of groups) {
        map.set(group.id, timeAgo(group.date));
        for (const item of group.items) {
          const key = item.kind === 'exploration' ? item.file : item.route;
          map.set(key, timeAgo(item.date));
        }
        if (group.children) indexGroups(group.children);
      }
    }
    for (const section of LAB_SECTIONS) {
      indexGroups(section.groups);
    }
    return map;
  }, []);

  const toggleFolder = (id: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openExploration = (file: string) => {
    const index = ALL_EXPLORATIONS.findIndex((e) => e.file === file);
    setActiveIndex(index >= 0 ? index : 0);
    setViewerOpen(true);
  };

  const renderGroup = (group: LabFeatureGroup, depth = 0) => {
    const isOpen = openFolders.has(group.id);
    const FolderIcon = isOpen ? FolderOpen : Folder;
    const indent = depth * 1.25; // rem per nesting level

    return (
      <div key={group.id}>
        <button
          onClick={() => toggleFolder(group.id)}
          className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_7rem_7rem] gap-x-6 px-3 py-1.5 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground" style={{ paddingLeft: `${indent}rem` }}>
            <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            <FolderIcon className="h-3.5 w-3.5 text-primary/60" />
            {group.name}
          </span>
          <span className="truncate text-muted-foreground/40">{group.description}</span>
          <span className="text-right text-muted-foreground/30">{new Date(group.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          <span className="text-right text-muted-foreground/40">{relativeTime.get(group.id)}</span>
        </button>

        {isOpen && (
          <>
            {group.children?.map((child) => renderGroup(child, depth + 1))}
            {group.items.map((item) => {
              const isExploration = item.kind === 'exploration';
              const key = isExploration ? item.file : item.route;
              const Icon = isExploration ? FileText : Play;
              const HoverIcon = isExploration ? Eye : Play;
              const itemIndent = (depth + 1) * 1.25 + 0.5; // align with child folder content

              return (
                <button
                  key={key}
                  onClick={() => {
                    if (isExploration) {
                      openExploration(item.file);
                    } else {
                      navigate(item.route);
                    }
                  }}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_7rem_7rem] gap-x-6 px-3 py-1 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-1.5 text-foreground/80 group-hover:text-foreground" style={{ paddingLeft: `${itemIndent}rem` }}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isExploration ? 'text-muted-foreground/40 group-hover:text-primary/60' : 'text-primary/50 group-hover:text-primary'}`} />
                    <span className="truncate">{item.title}</span>
                    {isExploration && (
                      <HoverIcon className="h-3 w-3 shrink-0 text-transparent group-hover:text-muted-foreground/60" />
                    )}
                  </span>
                  <span className="truncate text-muted-foreground/50">{item.description}</span>
                  <span className="text-right text-muted-foreground/30">{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-right text-muted-foreground/40">{relativeTime.get(key)}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {LAB_SECTIONS.map((section) => (
        <Section key={section.id} title={section.product} id={`lab-${section.id}`}>
          <div className="w-full overflow-hidden rounded-md border border-border/50 font-mono text-[13px]">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_7rem_7rem] gap-x-6 border-b border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              <span>Name</span>
              <span>Description</span>
              <span className="text-right">Created</span>
              <span className="text-right">Modified</span>
            </div>
            {section.groups.map((g) => renderGroup(g))}
          </div>
        </Section>
      ))}

      <ExplorationViewer
        explorations={ALL_EXPLORATIONS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}
