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
      'clínica', 'clínico', 'dental', 'dentista', 'odontología', 'odontólogo',
      'médico', 'medicina', 'doctor', 'hospital', 'consultorio', 'salud', 'saludable',
      'psicólogo', 'terapia', 'nutrición', 'nutriólogo', 'fisioterapia',
      'abogado', 'abogacía', 'bufete', 'legal', 'leyes', 'jurídico', 'notario',
      'contador', 'contabilidad', 'financiero', 'finanzas', 'seguros', 'seguro',
      'consultor', 'consultoría', 'profesional', 'profesión', 'despacho',
      'clinic', 'dental', 'dentist', 'medical', 'doctor', 'hospital', 'health',
      'lawyer', 'legal', 'law', 'attorney', 'accountant', 'accounting',
      'financial', 'finance', 'insurance', 'consulting', 'consultant',
    ],
  },
  {
    sector: 'gastronomía, café, catering',
    keywords: [
      'restaurante', 'restaurant', 'café', 'cafetería', 'bar', 'comida',
      'cocina', 'chef', 'catering', 'comensal', 'menú', 'carta', 'plato',
      'gastronomía', 'gastronómico', 'comedor', 'taquería', 'pizzería',
      'hamburguesería', 'heladería', 'panadería', 'pastelería', 'chocolatería',
      'food', 'food truck', 'brewery', 'cervecería', 'vinoteca', 'vino',
      'restaurant', 'cafe', 'coffee', 'bakery', 'pizzeria', 'brewery',
      'catering', 'kitchen', 'menu', 'dining', 'bistro', 'grill',
    ],
  },
  {
    sector: 'belleza, bienestar, suplementos',
    keywords: [
      'belleza', 'salón', 'peluquería', 'barbería', 'barbero', 'estética',
      'spa', 'masajes', 'masaje', 'cosmética', 'cosméticos', 'maquillaje',
      'uñas', 'manicura', 'pedicura', 'cuidado personal', 'piel',
      'bienestar', 'yoga', 'meditación', 'gimnasio', 'fitness', 'entrenador',
      'suplementos', 'nutrición deportiva', 'proteína',
      'beauty', 'salon', 'hair', 'barber', 'barbershop', 'spa', 'massage',
      'cosmetics', 'makeup', 'nails', 'nail salon', 'wellness', 'yoga',
      'gym', 'fitness', 'trainer', 'supplements', 'protein',
    ],
  },
  {
    sector: 'turismo, aventura, hotelería',
    keywords: [
      'hotel', 'hotelería', 'hospedaje', 'hostal', 'alojamiento',
      'turismo', 'turista', 'vacaciones', 'viaje', 'viajes', 'viajero',
      'aventura', 'excursión', 'tour', 'guía', 'guía turístico',
      'restaurante turístico', 'resort', 'bungalow', 'cabaña',
      'playa', 'montaña', 'río', 'ecoturismo', 'naturaleza',
      'buceo', 'snorkel', 'senderismo', 'trekking', 'canopy',
      'agencia de viajes', 'operador turístico', 'paquete turístico',
      'hotel', 'resort', 'hostel', 'lodging', 'accommodation',
      'tourism', 'tourist', 'travel', 'vacation', 'adventure', 'tour',
      'guide', 'beach', 'mountain', 'ecotourism', 'nature', 'diving',
      'snorkeling', 'hiking', 'trekking', 'travel agency',
    ],
  },
  {
    sector: 'comercio, tienda, retail',
    keywords: [
      'tienda', 'comercio', 'retail', 'e-commerce', 'ecommerce', 'shop',
      'store', 'producto', 'productos', 'catálogo', 'catalogo', 'venta',
      'vender', 'comprar', 'online', 'boutique', 'moda', 'ropa', 'accesorios',
      'calzado', 'zapatos', 'joyería', 'regalos', 'artesanía',
      'mueblería', 'muebles', 'decoración', 'hogar',
      'store', 'shop', 'ecommerce', 'retail', 'catalog', 'products',
      'fashion', 'clothing', 'accessories', 'shoes', 'jewelry', 'gifts',
      'furniture', 'home decor', 'boutique',
    ],
  },
  {
    sector: 'oficios, construcción, limpieza, transporte',
    keywords: [
      'construcción', 'constructor', 'constructora', 'obra', 'obras',
      'remodelación', 'remodelar', 'arquitecto', 'arquitectura',
      'ingeniero', 'ingeniería', 'electricista', 'plomero', 'plomería',
      'carpintero', 'carpintería', 'pintor', 'pintura',
      'limpieza', 'limpiar', 'jardinería', 'jardinero', 'piscina',
      'transporte', 'transportista', 'mudanza', 'mudanzas', 'flete',
      'taxi', 'uber', 'delivery', 'mensajería', 'logística',
      'construction', 'contractor', 'builder', 'remodel', 'architect',
      'engineer', 'electrician', 'plumber', 'carpenter', 'painter',
      'cleaning', 'cleaner', 'gardening', 'gardener', 'pool',
      'transport', 'transportation', 'moving', 'logistics', 'delivery',
      'courier', 'taxi', 'shipping',
    ],
  },
  {
    sector: 'turismo, aventura, hotelería',
    keywords: [
      'hotel', 'hotelería', 'hospedaje', 'hostal', 'alojamiento',
      'turismo', 'turista', 'vacaciones', 'viaje', 'viajes', 'viajero',
      'aventura', 'excursión', 'tour', 'guía', 'guía turístico',
      'restaurante turístico', 'resort', 'bungalow', 'cabaña',
      'playa', 'montaña', 'río', 'ecoturismo', 'naturaleza',
      'buceo', 'snorkel', 'senderismo', 'trekking', 'canopy',
      'agencia de viajes', 'operador turístico', 'paquete turístico',
      'hotel', 'resort', 'hostel', 'lodging', 'accommodation',
      'tourism', 'tourist', 'travel', 'vacation', 'adventure', 'tour',
      'guide', 'beach', 'mountain', 'ecotourism', 'nature', 'diving',
      'snorkeling', 'hiking', 'trekking', 'travel agency',
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
export function detectSector(message: string): string {
  if (!message) {
    return 'comercio, tienda, retail';
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
      const normalizedKeyword = keyword
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      /*
       * Single-word keywords: exact whole-word match ("hotel", "barbería").
       * Multi-word keywords: phrase match in the normalized text ("food truck",
       * "cuidado personal", "guía turístico", "home decor").
       */
      if (normalizedKeyword.includes(' ')) {
        if (normalized.includes(normalizedKeyword)) {
          return rule.sector;
        }
      } else if (words.has(normalizedKeyword)) {
        return rule.sector;
      }
    }
  }

  /*
   * Nothing matched. The safest fallback for a truly unknown request is "comercio"
   * because it has the broadest visual palette and the most neutral treatment.
   */
  return 'comercio, tienda, retail';
}