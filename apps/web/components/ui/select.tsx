import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectOption = {
  label: string;
  value: string;
};

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
};

export function Select({ className, options, ...props }: Props) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
