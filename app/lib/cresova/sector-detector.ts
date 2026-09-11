/**
 * Detector de rubro para Cresova Builder.
 *
 * Devuelve dos cosas distintas que antes eran una sola, y confundirlas costaba calidad:
 *
 *   - **El rubro**: qué es el negocio. «clínica dental», «ferretería», «taller mecánico». Decide
 *     el contenido — qué secciones van, con qué vocabulario, qué teme quien visita la página, qué
 *     lleva el catálogo. Una clínica dental y un bufete de abogados no comparten nada de esto.
 *   - **La familia visual**: la fila de la tabla del design kit. Decide paleta, tipografía, peso y
 *     fondo. Acá sí comparten: la clínica y el bufete pueden usar Instrument Sans sin problema.
 *
 * Antes existía solamente la familia, y el desplegable del formulario ofrecía esa fila como si
 * fuera el rubro. Elegir «salud, legal, financiero, profesional» para una clínica dental le dice
 * al redactor del brief que el negocio es cuatro rubros a la vez, y lo que sale es el promedio de
 * los cuatro: un sitio que no se equivoca y tampoco es de nadie.
 *
 * El orden del arreglo es el orden de evaluación y lo específico va antes que lo genérico: «taller
 * de carpintería» tiene que caer en carpintería y no en taller mecánico, y «nutrición deportiva»
 * en suplementos y no en tienda deportiva.
 */

/** Las filas de la tabla sectorial del design kit, tal cual están escritas ahí. */
export const FAMILIAS = {
  SALUD: 'salud, legal, financiero, profesional',
  GASTRO: 'gastronomía, café, catering',
  BELLEZA: 'belleza, bienestar, suplementos',
  TURISMO: 'turismo, aventura, hotelería',
  TALLER: 'taller, motos, automotriz, deporte',
  OFICIOS: 'oficios, construcción, limpieza, transporte',
  COMERCIO: 'comercio, tienda, retail',
} as const;

export type Familia = (typeof FAMILIAS)[keyof typeof FAMILIAS];

interface RubroRule {
  /** Cómo lo diría el cliente. Es lo que decide el contenido del sitio. */
  rubro: string;

  /** La fila del design kit. Es lo que decide paleta y tipografía. */
  familia: Familia;

  /**
   * Lo que alguien escribiría al pedir este sitio, en español y en inglés.
   *
   * Una palabra suelta se compara como palabra entera, así que «barbería» no matchea «bar». Una
   * frase se busca como frase dentro del texto normalizado.
   */
  keywords: string[];
}

