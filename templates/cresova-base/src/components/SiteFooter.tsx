import { Facebook, Instagram } from 'lucide-react';
import { site } from '../lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-surface">
      <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <p className="font-display text-lg font-semibold">{site.name}</p>
          <p className="mt-1 text-sm text-muted">
            {site.tagline} · {site.city}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a href={site.social.instagram} aria-label="Instagram" target="_blank" rel="noreferrer">
            <Instagram className="h-5 w-5 text-muted transition-colors duration-150 hover:text-accent" />
          </a>
          <a href={site.social.facebook} aria-label="Facebook" target="_blank" rel="noreferrer">
            <Facebook className="h-5 w-5 text-muted transition-colors duration-150 hover:text-accent" />
          </a>
        </div>
      </div>

      <div className="border-t border-ink/10 px-6 py-5 text-center text-xs text-muted md:px-10">
        © {new Date().getFullYear()} {site.name}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
