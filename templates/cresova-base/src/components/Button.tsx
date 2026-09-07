import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/**
 * The two buttons this kind of page needs, and no more.
 *
 * Hover changes colour and nothing else: no scaling, no glow. Both are anchors because on these
 * sites every action is a link — to WhatsApp, to a phone number, to a section further down.
 */
interface ButtonProps extends ComponentPropsWithoutRef<'a'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-surface hover:bg-accent-strong'
      : 'border border-ink/15 text-ink hover:border-ink/40';

  return (
    <a
      className={`inline-flex items-center gap-2 rounded-control px-5 py-3 text-sm font-semibold transition-colors duration-150 ${styles} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
