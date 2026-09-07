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
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cresova_projects', JSON.stringify($projects.get()));
  } catch (e) {
    console.warn('[Projects] Failed to persist projects:', e);
  }
}

export function loadProjects() {
  if (typeof window === 'undefined') return;
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
  if (typeof window === 'undefined') return;
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
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cresova_templates', JSON.stringify($templates.get()));
  } catch (e) {
    console.warn('[Templates] Failed to persist templates:', e);
  }
}

/*
 * Built-in starter templates — these ship with the app so users can select
 * a starting point without writing a prompt from scratch.
 */
export const BUILTIN_TEMPLATES: TemplateInfo[] = [
  {
    id: 'template-landing-generic',
    name: 'Landing Page',
    description: 'Página de aterrizaje profesional con hero, servicios, testimonios y contacto',
    category: 'landing',
    prompt: `Crea una landing page profesional para el negocio que te voy a describir. La página debe tener:
- Hero a pantalla completa con foto de fondo, título grande, subtítulo y CTA
- Sección de servicios/beneficios (3-4 items) con iconos de Lucide
- Sección "Sobre nosotros" con foto y texto
- Testimonios de clientes
- Sección de contacto con formulario
- Footer completo con datos de contacto y redes sociales
- WhatsApp flotante

Diseño moderno y profesional. Tailwind CSS + Lucide React.
Transiciones suaves, responsive mobile-first, prefers-reduced-motion.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-negocio-local',
    name: 'Negocio Local',
    description: 'Para talleres, clínicas, consultorios, despachos profesionales',
    category: 'landing',
    prompt: `Crea una página web profesional para un negocio de servicios local. Debe transmitir confianza y experiencia.

Secciones:
- Hero con foto del local o equipo, título, subtítulo y CTA (WhatsApp o llamada)
- Sobre nosotros: historia, años de experiencia, valores
- Servicios: 3-4 tarjetas con iconos de Lucide, descripción breve
- Galería de trabajos realizados (usar picsum.photos con seeds descriptivos)
- Testimonios de clientes reales con nombre y foto
- Contacto: mapa embebido, formulario, WhatsApp flotante
- Footer: horarios, dirección, teléfono, redes sociales

Tailwind CSS + Lucide React. Tono sobrio y profesional.
Sector: oficios/construcción. Tipografía: Archivo + Source Sans 3.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-hoteles',
    name: 'Hotel / Resort',
    description: 'Para hoteles, eco-resorts, cabañas, restaurantes, turismo',
    category: 'landing',
    prompt: `Crea una landing page para un hotel boutique o resort. Debe transmitir calidez y naturaleza.

Secciones:
- Hero con foto panorámica, nombre del hotel y CTA a reservas
- Habitaciones/cabañas: galería con fotos y descripción de cada una
- Servicios: restaurante, tours, spa, etc. con iconos de Lucide
- Galería de fotos del lugar
- Testimonios de huéspedes
- Contacto + WhatsApp flotante
- Footer con dirección, redes sociales

Sector: turismo/aventura. Paleta cálida natural.
Tipografía: Bricolage Grotesque + Karla. Tratamiento: editorial.`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-empresa-tech',
    name: 'Empresa Tecnológica',
    description: 'Para startups, agencias digitales, empresas de software, IA',
    category: 'landing',
    prompt: `Crea una landing page moderna para una empresa de tecnología. Debe transmitir innovación y profesionalismo.

Secciones:
- Hero oscuro con animaciones sutiles, título impactante y CTA
- Servicios/productos con iconos de Lucide
- Casos de éxito o proyectos destacados
- Equipo (fotos + nombres + roles)
- Blog o recursos (3 cards con previews)
- Contacto + demo request form
- Footer con links a redes, blog, política de privacidad

Dark mode nativo. Animaciones suaves. Tailwind CSS + Lucide React.
Sector: salud/legal/financiero (paleta oscura profesional).`,
    createdAt: '2026-09-01',
  },
  {
    id: 'template-ecommerce',
    name: 'E-commerce Visual',
    description: 'Tienda online, catálogo de productos, comercio retail',
    category: 'landing',
    prompt: `Crea una landing page comercial para una tienda o catálogo de productos.

Secciones:
- Hero con producto destacado, título y CTA a tienda
- Categorías de productos con iconos de Lucide
- Productos destacados con foto, nombre y precio
- Beneficios: envío, garantía, soporte, etc.
- Testimonios de clientes
- Newsletter + CTA final
- Footer completo

Sector: comercio/tienda/retail. Paleta: #FAF8F4.
Tipografía: Fraunces + Work Sans. Tratamiento: editorial.`,
    createdAt: '2026-09-01',
  },
];

/* Seed built-in templates on first load */
export function seedTemplates() {
  const current = $templates.get();
  if (current.length > 0) return;
  $templates.set(BUILTIN_TEMPLATES);
  persistTemplates();
}