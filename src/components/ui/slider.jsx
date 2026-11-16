import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

export function Slider({ className, thumbLabel, ...props }) {
  return <SliderPrimitive.Root className={cn('relative flex w-full touch-none select-none items-center', className)} {...props}>
    <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-[#4a5548]"><SliderPrimitive.Range className="absolute h-full bg-[#d8f27b]" /></SliderPrimitive.Track>
    <SliderPrimitive.Thumb aria-label={thumbLabel} className="block h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>;
}