const RUBRO_RULES: RubroRule[] = [
  {
    rubro: 'clínica dental',
    familia: FAMILIAS.SALUD,
    keywords: ['dental', 'dentista', 'odontología', 'odontólogo', 'ortodoncia', 'ortodoncista', 'dentist'],
  },
  {
    rubro: 'clínica veterinaria',
    familia: FAMILIAS.SALUD,
    keywords: ['veterinaria', 'veterinario', 'veterinary'],
  },
  {
    rubro: 'farmacia',
    familia: FAMILIAS.SALUD,
    keywords: ['farmacia', 'farmacéutica', 'botica', 'pharmacy'],
  },
  {
    rubro: 'óptica',
    familia: FAMILIAS.SALUD,
    keywords: ['óptica', 'optometría', 'optometrista', 'optics'],
  },
  {
    rubro: 'laboratorio clínico',
    familia: FAMILIAS.SALUD,
    keywords: ['laboratorio', 'radiología', 'ultrasonido', 'laboratory'],
  },
  {
    rubro: 'fisioterapia y rehabilitación',
    familia: FAMILIAS.SALUD,
    keywords: ['fisioterapia', 'fisioterapeuta', 'rehabilitación', 'quiropráctico', 'terapia física', 'physiotherapy'],
  },
  {
    rubro: 'consulta de psicología',
    familia: FAMILIAS.SALUD,
    keywords: ['psicólogo', 'psicóloga', 'psicología', 'psiquiatra', 'psicoterapia', 'salud mental', 'psychologist'],
  },
  {
    rubro: 'consulta de nutrición',
    familia: FAMILIAS.SALUD,
    keywords: ['nutriólogo', 'nutricionista', 'nutrición', 'dietista', 'nutritionist'],
  },
  {
    rubro: 'clínica médica',
    familia: FAMILIAS.SALUD,
    keywords: [
      'clínica',
      'clínico',
      'consultorio',
      'médico',
      'medicina',
      'doctor',
      'hospital',
      'pediatra',
      'ginecólogo',
      'dermatólogo',
      'medical',
      'clinic',
    ],
  },
  {
    rubro: 'bufete de abogados',
    familia: FAMILIAS.SALUD,
    keywords: [
      'abogado',
      'abogada',
      'abogacía',
      'bufete',
      'legal',
      'leyes',
      'jurídico',
      'notario',
      'lawyer',
      'law',
      'attorney',
    ],
  },
  {
    rubro: 'contabilidad y auditoría',
    familia: FAMILIAS.SALUD,
    keywords: ['contador', 'contadora', 'contabilidad', 'auditoría', 'accountant', 'accounting'],
  },
  {
    rubro: 'cooperativa de ahorro y crédito',
    familia: FAMILIAS.SALUD,
    keywords: ['cooperativa', 'credit union'],
  },
  {
    rubro: 'aseguradora',
    familia: FAMILIAS.SALUD,
    keywords: ['seguros', 'seguro', 'aseguradora', 'insurance'],
  },
  {
    rubro: 'inmobiliaria',
    familia: FAMILIAS.SALUD,
    keywords: ['inmobiliaria', 'bienes raíces', 'real estate'],
  },
  {
    rubro: 'asesoría financiera',
    familia: FAMILIAS.SALUD,
    keywords: ['financiero', 'financiera', 'finanzas', 'préstamos', 'financial', 'finance'],
  },
  {
    rubro: 'consultoría profesional',
    familia: FAMILIAS.SALUD,
    keywords: [
      'consultor',
      'consultora',
      'consultoría',
      'asesoría',
      'despacho',
      'profesional',
      'profesión',
      'consulting',
      'consultant',
      'advisory',
    ],
  },
  {
    rubro: 'salud en general',
    familia: FAMILIAS.SALUD,
    keywords: ['salud', 'saludable', 'health'],
  },
  {
    rubro: 'panadería y repostería',
    familia: FAMILIAS.GASTRO,
    keywords: ['panadería', 'pastelería', 'repostería', 'chocolatería', 'bakery', 'pastry'],
  },
  {
    rubro: 'heladería',
    familia: FAMILIAS.GASTRO,
    keywords: ['heladería', 'ice cream'],
  },
  {
    rubro: 'pizzería',
    familia: FAMILIAS.GASTRO,
    keywords: ['pizzería', 'pizzeria', 'pizza'],
  },
  {
    rubro: 'comida rápida',
    familia: FAMILIAS.GASTRO,
    keywords: ['taquería', 'hamburguesería', 'food truck', 'baleadas'],
  },
  {
    rubro: 'bar y cervecería',
    familia: FAMILIAS.GASTRO,
    keywords: ['bar', 'cervecería', 'brewery', 'vinoteca', 'vino', 'cantina'],
  },
  {
    rubro: 'cafetería',
    familia: FAMILIAS.GASTRO,
    keywords: ['cafetería', 'café', 'cafe', 'coffee'],
  },
  {
    rubro: 'servicio de catering',
    familia: FAMILIAS.GASTRO,
    keywords: ['catering', 'banquetes'],
  },
  {
    rubro: 'restaurante',
    familia: FAMILIAS.GASTRO,
    keywords: [
      'restaurante',
      'restaurant',
      'comida',
      'cocina',
      'chef',
      'comensal',
      'menú',
      'carta',
      'plato',
      'comedor',
      'gastronomía',
      'gastronómico',
      'dining',
      'bistro',
      'grill',
      'kitchen',
      'menu',
      'food',
    ],
  },
  {
    rubro: 'barbería',
    familia: FAMILIAS.BELLEZA,
    keywords: ['barbería', 'barbero', 'barber', 'barbershop'],
  },
  {
    rubro: 'estudio de tatuajes',
    familia: FAMILIAS.BELLEZA,
    keywords: ['tatuaje', 'tatuajes', 'tattoo', 'piercing'],
  },
  {
    rubro: 'salón de uñas',
    familia: FAMILIAS.BELLEZA,
    keywords: ['uñas', 'manicura', 'pedicura', 'nails', 'nail salon'],
  },
  {
    rubro: 'spa y masajes',
    familia: FAMILIAS.BELLEZA,
    keywords: ['spa', 'masajes', 'masaje', 'massage'],
  },
  {
    rubro: 'centro de depilación',
    familia: FAMILIAS.BELLEZA,
    keywords: ['depilación', 'waxing'],
  },
  {
    rubro: 'estudio de yoga y pilates',
    familia: FAMILIAS.BELLEZA,
    keywords: ['yoga', 'pilates', 'meditación'],
  },
  {
    rubro: 'gimnasio',
    familia: FAMILIAS.BELLEZA,
    keywords: ['gimnasio', 'gym', 'crossfit', 'fitness', 'entrenador', 'trainer'],
  },
  {
    rubro: 'venta de suplementos',
    familia: FAMILIAS.BELLEZA,
    keywords: ['suplementos', 'proteína', 'nutrición deportiva', 'supplements', 'protein'],
  },
  {
    rubro: 'salón de belleza',
    familia: FAMILIAS.BELLEZA,
    keywords: [
      'salón',
      'peluquería',
      'belleza',
      'estética',
      'cosmética',
      'cosméticos',
      'maquillaje',
      'salon',
      'hair',
      'beauty',
      'cosmetics',
      'makeup',
    ],
  },
  {
    rubro: 'centro de bienestar',
    familia: FAMILIAS.BELLEZA,
    keywords: ['bienestar', 'wellness', 'cuidado personal', 'piel', 'skincare'],
  },
  {
    rubro: 'hotel',
    familia: FAMILIAS.TURISMO,
    keywords: ['hotel', 'hotelería', 'resort', 'hospedaje', 'alojamiento', 'lodging', 'accommodation'],
  },
  {
    rubro: 'hostal',
    familia: FAMILIAS.TURISMO,
    keywords: ['hostal', 'hostel'],
  },
  {
    rubro: 'cabañas',
    familia: FAMILIAS.TURISMO,
    keywords: ['cabaña', 'cabañas', 'bungalow'],
  },
  {
    rubro: 'centro de buceo',
    familia: FAMILIAS.TURISMO,
    keywords: ['buceo', 'snorkel', 'diving', 'snorkeling'],
  },
  {
    rubro: 'agencia de viajes',
    familia: FAMILIAS.TURISMO,
    keywords: ['agencia de viajes', 'travel agency', 'viaje', 'viajes', 'viajero', 'vacaciones', 'vacation', 'travel'],
  },
  {
    rubro: 'tour operador',
    familia: FAMILIAS.TURISMO,
    keywords: ['tour', 'excursión', 'operador turístico', 'paquete turístico', 'guía turístico', 'guía', 'guide'],
  },
  {
    rubro: 'turismo de aventura',
    familia: FAMILIAS.TURISMO,
    keywords: [
      'aventura',
      'ecoturismo',
      'senderismo',
      'trekking',
      'canopy',
      'rafting',
      'adventure',
      'hiking',
      'ecotourism',
    ],
  },
  {
    rubro: 'turismo en general',
    familia: FAMILIAS.TURISMO,
    keywords: [
      'turismo',
      'turista',
      'tourism',
      'tourist',
      'playa',
      'montaña',
      'río',
      'naturaleza',
      'beach',
      'mountain',
      'nature',
    ],
  },
  {
    rubro: 'venta de repuestos',
    familia: FAMILIAS.TALLER,
    keywords: ['repuestos', 'autopartes', 'llantas', 'auto parts'],
  },
  {
    rubro: 'taller de motos',
    familia: FAMILIAS.TALLER,
    keywords: ['motos', 'moto', 'motocicleta', 'motorcycle'],
  },
  {
    rubro: 'autolavado',
    familia: FAMILIAS.TALLER,
    keywords: ['autolavado', 'car wash', 'lavado de autos'],
  },
  {
    rubro: 'venta de vehículos',
    familia: FAMILIAS.TALLER,
    keywords: ['concesionario', 'venta de carros', 'automóviles', 'dealership'],
  },
  {
    rubro: 'tienda deportiva',
    familia: FAMILIAS.TALLER,
    keywords: ['deportiva', 'deportivo', 'deportes', 'deporte', 'sports'],
  },
  {
    rubro: 'taller mecánico',
    familia: FAMILIAS.TALLER,
    keywords: ['taller', 'mecánico', 'mecánica', 'automotriz', 'enderezado', 'mechanic', 'automotive'],
  },
  {
    rubro: 'constructora',
    familia: FAMILIAS.OFICIOS,
    keywords: ['construcción', 'constructor', 'constructora', 'obra', 'obras', 'construction', 'contractor', 'builder'],
  },
  {
    rubro: 'remodelación',
    familia: FAMILIAS.OFICIOS,
    keywords: ['remodelación', 'remodelar', 'remodel'],
  },
  {
    rubro: 'estudio de arquitectura',
    familia: FAMILIAS.OFICIOS,
    keywords: ['arquitecto', 'arquitecta', 'arquitectura', 'architect'],
  },
  {
    rubro: 'ingeniería',
    familia: FAMILIAS.OFICIOS,
    keywords: ['ingeniero', 'ingeniera', 'ingeniería', 'engineer'],
  },
  {
    rubro: 'electricista',
    familia: FAMILIAS.OFICIOS,
    keywords: ['electricista', 'electrician'],
  },
  {
    rubro: 'plomería',
    familia: FAMILIAS.OFICIOS,
    keywords: ['plomero', 'plomería', 'fontanero', 'plumber'],
  },
  {
    rubro: 'carpintería',
    familia: FAMILIAS.OFICIOS,
    keywords: ['carpintero', 'carpintería', 'ebanistería', 'carpenter'],
  },
  {
    rubro: 'herrería y soldadura',
    familia: FAMILIAS.OFICIOS,
    keywords: ['herrería', 'herrero', 'soldadura', 'welding'],
  },
  {
    rubro: 'pintura y acabados',
    familia: FAMILIAS.OFICIOS,
    keywords: ['pintor', 'pintura', 'painter'],
  },
  {
    rubro: 'cerrajería',
    familia: FAMILIAS.OFICIOS,
    keywords: ['cerrajería', 'cerrajero', 'locksmith'],
  },
  {
    rubro: 'refrigeración y aire acondicionado',
    familia: FAMILIAS.OFICIOS,
    keywords: ['refrigeración', 'aire acondicionado', 'hvac'],
  },
  {
    rubro: 'empresa de limpieza',
    familia: FAMILIAS.OFICIOS,
    keywords: ['limpieza', 'limpiar', 'cleaning', 'cleaner'],
  },
  {
    rubro: 'fumigación',
    familia: FAMILIAS.OFICIOS,
    keywords: ['fumigación', 'fumigadora', 'pest control'],
  },
  {
    rubro: 'jardinería y piscinas',
    familia: FAMILIAS.OFICIOS,
    keywords: ['jardinería', 'jardinero', 'piscina', 'landscaping', 'gardening', 'gardener', 'pool'],
  },
  {
    rubro: 'lavandería',
    familia: FAMILIAS.OFICIOS,
    keywords: ['lavandería', 'laundry'],
  },
  {
    rubro: 'imprenta',
    familia: FAMILIAS.OFICIOS,
    keywords: ['imprenta', 'serigrafía', 'rotulación', 'printing'],
  },
  {
    rubro: 'transporte y mudanzas',
    familia: FAMILIAS.OFICIOS,
    keywords: [
      'transporte',
      'transportista',
      'mudanza',
      'mudanzas',
      'flete',
      'moving',
      'transport',
      'transportation',
      'shipping',
    ],
  },
  {
    rubro: 'mensajería y paquetería',
    familia: FAMILIAS.OFICIOS,
    keywords: ['mensajería', 'paquetería', 'delivery', 'courier', 'logística', 'logistics'],
  },
  {
    rubro: 'taxi y traslados',
    familia: FAMILIAS.OFICIOS,
    keywords: ['taxi', 'uber', 'traslados'],
  },
  {
    rubro: 'ferretería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['ferretería', 'ferreteria', 'hardware store'],
  },
  {
    rubro: 'zapatería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['zapatería', 'calzado', 'zapatos', 'shoes', 'shoe store'],
  },
  {
    rubro: 'joyería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['joyería', 'jewelry'],
  },
  {
    rubro: 'perfumería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['perfumería', 'perfumes', 'perfumery'],
  },
  {
    rubro: 'librería y papelería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['librería', 'papelería', 'bookstore', 'stationery'],
  },
  {
    rubro: 'floristería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['floristería', 'florería', 'flower shop'],
  },
  {
    rubro: 'juguetería',
    familia: FAMILIAS.COMERCIO,
    keywords: ['juguetería', 'toy store'],
  },
  {
    rubro: 'mueblería y decoración',
    familia: FAMILIAS.COMERCIO,
    keywords: ['mueblería', 'muebles', 'decoración', 'hogar', 'furniture', 'home decor'],
  },
  {
    rubro: 'artesanía y regalos',
    familia: FAMILIAS.COMERCIO,
    keywords: ['artesanía', 'regalos', 'gifts', 'bazar', 'souvenirs'],
  },
  {
    rubro: 'pulpería y abarrotes',
    familia: FAMILIAS.COMERCIO,
    keywords: ['pulpería', 'abarrotes', 'supermercado', 'minisúper'],
  },
  {
    rubro: 'agroservicio',
    familia: FAMILIAS.COMERCIO,
    keywords: ['agroservicio', 'agropecuaria', 'veterinaria agrícola'],
  },
  {
    rubro: 'distribuidora mayorista',
    familia: FAMILIAS.COMERCIO,
    keywords: ['distribuidora', 'mayorista', 'wholesale'],
  },
  {
    rubro: 'tienda de ropa',
    familia: FAMILIAS.COMERCIO,
    keywords: ['ropa', 'boutique', 'moda', 'fashion', 'clothing'],
  },
  {
    rubro: 'tienda en línea',
    familia: FAMILIAS.COMERCIO,
    keywords: [
      'tienda',
      'comercio',
      'retail',
      'e-commerce',
      'ecommerce',
      'shop',
      'store',
      'catálogo',
      'catalogo',
      'producto',
      'productos',
      'venta',
      'vender',
      'comprar',
      'online',
      'accesorios',
      'accessories',
      'catalog',
      'products',
    ],
  },
];

