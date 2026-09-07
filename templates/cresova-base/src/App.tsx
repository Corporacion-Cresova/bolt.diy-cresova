import { StickyHeader } from './components/StickyHeader';
import { Hero } from './components/Hero';
import { CategoryTriptych } from './components/CategoryTriptych';
import { Catalogue } from './components/Catalogue';
import { MarqueeBand } from './components/MarqueeBand';
import { EditorialBand } from './components/EditorialBand';
import { ProcessSteps } from './components/ProcessSteps';
import { ClosingCTA } from './components/ClosingCTA';
import { TrustStrip } from './components/TrustStrip';
import { ServiceList } from './components/ServiceList';
import { Gallery } from './components/Gallery';
import { Testimonial } from './components/Testimonial';
import { Contact } from './components/Contact';
import { SiteFooter } from './components/SiteFooter';
import { WhatsAppFloat } from './components/WhatsAppFloat';
import { catalogue, site } from './lib/site';

/*
 * The page is composed here, and this is the file to rewrite for a new client.
 *
 * Pick four to six sections and use each one once, in this order. Watch the `ground` values as you
 * go: they alternate on purpose, and four sections sharing one ground is what makes a page read as
 * flat no matter how good the type is.
 *
 * The photo URLs come from <cresova_images>. Only put a photo where it honestly depicts what it
 * sits next to — a section with no suitable photo is better solid than filled with an unrelated one.
 *
 * ONE THING NOT TO COPY FROM THIS EXAMPLE: it ships with three photographs and reuses them across
 * four sections, because three is all it has. Do not do that in a real build. Your catalogue has a
 * dozen images to choose from, and the same picture appearing in the hero, the triptych and a
 * product card is the fastest way to make a finished page look like a placeholder.
 */
