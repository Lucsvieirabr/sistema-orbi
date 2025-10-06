import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DaySelectorProps {
  id?: string;
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DaySelector = React.forwardRef<HTMLInputElement, DaySelectorProps>(
  ({ id, label, value, onChange, placeholder = "1", className, disabled, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const numericValue = parseInt(inputValue);

      if (inputValue === "" || (numericValue >= 1 && numericValue <= 31)) {
        onChange(numericValue || 1);
      }
    };

    const handleDaySelect = (day: number) => {
      onChange(day);
      setOpen(false);
    };

    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className="relative">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between text-left font-normal border-2 border-border hover:border-primary focus:border-primary transition-colors bg-background",
                  !value && "text-muted-foreground"
                )}
                disabled={disabled}
              >
                <span>{value || placeholder}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[295px] p-0 border-2 border-border bg-background" align="start" side="bottom" sideOffset={4}>
              <div className="grid grid-cols-8 gap-2 p-2">
                {days.map((day) => (
                  <Button
                    key={day}
                    variant={value === day ? "default" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs border border-border hover:border-primary/50"
                    onClick={() => handleDaySelect(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          ref={ref}
          id={id}
          type="number"
          min={1}
          max={31}
          value={value || ""}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="hidden"
          disabled={disabled}
          {...props}
        />
      </div>
    );
  }
);

DaySelector.displayName = "DaySelector";
