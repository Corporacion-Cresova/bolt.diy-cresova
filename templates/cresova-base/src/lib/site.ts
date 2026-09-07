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

/**
 * The catalogue, as an array.
 *
 * Real names and real prices in lempiras. A catalogue of «Producto 1 · L 0» is worse than no
 * catalogue at all: it is the section a shop owner looks at first, and the one where invented
 * filler is most obvious to them.
 */
export interface Product {
  name: string;
  category: string;
  price: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

export const catalogue: Product[] = [
  {
    name: 'Sendero de café, medio día',
    category: 'Experiencias',
    price: 'L 650',
    description:
      'Cuatro horas por la finca vecina, con corte, tueste y taza al final. Sale a las 6:00 y regresa para el almuerzo.',
    imageUrl: 'https://images.pexels.com/photos/1183099/pexels-photo-1183099.jpeg?auto=compress&cs=tinysrgb&w=940',
    imageAlt: 'La montaña al amanecer, vista desde el sendero',
  },
  {
    name: 'Cabaña doble',
    category: 'Hospedaje',
    price: 'L 1,850 / noche',
    description: 'Cama matrimonial, baño privado con agua caliente y terraza propia. Desayuno de finca incluido.',
    imageUrl: 'https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg?auto=compress&cs=tinysrgb&w=940',
    imageAlt: 'Cabaña de madera al anochecer, entre el bosque',
  },
  {
    name: 'Cabaña familiar',
    category: 'Hospedaje',
    price: 'L 2,900 / noche',
    description: 'Hasta cuatro personas, dos habitaciones y sala con chimenea. Desayuno incluido para todos.',
    imageUrl: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=940',
    imageAlt: 'Laguna y bosque de pinos en la ruta de senderismo',
  },
];

export const whatsappLink = (message: string) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
