import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/*
 * Synthetic "social link preview" card used until we can capture a real
 * screenshot of the generated site (there is no capture pipeline yet — the
 * `thumbnailUrl` field on projects/templates stays free for that).
 * The gradient is derived from the seed so a given project always looks the same.
 */
const GRADIENTS: [string, string][] = [
  ['#8A5FFF', '#2D1959'],
  ['#6366F1', '#1E1B4B'],
  ['#B69EFF', '#4C1D95'],
  ['#38BDF8', '#172554'],
  ['#14B8A6', '#134E4A'],
  ['#F59E0B', '#78350F'],
];

function hashSeed(seed: string) {
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

export function gradientForSeed(seed: string) {
  const [from, to] = GRADIENTS[hashSeed(seed) % GRADIENTS.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

interface PreviewThumbnailProps {
  seed: string;
  title: string;
  label?: string;
  imageUrl?: string;
}

export const PreviewThumbnail = memo(({ seed, title, label, imageUrl }: PreviewThumbnailProps) => {
  if (imageUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          width={320}
          height={180}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="relative aspect-video w-full overflow-hidden flex items-end justify-center pt-5 px-5"
      style={{ backgroundImage: gradientForSeed(seed) }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{ backgroundImage: 'radial-gradient(circle at 25% 0%, rgba(255,255,255,0.45), transparent 60%)' }}
      />

      {label && (
        <span
          className={classNames(
            'absolute top-2.5 left-3 z-1 px-2 py-0.5 rounded-full',
            'text-[10px] font-medium uppercase tracking-wide',
            'bg-black/25 text-white/90 backdrop-blur-sm',
          )}
        >
          {label}
        </span>
      )}

      {/* abstract mini-site: reads as a screenshot without pretending to be one */}
      <div className="relative w-full rounded-t-md bg-white/95 dark:bg-white/90 px-3 pt-2.5 pb-3 shadow-lg">
        <div className="flex items-center gap-1 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="h-6 rounded-sm mb-2" style={{ backgroundImage: gradientForSeed(seed), opacity: 0.85 }} />
        <div className="h-1.5 w-2/3 rounded-full bg-gray-200 mb-1.5" />
        <div className="h-1.5 w-1/2 rounded-full bg-gray-200 mb-2.5" />
        <div className="grid grid-cols-3 gap-1.5">
          <span className="h-4 rounded-sm bg-gray-100" />
          <span className="h-4 rounded-sm bg-gray-100" />
          <span className="h-4 rounded-sm bg-gray-100" />
        </div>
      </div>
    </div>
  );
});
