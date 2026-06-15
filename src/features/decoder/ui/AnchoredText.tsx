/**
 * AnchoredText - Renders text with citation anchors that can highlight tree nodes
 * Citations are displayed as superscript numbers that can be clicked/hovered
 */

import { useMemo, useCallback } from 'react';
import type { Citation } from '@/types/decoder';
import { cn } from '@shared/lib';

interface AnchoredTextProps {
  text: string;
  citations?: Citation[];
  onCitationClick?: (citation: Citation) => void;
  onCitationHover?: (citationId: string | null) => void;
  highlightedCitationId?: string;
  className?: string;
}

interface TextSegment {
  type: 'text' | 'citation';
  content: string;
  citationIndex?: number;
  citation?: Citation;
}

/**
 * Parse text for citation markers like [1], [2], etc.
 * Returns segments of plain text and citation references
 */
function parseTextWithCitations(text: string, citations: Citation[]): TextSegment[] {
  // Match citation patterns like [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g;
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationPattern.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the citation reference
    const citationIndex = parseInt(match[1], 10) - 1; // Convert to 0-based index
    const citation = citations[citationIndex];
    segments.push({
      type: 'citation',
      content: match[0],
      citationIndex: citationIndex + 1,
      citation,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Split text into paragraphs while preserving whitespace structure
 */
function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\n+/);
}

export function AnchoredText({
  text,
  citations = [],
  onCitationClick,
  onCitationHover,
  highlightedCitationId,
  className,
}: AnchoredTextProps) {
  const paragraphs = useMemo(() => splitIntoParagraphs(text), [text]);

  const handleCitationClick = useCallback(
    (citation: Citation | undefined) => {
      if (citation && onCitationClick) {
        onCitationClick(citation);
      }
    },
    [onCitationClick]
  );

  const handleCitationHover = useCallback(
    (citationId: string | null) => {
      onCitationHover?.(citationId);
    },
    [onCitationHover]
  );

  return (
    <div className={cn('space-y-3', className)}>
      {paragraphs.map((paragraph, pIdx) => {
        const segments = parseTextWithCitations(paragraph, citations);

        return (
          <p key={pIdx} className="text-slate-200 leading-relaxed">
            {segments.map((segment, sIdx) => {
              if (segment.type === 'text') {
                return (
                  <span key={sIdx} className="whitespace-pre-wrap">
                    {segment.content}
                  </span>
                );
              }

              // Citation reference
              const isHighlighted = segment.citation?.id === highlightedCitationId;
              return (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleCitationClick(segment.citation)}
                  onMouseEnter={() => handleCitationHover(segment.citation?.id || null)}
                  onMouseLeave={() => handleCitationHover(null)}
                  className={cn(
                    'inline-flex items-center justify-center',
                    'ml-0.5 h-4 min-w-[1rem] rounded px-1',
                    'text-[10px] font-bold',
                    'transition-all cursor-pointer',
                    isHighlighted
                      ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500'
                      : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                  )}
                  title={segment.citation?.reference || `Citation ${segment.citationIndex}`}
                >
                  {segment.citationIndex}
                </button>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Helper to inject citation markers into text based on keyword matching
 * Useful when the backend doesn't provide pre-annotated text
 */
export function injectCitationMarkers(text: string, citations: Citation[]): string {
  let annotatedText = text;

  // Sort citations by reference length (longest first) to avoid partial matches
  const sortedCitations = [...citations].sort(
    (a, b) => b.reference.length - a.reference.length
  );

  sortedCitations.forEach((citation, index) => {
    // Look for the citation reference in the text
    const refPattern = new RegExp(
      `\\b${citation.reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi'
    );

    // Only add marker if not already present
    annotatedText = annotatedText.replace(refPattern, (match) => {
      const marker = `[${index + 1}]`;
      // Don't double-annotate
      if (annotatedText.includes(match + marker)) {
        return match;
      }
      return `${match} ${marker}`;
    });
  });

  return annotatedText;
}
