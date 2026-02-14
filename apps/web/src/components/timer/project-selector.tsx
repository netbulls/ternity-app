import { useState } from 'react';
import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/use-reference-data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { ProjectOption } from '@ternity/shared';

interface Props {
  value: string | null;
  onChange: (projectId: string | null, project: ProjectOption | null) => void;
}

export function ProjectSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data: projects } = useProjects();

  const selected = projects?.find((p) => p.id === value) ?? null;

  // Group projects by client
  const grouped = new Map<string, ProjectOption[]>();
  for (const p of projects ?? []) {
    const client = p.clientName ?? 'No Client';
    if (!grouped.has(client)) grouped.set(client, []);
    grouped.get(client)!.push(p);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
            selected ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {selected ? (
            <>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selected.color ?? '#00D4AA' }}
              />
              <span className="max-w-[120px] truncate">{selected.name}</span>
            </>
          ) : (
            <>
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Project</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground">No Project</span>
                {value === null && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            </CommandGroup>
            {Array.from(grouped.entries()).map(([client, clientProjects]) => (
              <CommandGroup key={client} heading={client}>
                {clientProjects.map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => {
                      onChange(p.id, p);
                      setOpen(false);
                    }}
                  >
                    <span
                      className="mr-2 h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: p.color ?? '#00D4AA' }}
                    />
                    <span className="truncate">{p.name}</span>
                    {p.id === value && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
