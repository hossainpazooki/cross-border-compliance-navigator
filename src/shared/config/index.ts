// Product identity (brand source of truth)
export { type Product, PRODUCT } from './product';

// Runtime environment configuration (framework-agnostic env read site)
export { API_BASE_URL, WS_BASE_URL, STREAM_TRANSPORT } from './env';

// Desk model (org-first home base; demo identity — see app/stores/deskStore)
export {
  type Desk,
  type DeskMember,
  type DeskRole,
  DESKS,
  deskById,
} from './desks';

// Form presets
export {
  type FormPreset,
  FORM_PRESETS,
  getPresetsByCategory,
  getPresetById,
} from './formPresets';

// Help content
export * from './help';
