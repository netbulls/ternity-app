import { cn } from '@/lib/utils';
import { PROJECT_COLORS } from '@ternity/shared';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'h-7 w-7 rounded-md border-2 transition-all',
            value === color
              ? 'border-foreground scale-110'
              : 'border-transparent hover:border-muted-foreground/50',
          )}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}
