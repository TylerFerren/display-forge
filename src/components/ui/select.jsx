import { cn } from '../../lib/utils';

export function Select({ className, children, ...props }) {
  return <select className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring', className)} {...props}>{children}</select>;
}
