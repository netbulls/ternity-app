import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Check } from 'lucide-react';

export interface PickerItem {
  key: string;
  label: string;
  secondary?: string;
}

interface PickerPopoverProps {
  items: PickerItem[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  trigger: React.ReactNode;
  searchPlaceholder: string;
  emptyLabel: string;
  isLoading?: boolean;
  renderItem?: (item: PickerItem, isSelected: boolean) => React.ReactNode;
}

export function PickerPopover({
  items,
  selected,
  onToggle,
  trigger,
  searchPlaceholder,
  emptyLabel,
  isLoading,
  renderItem,
}: PickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = search
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(search.toLowerCase()) ||
          i.key.toLowerCase().includes(search.toLowerCase()) ||
          (i.secondary?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : items;

  return (
    <div className="relative inline-block" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-[240px] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            {/* Search */}
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  className="h-7 w-full rounded-md border border-border bg-muted/40 pl-8 pr-3 text-foreground outline-none transition-colors focus:border-primary/50"
                  style={{ fontSize: scaled(11) }}
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Items */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {isLoading ? (
                <div className="px-3 py-4 text-center text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {emptyLabel}
                </div>
              ) : (
                filtered.map((item, i) => {
                  const isSelected = selected.has(item.key);
                  return (
                    <motion.button
                      key={item.key}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                        isSelected
                          ? 'bg-primary/8 text-foreground'
                          : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                      )}
                      style={{ fontSize: scaled(11) }}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.12 }}
                      onClick={() => onToggle(item.key)}
                    >
                      {renderItem ? (
                        renderItem(item, isSelected)
                      ) : (
                        <>
                          <span className="font-mono text-muted-foreground/60" style={{ fontSize: scaled(10) }}>
                            {item.key}
                          </span>
                          <span className="flex-1 truncate">{item.label}</span>
                        </>
                      )}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                          >
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
