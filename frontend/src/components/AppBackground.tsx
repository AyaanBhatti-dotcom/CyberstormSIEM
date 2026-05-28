import { cn } from '@/lib/utils';
import { DottedSurface } from '@/components/ui/dotted-surface';

/** Full-viewport animated background + Cyberstorm red vignette */
export function AppBackground() {
  return (
    <>
      <DottedSurface surfaceTheme="dark" />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-0 -z-[9]',
          'bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.12),transparent_55%)]',
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[9] bg-gradient-to-b from-black/40 via-transparent to-black/80"
      />
    </>
  );
}