export default function App() {
  return (
    <>
      <StickyHeader
        links={[
          { label: 'Cabañas', href: '#catalogo' },
          { label: 'Experiencias', href: '#servicios' },
          { label: 'El lugar', href: '#galeria' },
          { label: 'Contacto', href: '#contacto' },
        ]}
      />

      <Hero
        eyebrow="Copán Ruinas"
        title="Dormir donde termina el camino"
        subtitle="Seis cabañas de madera y piedra sobre la montaña, a veinte minutos de las ruinas. Desayuno de finca incluido y senderos que salen de la puerta."
        imageUrl="https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg?auto=compress&cs=tinysrgb&w=940"
        imageAlt="Cabaña de madera al anochecer, entre el bosque"
        primaryAction={{ label: 'Reservar por WhatsApp', message: `Hola ${site.name}, quiero reservar una cabaña.` }}
        secondaryAction={{ label: 'Ver las cabañas', href: '#servicios' }}
        facts={[
          { value: '6', label: 'Cabañas' },
          { value: '2014', label: 'Desde' },
          { value: '20 min', label: 'De las ruinas' },
        ]}
      />

      <TrustStrip
        items={[
          { value: 'Español e inglés', label: 'Atención' },
          { value: 'Hasta 4 personas', label: 'Por cabaña' },
          { value: 'Menos de 2 horas', label: 'Respuesta' },
          { value: 'Incluido', label: 'Desayuno de finca' },
        ]}
      />

      <MarqueeBand words={['Desayuno de finca', 'Senderos propios', 'Agua caliente', 'Wifi en la terraza']} />

      <CategoryTriptych
        eyebrow="Tres formas de estar acá"
        title="Dormir, caminar y quedarse quieto."
        ground="bg"
        categories={[
          {
            name: 'Las cabañas',
            line: 'Seis, de madera y piedra, cada una con su terraza.',
            imageUrl: 'https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg?auto=compress&cs=tinysrgb&w=940',
            imageAlt: 'Cabaña de madera al anochecer, entre el bosque',
          },
          {
            name: 'Los senderos',
            line: 'Salen de la puerta y llegan al café y al mirador.',
            imageUrl: 'https://images.pexels.com/photos/1183099/pexels-photo-1183099.jpeg?auto=compress&cs=tinysrgb&w=940',
            imageAlt: 'La montaña al amanecer, vista desde el sendero',
          },
          {
            name: 'La laguna',
            line: 'Veinte minutos caminando, y nadie más alrededor.',
            imageUrl: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=940',
            imageAlt: 'Laguna y bosque de pinos en la ruta de senderismo',
          },
        ]}
      />

      <Catalogue
        eyebrow="Tarifas"
        title="Lo que cuesta quedarse."
        products={catalogue}
        ground="surface"
      />

      <EditorialBand
        imageUrl="https://images.pexels.com/photos/1183099/pexels-photo-1183099.jpeg?auto=compress&cs=tinysrgb&w=940"
        imageAlt="La montaña al amanecer, vista desde el sendero"
        quote="A las seis de la mañana no se oye un solo motor."
        attribution="Piedra Viva, a 1.400 metros"
      />

      <ProcessSteps
        eyebrow="Cómo se reserva"
        title="Tres mensajes y está hecho."
        ground="bg"
        steps={[
          { title: 'Escribinos', description: 'Decinos fechas y cuántas personas. Contestamos el mismo día.' },
          { title: 'Te confirmamos', description: 'Disponibilidad y precio cerrado, sin sorpresas al llegar.' },
          { title: 'Llegás', description: 'Te esperamos con el café hecho. El check-in es a las 14:00.' },
        ]}
      />

      <ServiceList
        eyebrow="Experiencias"
        title="Lo que se puede hacer sin bajar de la montaña"
        ground="tint"
        services={[
          {
            name: 'Sendero de café',
            description: 'Cuatro horas por la finca vecina, con corte, tueste y taza al final. Sale a las 6:00.',
            price: 'L 650',
          },
          {
            name: 'Aguas termales al atardecer',
            description: 'Transporte y entrada a Luna Jaguar, con regreso después de la cena.',
            price: 'L 900',
          },
          {
            name: 'Ruinas con guía propio',
            description: 'Entrada, guía en español o inglés y traslado desde la cabaña. Grupos de hasta seis.',
            price: 'L 1,400',
          },
        ]}
      />

      <Gallery
        eyebrow="El lugar"
        title="Madera, piedra y niebla a las seis de la mañana"
        ground="bg"
        /*
         * Two photos, not three, and each alt says what its photo actually shows.
         *
         * There was a third here labelled "desayuno servido en la terraza" that was a picture of a
         * mountain, and one labelled "interior de una cabaña" that was an apartment block. Writing
         * this example is exactly where that happens: you reach for a URL to fill the slot. Do not.
         * Two honest photos beat five that have to be explained away.
         */
        photos={[
          {
            url: 'https://images.pexels.com/photos/1183099/pexels-photo-1183099.jpeg?auto=compress&cs=tinysrgb&w=940',
            alt: 'La montaña al amanecer, vista desde el sendero',
          },
          {
            url: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=940',
            alt: 'Laguna y bosque de pinos en la ruta de senderismo',
          },
        ]}
      />

      <Testimonial
        quote="Llegamos por las ruinas y nos quedamos tres noches más por el lugar. El sendero de café con don Marco vale el viaje solo."
        author="Ana Cristina Pineda"
        role="Tegucigalpa, marzo 2026"
        ground="tint"
      />

      <Contact
        eyebrow="Reservas"
        title="Escribinos y te apartamos la cabaña"
        description="Contestamos el mismo día. Decinos las fechas y cuántas personas son, y te mandamos disponibilidad y precio cerrado."
        whatsappMessage={`Hola ${site.name}, quiero consultar disponibilidad.`}
        serviceArea={['Copán Ruinas', 'Santa Rita', 'La Entrada']}
        ground="surface"
      />

      <ClosingCTA
        title="La montaña no se llena. Se reserva."
        message={`Hola ${site.name}, quiero reservar.`}
        label="Reservar por WhatsApp"
      />

      <SiteFooter />
      <WhatsAppFloat message={`Hola ${site.name}, quiero información.`} />
    </>
  );
}