/**
 * Los rubros agrupados por familia, en el orden en que los ofrece el formulario asistido.
 *
 * Se deriva de las reglas en vez de escribirse de nuevo: el formulario, el detector y el design
 * kit tienen que coincidir en las cadenas exactas, y una segunda lista escrita a mano es una
 * segunda cosa que alguien se va a olvidar de actualizar.
 */
export const RUBROS_POR_FAMILIA: Array<{ familia: Familia; rubros: string[] }> = Object.values(FAMILIAS).map(
  (familia) => ({
    familia,
    rubros: [...new Set(RUBRO_RULES.filter((rule) => rule.familia === familia).map((rule) => rule.rubro))],
  }),
);

/** Todos los rubros, sin agrupar. */
export const RUBROS: string[] = RUBROS_POR_FAMILIA.flatMap((grupo) => grupo.rubros);

/** Las familias visuales, para quien necesita la fila y no el rubro. */
export const SECTOR_NAMES: string[] = Object.values(FAMILIAS);

export interface SectorMatch {
  /**
   * El rubro específico, o cadena vacía cuando no lo reconocimos.
   *
   * Vacío no es lo mismo que desconocido por descuido: es la señal de que el modelo tiene que
   * leerlo de la descripción del cliente en vez de recibir uno inventado por nosotros.
   */
  rubro: string;

