import { Section, Eyebrow, SectionTitle } from './Section';

/**
 * A masonry of real photos — never four equal squares.
 *
 * CSS columns rather than a grid on purpose: a grid where the first photo spans two by two leaves
 * a hole whenever the photo count does not happen to fill the remaining cells, and the count is
 * never known in advance. Columns flow, so three photos and seven both look deliberate, and each
 * photo keeps its own proportions instead of being cropped to a common square.
 *
 * Everything here loads lazily: only the hero image is worth blocking the page on.
 */
interface GalleryProps {
  eyebrow: string;
  title: string;
  ground?: 'bg' | 'surface' | 'tint';
  photos: { url: string; alt: string }[];
}

export function Gallery({ eyebrow, title, photos, ground = 'surface' }: GalleryProps) {
  return (
    <Section ground={ground} id="galeria">
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>

      <div className="mt-12 gap-4 [column-count:1] sm:[column-count:2] lg:[column-count:3]">
        {photos.map((photo) => (
          <img
            key={photo.url}
            src={photo.url}
            alt={photo.alt}
            loading="lazy"
            width={940}
            height={650}
            className="mb-4 w-full break-inside-avoid rounded-control object-cover"
          />
        ))}
      </div>
    </Section>
  );
}
