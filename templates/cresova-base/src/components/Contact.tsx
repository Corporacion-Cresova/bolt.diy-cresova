import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Section, Eyebrow, SectionTitle } from './Section';
import { Button } from './Button';
import { site, whatsappLink } from '../lib/site';

/**
 * Contact in two columns: the action on one side, the practical facts on the other.
 *
 * The action is WhatsApp, because that is how these clients are actually reached, and the message
 * arrives pre-written so the visitor does not have to compose one.
 */
interface ContactProps {
  eyebrow: string;
  title: string;
  description: string;
  whatsappMessage: string;
  serviceArea?: string[];
  ground?: 'bg' | 'surface' | 'tint';
}

export function Contact({
  eyebrow,
  title,
  description,
  whatsappMessage,
  serviceArea,
  ground = 'bg',
}: ContactProps) {
  return (
    <Section ground={ground} id="contacto" size="roomy">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <SectionTitle>{title}</SectionTitle>
          <p className="mt-4 max-w-measure text-muted">{description}</p>

          <Button href={whatsappLink(whatsappMessage)} target="_blank" rel="noreferrer" className="mt-8">
            <MessageCircle className="h-4 w-4" />
            Escribir por WhatsApp
          </Button>
        </div>

        <dl className="space-y-6 rounded-panel bg-surface p-8 shadow-raised">
          <div className="flex gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <dt className="text-sm text-muted">Teléfono</dt>
              <dd className="font-semibold">
                <a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a>
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <dt className="text-sm text-muted">Dirección</dt>
              <dd className="font-semibold">{site.address}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <dt className="text-sm text-muted">Horario</dt>
              <dd className="font-semibold">{site.hours}</dd>
            </div>
          </div>
          {serviceArea && serviceArea.length > 0 && (
            <div className="border-t border-ink/10 pt-6">
              <dt className="text-sm text-muted">Zona de servicio</dt>
              <dd className="mt-1 font-semibold">{serviceArea.join(' · ')}</dd>
            </div>
          )}
        </dl>
      </div>
    </Section>
  );
}
