import { PRODUCT } from '@shared/config';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
      <p>
        {PRODUCT.name} · {PRODUCT.expansion}
      </p>
      <p className="mt-1">
        Research/demo project. Not legal advice. Consult qualified counsel.
      </p>
    </footer>
  );
}
