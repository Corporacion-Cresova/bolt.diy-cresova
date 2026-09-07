import { atom } from 'nanostores';
import type { Message } from 'ai';

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  previewUrl?: string;
  messages?: Message[];
  thumbnailUrl?: string;
  files?: Record<string, string>;
}

/**
 * A template is a REFERENCE, not a prompt.
 *
 * It used to carry one blob of prose that got dumped into the prompt box, which left the user
 * editing someone else's text instead of describing their client. These four fields are what the
 * design kit asks the model to decide and cannot infer on its own; the user still writes the brief
 * in their own words, and the reference rides along with it.
 */
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnailUrl?: string;

  /** matches a sector row of <cresova_design_kit>, which carries palette, type pairing and treatment */
  sector: string;
  concepto: string;
  apuesta: string;
  secciones: string;
  createdAt: string;
}

/**
 * The reference block that travels with the user's brief. Compact on purpose: the design kit
 * already carries the palette, the type and the motion — this only adds what it cannot know.
 */
export function renderTemplateReference(template: TemplateInfo): string {
  return [
    '<referencia_de_plantilla>',
    `Sector del design kit: ${template.sector}`,
    `Concepto: ${template.concepto}`,
    `Apuesta: ${template.apuesta}`,
    `Secciones, en este orden: ${template.secciones}`,
    '</referencia_de_plantilla>',
  ].join('\n');
}

export const $projects = atom<ProjectInfo[]>([]);
export const $templates = atom<TemplateInfo[]>([]);
export const $selectedProjectId = atom<string | null>(null);
export const $projectsPanelOpen = atom(false);

export function addProject(project: ProjectInfo) {
  $projects.set([project, ...$projects.get()]);
  persistProjects();
}

export function removeProject(id: string) {
  $projects.set($projects.get().filter((p) => p.id !== id));
  persistProjects();
}

export function getProject(id: string): ProjectInfo | undefined {
  return $projects.get().find((p) => p.id === id);
}

export function persistProjects() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('cresova_projects', JSON.stringify($projects.get()));
  } catch (e) {
    console.warn('[Projects] Failed to persist projects:', e);
  }
}

export function loadProjects() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem('cresova_projects');

    if (raw) {
      $projects.set(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('[Projects] Failed to load projects:', e);
  }
}

export function addTemplate(template: TemplateInfo) {
  $templates.set([...$templates.get(), template]);
  persistTemplates();
}

export function loadTemplates() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem('cresova_templates');

    if (raw) {
      $templates.set(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('[Templates] Failed to load templates:', e);
  }
}

export function persistTemplates() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('cresova_templates', JSON.stringify($templates.get()));
  } catch (e) {
    console.warn('[Templates] Failed to persist templates:', e);
  }
}

/*
 * Built-in starter templates — these ship with the app so users can select
 * a starting point without writing a prompt from scratch.
 *
 * Each one names a sector row from <cresova_design_kit> so the model inherits that row's palette,
 * type pairing and treatment, and then adds only what the kit cannot know: the concept, the one
 * risk worth taking, and which section shapes to use in what order. Anything the kit already
 * specifies (fonts, colours, motion, image source) is deliberately NOT repeated here — the
 * previous templates did, in weaker form, and the contradictions were making the pages worse:
 * one asked for a dark hero while pointing at a light-palette sector, several sent the model to
 * picsum.photos instead of the real photo catalog.
 *
 * The DATOS DEL CLIENTE block stays at the top on purpose: selecting a template fills the prompt
 * box instead of sending it, so this is the checklist the user completes before building. Without
 * real data the model writes "Servicio 1", which the kit correctly calls a tell.
 */
