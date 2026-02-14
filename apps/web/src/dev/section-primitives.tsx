import { useState } from 'react';
import { toast } from 'sonner';
import { Section, SubSection } from '@/dev/dev-toolbar';
import { scaled } from '@/lib/scaled';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HourglassLogo } from '@/components/layout/hourglass-logo';

export function PrimitivesSection() {
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState<boolean | 'indeterminate'>('indeterminate');

  return (
    <Section title="Primitives">
      {/* Typography — the foundation everything else builds on */}
      <div className="mb-6 last:mb-0" id="typography">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Typography</h3>
        <div className="space-y-6">
          {/* Font families */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Font Families
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-1 text-lg font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Inter — Body
                </div>
                <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  ABCDEFGHIJKLM abcdefghijklm 0123456789
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Dialog titles, descriptions, table cells, form labels, body text
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-1 font-brand text-lg font-semibold text-foreground">
                  Oxanium — Brand
                </div>
                <div className="font-brand text-sm text-muted-foreground">
                  ABCDEFGHIJKLM abcdefghijklm 0123456789
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Stat card labels, timer display, section headings, page titles
                </div>
              </div>
            </div>
          </div>

          {/* Type scale */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Type Scale — scaled() values at current zoom
            </div>
            <div className="space-y-1.5">
              {[
                { px: 10, usage: 'Stat card labels, badges, fine print' },
                { px: 12, usage: 'Description text, table cells, form labels' },
                { px: 13, usage: 'Toast messages, body text' },
                { px: 14, usage: 'Dialog titles, primary UI text' },
                { px: 16, usage: 'Section subheadings' },
                { px: 22, usage: 'Stat card values, large numbers' },
              ].map(({ px, usage }) => (
                <div key={px} className="flex items-baseline gap-4">
                  <code className="w-28 shrink-0 text-xs text-muted-foreground">
                    scaled({px})
                  </code>
                  <span className="text-foreground" style={{ fontSize: scaled(px) }}>
                    The quick brown fox
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {usage}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Weights */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Weights
            </div>
            <div className="flex flex-wrap gap-6">
              {[
                { weight: 400, name: 'Regular', usage: 'Body, descriptions' },
                { weight: 500, name: 'Medium', usage: 'Labels, table headers' },
                { weight: 600, name: 'Semibold', usage: 'Dialog titles, buttons' },
                { weight: 700, name: 'Bold', usage: 'Page titles, stat values' },
              ].map(({ weight, name, usage }) => (
                <div key={weight} className="flex flex-col items-center gap-1">
                  <span className="text-foreground" style={{ fontSize: scaled(14), fontWeight: weight }}>
                    Aa
                  </span>
                  <span className="text-xs font-medium text-foreground">{weight} {name}</span>
                  <span className="text-[10px] text-muted-foreground">{usage}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Special treatments */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Special Treatments
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <span
                  className="font-brand font-medium uppercase text-muted-foreground"
                  style={{ fontSize: scaled(10), letterSpacing: '2px' }}
                >
                  STAT LABEL
                </span>
                <span className="text-[10px] text-muted-foreground">Uppercase + tracking</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span
                  className="font-brand font-bold text-primary"
                  style={{ fontSize: scaled(22) }}
                >
                  4h 00m
                </span>
                <span className="text-[10px] text-muted-foreground">Brand bold accent</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                  monospace
                </code>
                <span className="text-[10px] text-muted-foreground">Code / technical</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-brand text-sm font-semibold tabular-nums text-foreground">
                  01:23:45
                </span>
                <span className="text-[10px] text-muted-foreground">Tabular nums (timer)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SubSection label="Button — Variants">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </SubSection>

      <SubSection label="Button — Sizes">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon">+</Button>
      </SubSection>

      <SubSection label="Button — States">
        <Button disabled>Disabled</Button>
        <Button variant="destructive" disabled>
          Disabled Destructive
        </Button>
      </SubSection>

      <SubSection label="Input">
        <Input placeholder="Type something..." className="max-w-[300px]" />
        <Input type="date" className="max-w-[200px]" />
        <Input type="time" className="max-w-[150px]" />
        <Input disabled placeholder="Disabled input" className="max-w-[300px]" />
      </SubSection>

      <SubSection label="Badge">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </SubSection>

      <SubSection label="Stat Card">
        <div className="grid w-full grid-cols-3 gap-3">
          <StatCard label="Today" value="4h 00m" subtitle="of 8h target" accent />
          <StatCard label="This Week" value="24h 00m" subtitle="of 40h target" />
          <StatCard label="Selected" value="11" subtitle="can log in" accent selected />
        </div>
      </SubSection>

      <SubSection label="Checkbox">
        <div className="flex items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={(c) => setChecked(c === true)} id="cb1" />
          <label htmlFor="cb1" className="text-sm text-foreground">
            {checked ? 'Checked' : 'Unchecked'}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={indeterminate} onCheckedChange={setIndeterminate} id="cb2" />
          <label htmlFor="cb2" className="text-sm text-foreground">
            Indeterminate
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox disabled id="cb3" />
          <label htmlFor="cb3" className="text-sm text-muted-foreground">
            Disabled
          </label>
        </div>
      </SubSection>

      <SubSection label="Separator">
        <div className="w-full">
          <div className="text-sm text-foreground">Content above</div>
          <Separator className="my-3" />
          <div className="text-sm text-foreground">Content below</div>
        </div>
      </SubSection>

      <SubSection label="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Example Dialog</DialogTitle>
              <DialogDescription>
                This is a dialog component from shadcn/ui. It supports accessible focus management.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground">Dialog content goes here.</div>
          </DialogContent>
        </Dialog>
      </SubSection>

      <SubSection label="Alert Dialog">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Open Alert Dialog</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SubSection>

      <SubSection label="Dropdown Menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SubSection>

      <SubSection label="Toast (Sonner)">
        <Button variant="outline" onClick={() => toast('Default toast message')}>
          Default
        </Button>
        <Button variant="outline" onClick={() => toast.success('Entry saved successfully')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.error('Failed to save entry')}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.info('Timer started')}>
          Info
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast('Entry deleted', {
              description: 'The time entry has been permanently removed.',
              action: { label: 'Undo', onClick: () => toast.success('Entry restored') },
            })
          }
        >
          With Action
        </Button>
      </SubSection>

      <SubSection label="Hourglass Logo — Sizes">
        <div className="flex items-end gap-6">
          <div className="text-center">
            <HourglassLogo className="h-6 w-5 text-primary" />
            <div className="mt-1 text-[10px] text-muted-foreground">24px</div>
          </div>
          <div className="text-center">
            <HourglassLogo className="h-10 w-8 text-primary" />
            <div className="mt-1 text-[10px] text-muted-foreground">40px</div>
          </div>
          <div className="text-center">
            <HourglassLogo className="h-16 w-14 text-primary" />
            <div className="mt-1 text-[10px] text-muted-foreground">64px</div>
          </div>
        </div>
      </SubSection>
    </Section>
  );
}
