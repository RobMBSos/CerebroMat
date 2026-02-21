import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#0f766e] text-white hover:bg-[#0d5e59] focus-visible:ring-[#0f766e] dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400',
        secondary:
          'bg-[#f0fdfa] text-[#115e59] border border-[#99f6e4] hover:bg-[#ccfbf1] focus-visible:ring-[#14b8a6] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
        danger: 'bg-[#b91c1c] text-white hover:bg-[#991b1b] focus-visible:ring-[#b91c1c] dark:bg-rose-500 dark:text-slate-950 dark:hover:bg-rose-400',
        ghost: 'hover:bg-[#e2e8f0] text-slate-700 focus-visible:ring-slate-400 dark:text-slate-200 dark:hover:bg-slate-800',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