export const BUILTIN_TEMPLATES: TemplateInfo[] = [
  {
    id: 'template-turismo',
    name: 'Hotel, tour o eco-resort',
    description: 'Hospedaje, tours, buceo, aventura. La foto manda y el texto se aparta.',
    category: 'turismo',
    sector: 'turismo, aventura, hotelería',
    concepto:
      'el lugar se vende solo, así que la foto manda y el texto se aparta — hero asimétrico con la imagen sangrando al borde y la tipografía apoyada sobre el aire, no encima de la foto',
    apuesta: 'las experiencias en lista editorial con reglas finas y precio a la derecha, no tres tarjetas iguales',
    secciones:
      'hero 60/40, franja de confianza con datos concretos, experiencias en lista editorial, galería asimétrica, un testimonio grande, contacto en dos columnas con WhatsApp, footer',
    createdAt: '2026-09-01',
  },
  {
    id: 'template-gastronomia',
    name: 'Restaurante o café',
    description: 'Restaurantes, cafeterías, catering, repostería. La carta es el contenido.',
    category: 'gastronomía',
    sector: 'gastronomía, café, catering',
    concepto:
      'la carta es el contenido, no un PDF escondido — el menú vive en la página, compuesto como una carta impresa, con los platos insignia arriba',
    apuesta: 'el plato de la casa ocupa una banda de ancho completo con fondo invertido, una sola vez en la página',
    secciones:
      'hero 60/40, menú editorial por categorías con precios, la banda del plato insignia, galería asimétrica del local, testimonio, contacto con horarios y mapa, footer',
    createdAt: '2026-09-01',
  },
  {
    id: 'template-oficios',
    name: 'Taller, constructora o servicios',
    description: 'Talleres, construcción, limpieza, transporte. Confianza y respuesta rápida.',
    category: 'oficios',
    sector: 'oficios, construcción, limpieza, transporte',
    concepto:
      'el cliente llega con una urgencia, así que todo el sitio empuja a un solo gesto —escribir por WhatsApp— y cada sección responde una objeción antes de pedirlo',
    apuesta:
      'un número grande, uno solo en toda la página (años de experiencia o trabajos entregados), tratado como pieza tipográfica',
    secciones:
      'hero 60/40 con acción de WhatsApp, franja de confianza, servicios en lista editorial con qué incluye cada uno, proceso en 3-4 pasos numerados, galería de trabajos, testimonio, contacto con zona de cobertura, footer',
    createdAt: '2026-09-01',
  },
  {
    id: 'template-profesional',
    name: 'Clínica, bufete o consultora',
    description: 'Salud, legal, financiero. Composición impecable, cero riesgos.',
    category: 'profesional',
    sector: 'salud, legal, financiero, profesional',
    concepto:
      'aquí se compra confianza, no estética — jerarquía clarísima, aire generoso y credenciales visibles desde el primer scroll, sin un solo adorno que compita',
    apuesta: 'el equipo con nombre, título y foto real es la sección principal, no un pie de página',
    secciones:
      'hero 60/40 con acción de agendar, franja de credenciales, especialidades en lista editorial, equipo con credenciales, proceso de la primera cita en 3 pasos, testimonio, contacto en dos columnas con horarios, footer',
    createdAt: '2026-09-01',
  },
  {
    id: 'template-comercio',
    name: 'Tienda o catálogo',
    description: 'Comercio, retail, distribuidores. Catálogo con pedido por WhatsApp.',
    category: 'comercio',
    sector: 'comercio, tienda, retail',
    concepto:
      'catálogo que se puede recorrer sin carrito — cada producto lleva a un pedido por WhatsApp con el nombre ya escrito en el mensaje',
    apuesta: 'la grilla rompe el ritmo con un producto destacado a doble ancho, no una cuadrícula uniforme',
    secciones:
      'hero 60/40 con el producto insignia, franja de garantías reales (envío, cambios, pago), grilla de productos con precio y acción de pedido, una sección de la tienda con foto, testimonio, contacto con zona de entrega, footer',
    createdAt: '2026-09-01',
  },
  {
    id: 'template-bienestar',
    name: 'Spa, salón o bienestar',
    description: 'Belleza, spa, bienestar, suplementos. Calma, aire y trato suave.',
    category: 'bienestar',
    sector: 'belleza, bienestar, suplementos',
    concepto:
      'el sitio tiene que sentirse como el lugar — mucho aire entre secciones, ritmo lento, la tipografía suave haciendo el trabajo pesado y una sola foto grande por sección',
    apuesta:
      'la lista de servicios con duración y precio compuesta como una carta, alineada a la derecha contra una columna de foto fija',
    secciones:
      'hero 60/40, servicios en lista editorial con duración y precio, el espacio con galería asimétrica, testimonio grande, reserva con horarios y WhatsApp, footer',
    createdAt: '2026-09-01',
  },
];

/*
 * Bump this whenever BUILTIN_TEMPLATES changes. Without it the seed below only ever runs on an
 * empty store, so anyone who already opened the app keeps the old templates in localStorage
 * forever and never sees an improved one.
 */
const BUILTIN_TEMPLATES_VERSION = '3';
const TEMPLATES_VERSION_KEY = 'cresova_templates_version';

/* Seed built-in templates on first load, and re-seed them when they change */
export function seedTemplates() {
  if (typeof window === 'undefined') {
    return;
  }

  const seededVersion = localStorage.getItem(TEMPLATES_VERSION_KEY);

  if ($templates.get().length > 0 && seededVersion === BUILTIN_TEMPLATES_VERSION) {
    return;
  }

  /* ids shipped by earlier versions, so re-seeding replaces them instead of stacking on top */
  const legacyIds = [
    'template-landing-generic',
    'template-negocio-local',
    'template-hoteles',
    'template-empresa-tech',
    'template-ecommerce',
  ];
  const shippedIds = new Set([...BUILTIN_TEMPLATES.map((template) => template.id), ...legacyIds]);
  const userTemplates = $templates.get().filter((template) => !shippedIds.has(template.id));

  $templates.set([...BUILTIN_TEMPLATES, ...userTemplates]);
  persistTemplates();

  try {
    localStorage.setItem(TEMPLATES_VERSION_KEY, BUILTIN_TEMPLATES_VERSION);
  } catch (e) {
    console.warn('[Templates] Failed to persist templates version:', e);
  }
}
