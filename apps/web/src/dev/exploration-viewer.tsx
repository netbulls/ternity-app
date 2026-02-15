import { useEffect, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronUp, ChevronDown, X, Maximize } from 'lucide-react';

export interface Exploration {
  title: string;
  file: string;
  description: string;
}

interface ExplorationViewerProps {
  explorations: Exploration[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExplorationViewer({
  explorations,
  activeIndex,
  onIndexChange,
  open,
  onOpenChange,
}: ExplorationViewerProps) {
  const total = explorations.length;
  const current = explorations[activeIndex];

  const goPrev = useCallback(() => {
    onIndexChange((activeIndex - 1 + total) % total);
  }, [activeIndex, total, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange((activeIndex + 1) % total);
  }, [activeIndex, total, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, goPrev, goNext]);

  if (!current) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-4 z-50 flex flex-col rounded-xl shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Hidden title for a11y */}
          <DialogPrimitive.Title className="sr-only">
            {current.title}
          </DialogPrimitive.Title>

          {/* iframe fills the entire overlay */}
          <iframe
            key={current.file}
            src={`/explorations/${current.file}`}
            className="h-full w-full rounded-lg border border-red-500/15"
            title={current.title}
          />

          {/* Floating side rail */}
          <div className="absolute inset-y-0 right-0 flex items-center justify-center p-2">
            <div className="flex flex-col items-center gap-1.5 rounded-full border border-red-500/20 bg-black/60 px-1.5 py-2 shadow-[0_0_20px_rgba(255,80,60,0.2),0_0_8px_rgba(255,80,60,0.1)] backdrop-blur-md">
              <button
                onClick={goPrev}
                className="rounded-full p-1 text-red-400/70 transition-colors hover:text-red-300 focus:outline-none"
                aria-label="Previous exploration"
              >
                <ChevronUp className="h-4 w-4" />
              </button>

              <span className="select-none text-[10px] leading-none text-red-300/50">
                {activeIndex + 1}/{total}
              </span>

              <button
                onClick={goNext}
                className="rounded-full p-1 text-red-400/70 transition-colors hover:text-red-300 focus:outline-none"
                aria-label="Next exploration"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              <div className="w-4 border-t border-red-500/20" />

              <a
                href={`/explorations/${current.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full p-1 text-red-400/70 transition-colors hover:text-red-300 focus:outline-none"
                aria-label="Open in new tab"
              >
                <Maximize className="h-3.5 w-3.5" />
              </a>

              <DialogPrimitive.Close className="rounded-full p-1 text-red-400/70 transition-colors hover:text-red-300 focus:outline-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
