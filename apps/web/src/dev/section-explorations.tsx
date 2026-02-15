import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Section, SubSection } from '@/dev/dev-toolbar';
import { ExplorationViewer, type Exploration } from '@/dev/exploration-viewer';

interface ExplorationGroup {
  name: string;
  id: string;
  explorations: Exploration[];
}

const EXPLORATION_GROUPS: ExplorationGroup[] = [
  {
    name: 'Impersonation',
    id: 'impersonation-explorations',
    explorations: [
      { title: 'Impersonation — 8f3d', file: 'impersonation-8f3d.html', description: 'Admin impersonation banner and controls' },
      { title: 'Impersonation — 4a1c', file: 'impersonation-4a1c.html', description: 'Impersonation flow, earlier iteration' },
    ],
  },
  {
    name: 'Entries',
    id: 'entries-explorations',
    explorations: [
      { title: 'Entries', file: 'entries.html', description: 'Time entries page with day groups and timer bar' },
      { title: 'Entries — v1', file: 'entries-v1.html', description: 'Earlier entries layout iteration' },
    ],
  },
  {
    name: 'User Management',
    id: 'user-management-explorations',
    explorations: [
      { title: 'User Management', file: 'user-management.html', description: 'Admin table, stat cards, search, filters, bulk actions' },
    ],
  },
  {
    name: 'General',
    id: 'general-explorations',
    explorations: [
      { title: 'Design System Preview', file: 'design-preview.html', description: 'Typography, colors, spacing, component primitives' },
      { title: 'Phase 2 Design Options', file: 'phase2-options.html', description: 'Timer page layout options, icon library comparison' },
      { title: 'Theme Proposals', file: 'theme-proposals.html', description: 'All 6 theme palettes side-by-side' },
    ],
  },
];

const ALL_EXPLORATIONS = EXPLORATION_GROUPS.flatMap((g) => g.explorations);

export function ExplorationsSection() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const openViewer = (exploration: Exploration) => {
    const index = ALL_EXPLORATIONS.findIndex((e) => e.file === exploration.file);
    setActiveIndex(index >= 0 ? index : 0);
    setViewerOpen(true);
  };

  return (
    <Section title="Explorations">
      {EXPLORATION_GROUPS.map((group) => (
        <SubSection key={group.id} label={group.name} id={group.id}>
          <div className="grid w-full grid-cols-2 gap-4">
            {group.explorations.map((item) => (
              <button
                key={item.file}
                onClick={() => openViewer(item)}
                className="text-left"
              >
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {item.title}
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{item.description}</CardDescription>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </SubSection>
      ))}

      <ExplorationViewer
        explorations={ALL_EXPLORATIONS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </Section>
  );
}
