/**
 * Sector detector for Cresova Builder.
 *
 * Takes a user message (e.g. "una web para una clínica dental en Tegucigalpa")
 * and returns the matching sector from the design-kit's sector table.
 *
 * Without this, the image prompt builder uses buildPhotoQuery (which strips
 * keywords and returns the first 5 words) as a proxy for the sector, and the
 * generated Flux images end up with generic prompts. With it, the Flux prompt
 * includes the correct palette, mood, and composition cues from the sector.
 *
 * The sector names match the first column of the sector table in
 * cresova-design-kit.ts exactly, so callers can use the result as a lookup key
 * into that table.
 */

/*
 * Each sector is defined by the keywords a user would naturally use when asking
 * for a site in that industry. The words are in Spanish (the UI language) and
 * English (the model's internal language), covering both.
 *
 * Order matters: the first match wins, and more specific sectors come before
 * broader ones. "clínica" matches health before "oficina" matches commerce.
 */
const SECTOR_RULES: Array<{ sector: string; keywords: string[] }> = [
  {
    sector: 'salud, legal, financiero, profesional',
    keywords: [
      'clínica',
      'clínico',
      'dental',
      'dentista',
      'odontología',
      'odontólogo',
      'médico',
      'medicina',
      'doctor',
      'hospital',
      'consultorio',
      'salud',
      'saludable',
      'psicólogo',
      'terapia',
      'nutrición',
      'nutriólogo',
      'fisioterapia',
      'abogado',
      'abogacía',
      'bufete',
      'legal',
      'leyes',
      'jurídico',
      'notario',
      'contador',
      'contabilidad',
      'financiero',
      'finanzas',
      'seguros',
      'seguro',
      'consultor',
      'consultoría',
      'profesional',
      'profesión',
      'despacho',
      'clinic',
      'dental',
      'dentist',
      'medical',
      'doctor',
      'hospital',
      'health',
      'lawyer',
      'legal',
      'law',
      'attorney',
      'accountant',
      'accounting',
      'financial',
      'finance',
      'insurance',
      'consulting',
      'consultant',
      'farmacia',
      'farmacéutica',
      'botica',
      'óptica',
      'optometría',
      'laboratorio',
      'veterinaria',
      'veterinario',
      'radiología',
      'ultrasonido',
      'ortodoncia',
      'inmobiliaria',
      'bienes raíces',
      'aseguradora',
      'cooperativa',
      'financiera',
      'préstamos',
      'auditoría',
      'asesoría',
      'pharmacy',
      'optics',
      'laboratory',
      'veterinary',
      'real estate',
      'insurance',
      'credit union',
      'advisory',
    ],
  },
  {
    sector: 'gastronomía, café, catering',
    keywords: [
      'restaurante',
      'restaurant',
      'café',
      'cafetería',
      'bar',
      'comida',
      'cocina',
      'chef',
      'catering',
      'comensal',
      'menú',
      'carta',
      'plato',
      'gastronomía',
      'gastronómico',
      'comedor',
      'taquería',
      'pizzería',
      'hamburguesería',
      'heladería',
      'panadería',
      'pastelería',
      'chocolatería',
      'food',
      'food truck',
      'brewery',
      'cervecería',
      'vinoteca',
      'vino',
      'restaurant',
      'cafe',
      'coffee',
      'bakery',
      'pizzeria',
      'brewery',
      'catering',
      'kitchen',
      'menu',
      'dining',
      'bistro',
      'grill',
      'repostería',
      'pastelería',
      'bakery',
      'pastry',
    ],
  },
  {
    sector: 'belleza, bienestar, suplementos',
    keywords: [
      'belleza',
      'salón',
      'peluquería',
      'barbería',
      'barbero',
      'estética',
      'spa',
      'masajes',
      'masaje',
      'cosmética',
      'cosméticos',
      'maquillaje',
      'uñas',
      'manicura',
      'pedicura',
      'cuidado personal',
      'piel',
      'bienestar',
      'yoga',
      'meditación',
      'gimnasio',
      'fitness',
      'entrenador',
      'suplementos',
      'nutrición deportiva',
      'proteína',
      'beauty',
      'salon',
      'hair',
      'barber',
      'barbershop',
      'spa',
      'massage',
      'cosmetics',
      'makeup',
      'nails',
      'nail salon',
      'wellness',
      'yoga',
      'gym',
      'fitness',
      'trainer',
      'supplements',
      'protein',
      'tatuaje',
      'tatuajes',
      'tattoo',
      'piercing',
      'depilación',
      'pilates',
      'crossfit',
      'terapia física',
    ],
  },
  {
    sector: 'turismo, aventura, hotelería',
    keywords: [
      'hotel',
      'hotelería',
      'hospedaje',
      'hostal',
      'alojamiento',
      'turismo',
      'turista',
      'vacaciones',
      'viaje',
      'viajes',
      'viajero',
      'aventura',
      'excursión',
      'tour',
      'guía',
      'guía turístico',
      'restaurante turístico',
      'resort',
      'bungalow',
      'cabaña',
      'playa',
      'montaña',
      'río',
      'ecoturismo',
      'naturaleza',
      'buceo',
      'snorkel',
      'senderismo',
      'trekking',
      'canopy',
      'agencia de viajes',
      'operador turístico',
      'paquete turístico',
      'hotel',
      'resort',
      'hostel',
      'lodging',
      'accommodation',
      'tourism',
      'tourist',
      'travel',
      'vacation',
      'adventure',
      'tour',
      'guide',
      'beach',
      'mountain',
      'ecotourism',
      'nature',
      'diving',
      'snorkeling',
      'hiking',
      'trekking',
      'travel agency',
    ],
  },
  {
    sector: 'comercio, tienda, retail',
    keywords: [
      'tienda',
      'comercio',
      'retail',
      'e-commerce',
      'ecommerce',
      'shop',
      'store',
      'producto',
      'productos',
      'catálogo',
      'catalogo',
      'venta',
      'vender',
      'comprar',
      'online',
      'boutique',
      'moda',
      'ropa',
      'accesorios',
      'calzado',
      'zapatos',
      'joyería',
      'regalos',
      'artesanía',
      'mueblería',
      'muebles',
      'decoración',
      'hogar',
      'store',
      'shop',
      'ecommerce',
      'retail',
      'catalog',
      'products',
      'fashion',
      'clothing',
      'accessories',
      'shoes',
      'jewelry',
      'gifts',
      'furniture',
      'home decor',
      'boutique',
      'ferretería',
      'ferreteria',
      'librería',
      'papelería',
      'floristería',
      'florería',
      'juguetería',
      'perfumería',
      'zapatería',
      'mueblería',
      'agroservicio',
      'distribuidora',
      'mayorista',
      'abarrotes',
      'pulpería',
      'bazar',
      'hardware store',
      'bookstore',
      'stationery',
      'flower shop',
      'toy store',
      'shoe store',
      'furniture',
      'wholesale',
    ],
  },
  {
    sector: 'oficios, construcción, limpieza, transporte',
    keywords: [
      'construcción',
      'constructor',
      'constructora',
      'obra',
      'obras',
      'remodelación',
      'remodelar',
      'arquitecto',
      'arquitectura',
      'ingeniero',
      'ingeniería',
      'electricista',
      'plomero',
      'plomería',
      'carpintero',
      'carpintería',
      'pintor',
      'pintura',
      'limpieza',
      'limpiar',
      'jardinería',
      'jardinero',
      'piscina',
      'transporte',
      'transportista',
      'mudanza',
      'mudanzas',
      'flete',
      'taxi',
      'uber',
      'delivery',
      'mensajería',
      'logística',
      'construction',
      'contractor',
      'builder',
      'remodel',
      'architect',
      'engineer',
      'electrician',
      'plumber',
      'carpenter',
      'painter',
      'cleaning',
      'cleaner',
      'gardening',
      'gardener',
      'pool',
      'transport',
      'transportation',
      'moving',
      'logistics',
      'delivery',
      'courier',
      'taxi',
      'shipping',
      'taller',
      'mecánico',
      'mecánica',
      'automotriz',
      'herrería',
      'herrero',
      'carpintería',
      'carpintero',
      'soldadura',
      'imprenta',
      'serigrafía',
      'lavandería',
      'cerrajería',
      'refrigeración',
      'aire acondicionado',
      'fumigación',
      'jardinería',
      'workshop',
      'mechanic',
      'welding',
      'printing',
      'laundry',
      'locksmith',
      'landscaping',
    ],
  },
  {
    sector: 'turismo, aventura, hotelería',
    keywords: [
      'hotel',
      'hotelería',
      'hospedaje',
      'hostal',
      'alojamiento',
      'turismo',
      'turista',
      'vacaciones',
      'viaje',
      'viajes',
      'viajero',
      'aventura',
      'excursión',
      'tour',
      'guía',
      'guía turístico',
      'restaurante turístico',
      'resort',
      'bungalow',
      'cabaña',
      'playa',
      'montaña',
      'río',
      'ecoturismo',
      'naturaleza',
      'buceo',
      'snorkel',
      'senderismo',
      'trekking',
      'canopy',
      'agencia de viajes',
      'operador turístico',
      'paquete turístico',
      'hotel',
      'resort',
      'hostel',
      'lodging',
      'accommodation',
      'tourism',
      'tourist',
      'travel',
      'vacation',
      'adventure',
      'tour',
      'guide',
      'beach',
      'mountain',
      'ecotourism',
      'nature',
      'diving',
      'snorkeling',
      'hiking',
      'trekking',
      'travel agency',
    ],
  },
];

