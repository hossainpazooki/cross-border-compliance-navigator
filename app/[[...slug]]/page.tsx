import { Client } from './client';

// Catch-all Server Component entry. The actual SPA (react-router under a
// BrowserRouter) mounts client-side via ./client. Static segments added in
// Stage 3 (app/v2/*, app/audit/*) take precedence over this optional catch-all,
// so route handlers and the SPA coexist.
export default function Page() {
  return <Client />;
}
