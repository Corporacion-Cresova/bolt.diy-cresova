import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '../lib/site';

/** Fixed bottom-right, 56px, accent ground. Present on every page of every one of these sites. */
export function WhatsAppFloat({ message }: { message: string }) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-surface shadow-raised transition-colors duration-150 hover:bg-accent-strong"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