/**
 * Detects the closest sector from a user message.
 *
 * Matches on whole words only (split by whitespace), not substrings, so "barbería"
 * does not match "bar" (gastronomía) and "hotel boutique" does not match "boutique"
 * (comercio) before "hotel" (turismo).
 *
 * Returns the sector name from the design-kit table, or "comercio, tienda, retail"
 * as the broadest and safest fallback for an unknown request.
 */
/**
 * The sectors, in the order the assisted brief form offers them.
 *
 * Derived from the rules rather than typed out again: the form, the detector and the design kit
 * have to agree on the exact strings, because the brief prompt looks each one up in its table by
 * name. A second hand-written list is a second thing to forget to update.
 */
export const SECTOR_NAMES: string[] = [...new Set(SECTOR_RULES.map((rule) => rule.sector))];

export interface SectorMatch {
  /** La fila de la tabla sectorial, o el default cuando no hubo coincidencia. */
  sector: string;

  /**
   * Falso cuando ninguna palabra clave coincidió y `sector` es solo el default.
   *
   * Esta distinción es la pieza que faltaba, y su ausencia costaba caro. Medido contra 54 rubros
   * reales de negocio pequeño hondureño, más de la mitad caían en «comercio, tienda, retail» sin
   * ser comercio: farmacias, ópticas, talleres, imprentas, colegios, funerarias, aseguradoras.
   * Como el default era indistinguible de un acierto, el sitio salía con la tipografía, la paleta
   * y el ejemplo de un rubro que no era el del cliente, y nadie tenía forma de saberlo.
   *
   * Algunos de esos casos ahora sí tienen palabra clave. Pero la lista de rubros que una agencia
   * atiende no se termina nunca, así que el arreglo de fondo no es una lista más larga: es que
   * cuando no sabemos, se diga. Quien recibe ese «no sé» —el modelo, que tiene la tabla completa
   * enfrente y la descripción del negocio— elige mejor que un default.
   */
  matched: boolean;
}

