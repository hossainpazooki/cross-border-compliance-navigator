// Product identity (brand source of truth)
export { type Product, PRODUCT } from './product';

// Runtime environment configuration (framework-agnostic env read site)
export { API_BASE_URL, WS_BASE_URL, STREAM_TRANSPORT } from './env';

// Form presets
export {
  type FormPreset,
  FORM_PRESETS,
  getPresetsByCategory,
  getPresetById,
} from './formPresets';

// Help content
export * from './help';
