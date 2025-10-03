import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, BanknoteXIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TransactionStatus = 'PENDING' | 'PAID';

interface StatusSelectorProps {
  currentStatus: TransactionStatus;
  onStatusChange: (status: TransactionStatus) => void;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'button' | 'badge';
}

const statusConfig = {
  PENDING: {
    label: 'Pendente',
    icon: BanknoteXIcon,
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    buttonClassName: 'bg-yellow-500 hover:bg-yellow-600 text-white'
  },
  PAID: {
    label: 'Pago',
    icon: Check,
    className: 'bg-green-100 text-green-800 hover:bg-green-200',
    buttonClassName: 'bg-green-500 hover:bg-green-600 text-white'
  }
};

export const StatusSelector: React.FC<StatusSelectorProps> = ({
  currentStatus,
  onStatusChange,
  disabled = false,
  size = 'default',
  variant = 'button'
}) => {
  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  const handleClick = () => {
    if (disabled) return;
    
    // Ciclar apenas entre PENDING e PAID
    const nextStatus: TransactionStatus = currentStatus === 'PENDING' ? 'PAID' : 'PENDING';
    onStatusChange(nextStatus);
  };

  if (variant === 'badge') {
    return (
      <Badge
        className={cn(
          "cursor-pointer transition-colors",
          config.className,
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={handleClick}
      >
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      className={cn(
        "transition-colors",
        config.buttonClassName,
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4 mr-2" />
      {config.label}
    </Button>
  );
};
