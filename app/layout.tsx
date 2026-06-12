import type { Metadata } from 'next';
import { PRODUCT } from '../src/shared/config/product';
import { Providers } from './providers';
import '../src/index.css';

export const metadata: Metadata = {
  title: `${PRODUCT.name} — ${PRODUCT.shortTagline}`,
  description: PRODUCT.tagline,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
