/**
 * Cresova Builder wordmark.
 *
 * Drawn in markup rather than loaded as an image so it takes the app's own font and theme
 * colours. To use the real brand asset instead, drop it in public/ and replace the whole
 * return with an <img src="/logo-cresova.svg" /> pair.
 */
export function CresovaLogo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect width="26" height="26" rx="7" className="fill-accent" />
        <path d="M18.2 9.6a5.6 5.6 0 1 0 0 6.8" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-base font-semibold tracking-tight text-bolt-elements-textPrimary">Cresova</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent">Builder</span>
      </span>
    </span>
  );
}