  /** La fila de la tabla sectorial, o el default cuando no hubo coincidencia. */
  sector: Familia | string;

  /**
   * Falso cuando ninguna palabra clave coincidió y `sector` es solo el default.
   *
   * Esta distinción es la pieza que faltaba, y su ausencia costaba caro. Medido contra 54 rubros
   * reales de negocio pequeño hondureño, más de la mitad caían en «comercio, tienda, retail» sin
   * ser comercio: farmacias, ópticas, talleres, imprentas, colegios, funerarias, aseguradoras.
   * Como el default era indistinguible de un acierto, el sitio salía con la tipografía, la paleta
   * y el ejemplo de un rubro que no era el del cliente, y nadie tenía forma de saberlo.
   *
   * La lista de rubros que una agencia atiende no se termina nunca, así que el arreglo de fondo no
   * es una lista más larga: es que cuando no sabemos, se diga. Quien recibe ese «no sé» —el
   * modelo, que tiene la tabla completa enfrente y la descripción del negocio— elige mejor que un
   * default.
   */
  matched: boolean;
}

/**
 * El default cuando nada coincide.
 *
 * Sigue siendo comercio porque es el tratamiento más neutro de la tabla, pero ahora viaja
 * acompañado de `matched: false`, que es lo que permite tratarlo como lo que es.
 */
