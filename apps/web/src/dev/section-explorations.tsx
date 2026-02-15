import { ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Section } from '@/dev/dev-toolbar';

const EXPLORATIONS = [
  {
    title: 'Design System Preview',
    url: '/explorations/design-preview.html',
    description: 'Typography, colors, spacing, component primitives',
  },
  {
    title: 'Phase 2 Design Options',
    url: '/explorations/phase2-options.html',
    description: 'Timer page layout options, icon library comparison',
  },
  {
    title: 'User Management',
    url: '/explorations/user-management.html',
    description: 'Admin table, stat cards, search, filters, bulk actions',
  },
  {
    title: 'Theme Proposals',
    url: '/explorations/theme-proposals.html',
    description: 'All 6 theme palettes side-by-side',
  },
];

export function ExplorationsSection() {
  return (
    <Section title="Explorations">
      <div className="grid grid-cols-2 gap-4">
        {EXPLORATIONS.map((item) => (
          <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {item.title}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </Section>
  );
}
