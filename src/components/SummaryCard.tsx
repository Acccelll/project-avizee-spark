import React, { forwardRef } from 'react';
import { ArrowUpIcon, ArrowDownIcon, LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variation?: string;
  variationType?: 'positive' | 'negative' | 'neutral';
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  sparklineData?: number[];
  loading?: boolean;
}

const variantStyles: Record<string, { border: string; iconBg: string; iconColor: string }> = {
  default: { border: '', iconBg: 'bg-accent', iconColor: 'text-primary' },
  success: { border: 'border-l-4 border-l-success', iconBg: 'bg-success/10', iconColor: 'text-success' },
  danger: { border: 'border-l-4 border-l-destructive', iconBg: 'bg-destructive/10', iconColor: 'text-destructive' },
  warning: { border: 'border-l-4 border-l-warning', iconBg: 'bg-warning/10', iconColor: 'text-warning' },
  info: { border: 'border-l-4 border-l-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
};

export const SummaryCard = forwardRef<HTMLDivElement, SummaryCardProps>(
  function SummaryCard(
    {
      title,
      value,
      subtitle,
      variation,
      variationType = 'neutral',
      variant = 'default',
      icon: Icon,
      onClick,
      className,
      sparklineData,
      loading,
    },
    ref,
  ) {
    if (loading) {
      return (
        <div ref={ref} className={cn('stat-card', className)}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-11 w-11 rounded-lg" />
          </div>
        </div>
      );
    }
    const variationColors = {
      positive: 'text-success',
      negative: 'text-destructive',
      neutral: 'text-muted-foreground',
    };

    const styles = variantStyles[variant] || variantStyles.default;

    return (
      <div
        ref={ref}
        className={cn(
          'stat-card',
          styles.border,
          onClick && 'cursor-pointer hover:border-primary/30 active:scale-[0.98]',
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground font-medium tracking-wide truncate">{title}</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
            {variation && (
              <div className={cn('flex items-center gap-1 text-xs mt-1 font-medium', variationColors[variationType])}>
                {variationType === 'positive' && <ArrowUpIcon className="h-3 w-3" />}
                {variationType === 'negative' && <ArrowDownIcon className="h-3 w-3" />}
                <span>{variation}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn('p-3 rounded-lg', styles.iconBg)}>
              <Icon className={cn('w-5 h-5', styles.iconColor)} />
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-2 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData.map((v) => ({ v }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={variationType === 'negative' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }
);

export default SummaryCard;
