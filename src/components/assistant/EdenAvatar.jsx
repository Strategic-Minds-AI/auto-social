import { cn } from '@/lib/utils';

export const EDEN_PORTRAIT =
  'https://media.base44.com/images/public/6ac4dd914af935b8c986b411/aa98db844_FuturisticExecutiveinNeonOffice.png';

export default function EdenAvatar({ className, ring = true }) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 rounded-full overflow-hidden',
        ring && 'ring-2 ring-primary/40 glow-primary-sm',
        className
      )}
    >
      <img
        src={EDEN_PORTRAIT}
        alt="Eden Skye"
        className="w-full h-full object-cover object-top"
      />
    </span>
  );
}