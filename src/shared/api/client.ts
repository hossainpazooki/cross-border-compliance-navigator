import axios, { AxiosInstance, AxiosError } from 'axios';

// REST origin. Defaults to the local @platform/reference-backend (:8787) so
// `npm run dev:all` works with zero env setup. Production sets VITE_API_URL
// explicitly (Vercel); navigate/decoder/counterfactual fall back to in-app demo.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const message = (error.response.data as { detail?: string })?.detail || error.message;
      console.error(`API Error [${error.response.status}]:`, message);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}
