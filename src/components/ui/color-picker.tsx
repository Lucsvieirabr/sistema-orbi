import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#64748b",
  "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6", "#ffffff",
  "#000000", "#374151", "#1f2937", "#111827", "#0f172a", "#4f46e5"
];

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hexValue, setHexValue] = React.useState(value);

  React.useEffect(() => {
    setHexValue(value);
  }, [value]);

  const handleColorSelect = (color: string) => {
    onChange(color);
    setHexValue(color);
    setOpen(false);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexValue(newValue);
    
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleHexSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
      onChange(hexValue);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded border border-border"
              style={{ backgroundColor: value || "#e5e7eb" }}
            />
            <span>{value || "Selecionar cor"}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Cores predefinidas</h4>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "h-8 w-8 rounded border-2 border-border hover:scale-110 transition-transform",
                    value === color && "border-primary ring-2 ring-primary ring-offset-2"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-2">Cor personalizada</h4>
            <form onSubmit={handleHexSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="#000000"
                value={hexValue}
                onChange={handleHexChange}
                className="font-mono text-sm"
                maxLength={7}
              />
              <Button type="submit" size="sm">
                Aplicar
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-1">
              Digite um código hex (ex: #ff0000)
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