/**
 * El default cuando nada coincide.
 *
 * Sigue siendo comercio porque es el tratamiento más neutro de la tabla, pero ahora viaja
 * acompañado de `matched: false`, que es lo que permite tratarlo como lo que es.
 */
const FALLBACK_SECTOR = 'comercio, tienda, retail';

export function detectSectorMatch(message: string): SectorMatch {
  if (!message) {
    return { sector: FALLBACK_SECTOR, matched: false };
  }

  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  /*
   * Tokenize into whole words so we do not match substrings. "barbería" contains
   * "bar" at the character level, but "bar" is a gastronomía keyword and barbería
   * is a belleza keyword — the whole-word check prevents the false positive.
   */
  const words = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));

  for (const rule of SECTOR_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      /*
       * Single-word keywords: exact whole-word match ("hotel", "barbería").
       * Multi-word keywords: phrase match in the normalized text ("food truck",
       * "cuidado personal", "guía turístico", "home decor").
       */
      if (normalizedKeyword.includes(' ')) {
        if (normalized.includes(normalizedKeyword)) {
          return { sector: rule.sector, matched: true };
        }
      } else if (words.has(normalizedKeyword)) {
        return { sector: rule.sector, matched: true };
      }
    }
  }

  return { sector: FALLBACK_SECTOR, matched: false };
}

/**
 * El sector como string, para quien no necesita saber si fue un acierto o el default.
 *
 * Lo usa el catálogo de fotos: una paleta neutra es una respuesta razonable para un rubro
 * desconocido, y ahí el default no hace daño.
 */
export function detectSector(message: string): string {
  return detectSectorMatch(message).sector;
}
