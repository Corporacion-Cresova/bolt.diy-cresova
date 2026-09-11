/**
 * Turns the assisted form's fields into the sentence the brief writer reads.
 *
 * Why a form at all: the wand rewrites what you already typed, so it is disabled — correctly —
 * when the box is empty. But the case that matters for an agency is exactly the empty box. Diego
 * has a business card in front of him: a name, a rubro, a city, one line about what they sell. He
 * does not have a prompt, and asking him to write one is asking him to do the part the tool is
 * supposed to do.
 *
 * What comes out of here is not a brief. It is the plain description a colleague would send, which
 * `/api/enhancer` then turns into the brief — the same path the wand uses. One code path, two ways
 * in.
 */
export interface BusinessFields {
  name: string;

  /**
   * El rubro específico: «clínica dental», «ferretería», «taller mecánico».
   *
   * Antes acá venía la fila entera de la tabla sectorial —«salud, legal, financiero,
   * profesional»— porque era lo único que el desplegable ofrecía. Decirle al redactor que el
   * negocio es cuatro rubros a la vez es pedirle el promedio de los cuatro.
   */
  rubro: string;
  city: string;
  offering: string;
  whatsapp: string;
  social: string;
}

export const emptyBusinessFields: BusinessFields = {
  name: '',
  rubro: '',
  city: '',
  offering: '',
  whatsapp: '',
  social: '',
};

/** The only field without which there is nothing to describe. */
export function canDescribeBusiness(fields: BusinessFields): boolean {
  return fields.name.trim().length > 0;
}

/**
 * Composes the description.
 *
 * Written as prose rather than a labelled list because the next step is a language model reading
 * it as a colleague's message, and a form dump ("Ciudad: —") teaches it that blank fields are
 * facts. An omitted line says nothing, which is the truth.
 *
 * The contact details are marked as confirmed on purpose: everything else in the brief comes back
 * under DATOS POR CONFIRMAR, and a phone number Diego typed in himself is not a guess.
 */
export function describeBusinessForBrief(fields: BusinessFields): string {
  const name = fields.name.trim();
  const rubro = fields.rubro.trim();
  const city = fields.city.trim();
  const offering = fields.offering.trim();
  const whatsapp = fields.whatsapp.trim();
  const social = fields.social.trim();

  const lines: string[] = [];

  const opening = [
    `Necesito el sitio de ${name}`,
    rubro ? `, un negocio de ${rubro}` : '',
    city ? `, en ${city}` : '',
    '.',
  ].join('');

  lines.push(opening);

  if (offering) {
    lines.push(`Lo que ofrece, en palabras del cliente: ${offering}`);
  }

  const confirmed: string[] = [];

  if (whatsapp) {
    confirmed.push(`WhatsApp ${whatsapp}`);
  }

  if (social) {
    confirmed.push(social);
  }

  if (confirmed.length) {
    lines.push(`Datos ya confirmados, usalos tal cual y no los pongas por confirmar: ${confirmed.join(', ')}.`);
  }

  return lines.join('\n');
}
