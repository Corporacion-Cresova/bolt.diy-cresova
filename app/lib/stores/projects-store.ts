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

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  prompt: string;
  createdAt: string;
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
    description: 'Hospedaje, tours, buceo, aventura. Trato editorial con la foto como protagonista.',
    category: 'turismo',
    prompt: `Crea el sitio de un hotel/operador turístico. Sector del design kit: turismo, aventura, hotelería.

DATOS DEL CLIENTE (completá esto antes de enviar):
- Nombre del negocio:
- Qué ofrece exactamente (habitaciones, tours, paquetes):
- Ubicación y zona:
- WhatsApp:
- Precios o rangos que sí podemos publicar:
- Lo que lo hace distinto de la competencia:

Concepto: el lugar se vende solo, así que la foto manda y el texto se aparta — hero asimétrico con la
imagen sangrando al borde y la tipografía apoyada sobre el aire, no encima de la foto.
Apuesta: una sección de experiencias en lista editorial con reglas finas y precio a la derecha, en
vez de tres tarjetas iguales.

Secciones, en este orden: hero 60/40, franja de confianza con datos concretos (años, idiomas,
capacidad, tiempo de respuesta), experiencias en lista editorial, galería asimétrica, un testimonio
grande, contacto en dos columnas con WhatsApp, footer.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-gastronomia',
    name: 'Restaurante o café',
    description: 'Restaurantes, cafeterías, catering, repostería. Menú y antojo por delante.',
    category: 'gastronomía',
    prompt: `Crea el sitio de un restaurante/café. Sector del design kit: gastronomía, café, catering.

DATOS DEL CLIENTE (completá esto antes de enviar):
- Nombre del negocio:
- Tipo de cocina y platos insignia:
- Dirección y horarios reales:
- WhatsApp y si toma reservas o pedidos:
- Rango de precios:
- Lo que lo hace distinto:

Concepto: la carta es el contenido, no un PDF escondido — el menú vive en la página, compuesto como
una carta impresa, con los platos insignia arriba.
Apuesta: el plato de la casa ocupa una banda completa de ancho total con fondo invertido, una sola
vez en toda la página.

Secciones, en este orden: hero 60/40, menú editorial por categorías con precios, la banda del plato
insignia, galería asimétrica del local, testimonio, contacto con horarios y mapa, footer.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-oficios',
    name: 'Taller, constructora o servicios',
    description: 'Talleres, construcción, limpieza, transporte, mantenimiento. Confianza y respuesta rápida.',
    category: 'oficios',
    prompt: `Crea el sitio de un negocio de oficio/servicios. Sector del design kit: oficios, construcción,
limpieza, transporte.

DATOS DEL CLIENTE (completá esto antes de enviar):
- Nombre del negocio:
- Servicios exactos que presta:
- Años de experiencia y zona de cobertura:
- WhatsApp y horario de atención:
- Certificaciones, garantías o seguros:
- Lo que lo hace distinto:

Concepto: el cliente llega con una urgencia, así que todo el sitio empuja a un solo gesto —
escribir por WhatsApp — y cada sección responde una objeción antes de pedirlo.
Apuesta: un número grande, uno solo en toda la página (años de experiencia o trabajos entregados),
tratado como pieza tipográfica.

Secciones, en este orden: hero 60/40 con acción de WhatsApp, franja de confianza con datos
concretos, servicios en lista editorial con qué incluye cada uno, proceso en 3-4 pasos numerados,
galería de trabajos, testimonio, contacto con zona de cobertura, footer.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-profesional',
    name: 'Clínica, bufete o consultora',
    description: 'Salud, legal, financiero, consultoría. Composición impecable, cero riesgos.',
    category: 'profesional',
    prompt: `Crea el sitio de un despacho/clínica profesional. Sector del design kit: salud, legal,
financiero, profesional.

DATOS DEL CLIENTE (completá esto antes de enviar):
- Nombre del despacho o clínica:
- Especialidades y a quién atiende:
- Credenciales del equipo (títulos, colegiatura, años):
- Dirección, horarios y WhatsApp:
- Cómo se agenda una cita:
- Lo que lo hace distinto:

Concepto: aquí se compra confianza, no estética — jerarquía clarísima, aire generoso y credenciales
visibles desde el primer scroll, sin un solo adorno que compita.
Apuesta: el equipo con nombre, título y foto real es la sección principal, no un pie de página.

Secciones, en este orden: hero 60/40 con acción de agendar, franja de credenciales, especialidades
en lista editorial, equipo con credenciales, proceso de la primera cita en 3 pasos, testimonio,
contacto en dos columnas con horarios, footer.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-comercio',
    name: 'Tienda o catálogo',
    description: 'Comercio, retail, distribuidores, catálogo de productos con pedido por WhatsApp.',
    category: 'comercio',
    prompt: `Crea el sitio de una tienda/catálogo. Sector del design kit: comercio, tienda, retail.

DATOS DEL CLIENTE (completá esto antes de enviar):
- Nombre de la tienda:
- Qué vende y categorías principales:
- 6-8 productos reales con nombre y precio:
- Cómo se compra (WhatsApp, tienda física, envío):
- Zona de entrega y costos:
- Lo que lo hace distinto:

Concepto: catálogo que se puede recorrer sin carrito — cada producto lleva a un pedido por WhatsApp
con el nombre ya escrito en el mensaje.
Apuesta: la grilla de productos rompe el ritmo con un producto destacado a doble ancho, no una
cuadrícula uniforme.

Secciones, en este orden: hero 60/40 con el producto insignia, franja de garantías reales (envío,
cambios, formas de pago), grilla de productos con precio y acción de pedido, una sección de la
tienda con foto, testimonio, contacto con zona de entrega, footer.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-bienestar',
    name: 'Spa, salón o bienestar',
    description: 'Belleza, spa, bienestar, suplementos. Calma, aire y trato suave.',
    category: 'bienestar',
    prompt: `Crea el sitio de un negocio de belleza/bienestar. Sector del design kit: belleza, bienestar,
suplementos.

DATOS DEL CLIENTE (completá esto antes de enviar):
- Nombre del negocio:
- Servicios o productos con duración y precio:
- Dirección, horarios y WhatsApp:
- Cómo se reserva:
- Marcas o técnicas que usa:
- Lo que lo hace distinto:

Concepto: el sitio tiene que sentirse como el lugar — mucho aire entre secciones, ritmo lento, la
tipografía suave haciendo el trabajo pesado y una sola foto grande por sección.
Apuesta: la lista de servicios con duración y precio compuesta como una carta, alineada a la
derecha contra una columna de foto fija.

Secciones, en este orden: hero 60/40, servicios en lista editorial con duración y precio, el
espacio con galería asimétrica, testimonio grande, reserva con horarios y WhatsApp, footer.`,
    createdAt: '2026-09-01',
  },
];

/*
 * Bump this whenever BUILTIN_TEMPLATES changes. Without it the seed below only ever runs on an
 * empty store, so anyone who already opened the app keeps the old templates in localStorage
 * forever and never sees an improved one.
 */
const BUILTIN_TEMPLATES_VERSION = '2';
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
