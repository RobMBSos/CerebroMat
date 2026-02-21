import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-semibold text-[#166534] dark:bg-cyan-950 dark:text-cyan-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
