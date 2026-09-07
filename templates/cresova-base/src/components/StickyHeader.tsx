import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { site } from '../lib/site';

/**
 * Transparent over the hero, solid with a backdrop blur once the page scrolls.
 *
 * The blur is the one on the page: backdrop-filter is expensive and every extra one costs
 * measurable scrolling lag on the phones these clients browse on.
 */
export function StickyHeader({ links }: { links: { label: string; href: string }[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${
        scrolled ? 'bg-bg/85 backdrop-blur border-b border-ink/10' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-container items-center justify-between px-6 py-4 md:px-10">
        <a href="#" className="font-display font-heading text-lg tracking-tight">
          {site.name}
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-muted transition-colors duration-150 hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-ink/10 bg-bg px-6 py-4 md:hidden">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="py-2 text-sm text-muted">
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
