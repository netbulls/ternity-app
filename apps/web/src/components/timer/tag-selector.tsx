import React, { useState } from 'react';
import { Check, ChevronDown, Plus, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags, useCreateTag } from '@/hooks/use-reference-data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface Props {
  value: string[];
  onChange: (tagIds: string[]) => void;
  /** Extra classes applied to the trigger button */
  triggerClassName?: string;
}

export function TagSelector({ value, onChange, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: tags } = useTags();
  const createTag = useCreateTag();

  const selectedTags = tags?.filter((t) => value.includes(t.id)) ?? [];

  const toggle = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const trimmed = search.trim();
  const exactMatch = tags?.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;

  const handleCreate = async () => {
    const created = await createTag.mutateAsync({ name: trimmed });
    onChange([...value, created.id]);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
            selectedTags.length > 0 ? 'text-foreground' : 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <Tags className="h-3.5 w-3.5" />
          {selectedTags.length > 0 ? (
            <span>
              {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span>Tags</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList onWheel={(e: React.WheelEvent) => e.stopPropagation()}>
            {!showCreate && tags?.length === 0 && <CommandEmpty>No tags yet.</CommandEmpty>}
            <CommandGroup>
              {tags
                ?.filter((t) => !trimmed || t.name.toLowerCase().includes(trimmed.toLowerCase()))
                .map((tag) => (
                  <CommandItem key={tag.id} onSelect={() => toggle(tag.id)}>
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-border',
                        value.includes(tag.id) && 'bg-primary border-primary',
                      )}
                    >
                      {value.includes(tag.id) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    {tag.color && (
                      <span
                        className="mr-1.5 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    <span className="truncate">{tag.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleCreate}
                  disabled={createTag.isPending}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
