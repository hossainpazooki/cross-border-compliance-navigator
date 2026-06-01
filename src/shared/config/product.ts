/**
 * Product identity — single source of truth for the COMPASS brand.
 *
 * COMPASS = Compliance Orchestration for Multi-jurisdiction Pathways
 * And Streaming Surveillance.
 *
 * Header, CanvasHeader, Footer, and any future surface read brand strings
 * from here, so a rename touches one file instead of four. The static
 * `index.html` <title> is the one place that cannot import this and is kept
 * in sync manually.
 */
export const PRODUCT = {
  /** Short wordmark shown as the app H1. */
  name: 'COMPASS',
  /** Full backronym expansion. */
  expansion:
    'Compliance Orchestration for Multi-jurisdiction Pathways And Streaming Surveillance',
  /** One-line product description (marketing / README / meta). */
  tagline:
    'Real-time cross-border digital-asset compliance that streams threshold-crossing risk indicators with NLI-verified rationale.',
  /** Compact subtitle for headers. */
  shortTagline: 'Cross-border digital-asset compliance, in real time',
  /** Monogram for the logo badge (Compliance Orchestration). */
  monogram: 'CO',
} as const;

export type Product = typeof PRODUCT;
