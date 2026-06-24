import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCrossings, useConnection } from '../selectors';
import { ThresholdCard } from './ThresholdCard';

const ESTIMATED_CARD_HEIGHT = 220;
const SCROLL_PIN_THRESHOLD_PX = 100;

interface ThresholdFeedProps {
  intentId: string;
  /** When provided, cards offer an "Inspect in org" affordance driving the org panel. */
  onSelectCrossing?: (crossingId: string) => void;
  selectedCrossingId?: string | null;
}

export function ThresholdFeed({ intentId, onSelectCrossing, selectedCrossingId }: ThresholdFeedProps) {
  const crossings = useCrossings(intentId);
  const connection = useConnection(intentId);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [pinToTop, setPinToTop] = useState(true);

  const virtualizer = useVirtualizer({
    count: crossings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 4,
    getItemKey: (index) => crossings[index].crossing_id,
  });

  useEffect(() => {
    if (pinToTop && parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [crossings.length, pinToTop]);

  if (crossings.length === 0) {
    return (
      <div
        ref={parentRef}
        className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-800 p-8 text-center"
      >
        <div className="space-y-2">
          <p className="text-slate-300">Waiting for first crossing…</p>
          <p className="text-xs text-slate-400">connection: {connection}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        setPinToTop(top < SCROLL_PIN_THRESHOLD_PX);
      }}
      className="h-full overflow-y-auto"
      role="feed"
      aria-busy={connection !== 'open'}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const crossing = crossings[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: '0.75rem',
              }}
            >
              <ThresholdCard
                intentId={intentId}
                crossing={crossing}
                onSelect={onSelectCrossing}
                selected={crossing.crossing_id === selectedCrossingId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
