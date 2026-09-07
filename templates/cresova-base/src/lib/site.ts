/**
 * Everything about this client, in one place.
 *
 * Real data belongs here and nowhere else: scattering the phone number across six components is
 * how a site ends up with two different phone numbers, and how "Servicio 1" survives to
 * production. If a field has no real value yet, ask — do not invent one.
 *
 * Prices in lempiras, phones as +504 with eight digits, cities in Honduras, unless the client
 * says otherwise.
 */
export const site = {
  name: 'Piedra Viva',
  tagline: 'Cabañas y senderos en la montaña de Copán',
  city: 'Copán Ruinas, Honduras',
  address: 'Carretera a Sesesmil, km 4, Copán Ruinas',
  phone: '+504 9876 5432',
  whatsapp: '50498765432',
  email: 'reservas@piedraviva.hn',
  hours: 'Todos los días, 7:00 – 20:00',
  social: {
    instagram: 'https://instagram.com/piedraviva',
    facebook: 'https://facebook.com/piedraviva',
  },
} as const;

export const whatsappLink = (message: string) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