const FALLBACK_SECTOR: Familia = FAMILIAS.COMERCIO;

function sinTildes(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectSectorMatch(message: string): SectorMatch {
  if (!message) {
    return { rubro: '', sector: FALLBACK_SECTOR, matched: false };
  }

  const normalized = sinTildes(message).toLowerCase();

  /*
   * Palabras enteras, no subcadenas. «barbería» contiene «bar» a nivel de caracteres, y «bar» es
   * palabra clave de gastronomía: sin esto, toda barbería salía siendo una cantina.
   */
  const words = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));

  for (const rule of RUBRO_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = sinTildes(keyword);
      const hit = normalizedKeyword.includes(' ')
        ? normalized.includes(normalizedKeyword)
        : words.has(normalizedKeyword);

      if (hit) {
        return { rubro: rule.rubro, sector: rule.familia, matched: true };
      }
    }
  }

  return { rubro: '', sector: FALLBACK_SECTOR, matched: false };
}

/**
 * La familia como string, para quien no necesita saber si fue un acierto o el default.
 *
 * Lo usa el catálogo de fotos: una paleta neutra es una respuesta razonable para un rubro
 * desconocido, y ahí el default no hace daño.
 */
export function detectSector(message: string): string {
  return detectSectorMatch(message).sector;
}

/** El rubro específico detectado, o cadena vacía. */
export function detectRubro(message: string): string {
  return detectSectorMatch(message).rubro;
}
