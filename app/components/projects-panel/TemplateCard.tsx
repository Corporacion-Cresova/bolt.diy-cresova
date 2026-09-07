import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import type { TemplateInfo } from '~/lib/stores/projects-store';
import { PreviewThumbnail } from './PreviewThumbnail';

interface TemplateCardProps {
  template: TemplateInfo;
  onSelect: (template: TemplateInfo) => void;
}

export const TemplateCard = memo(({ template, onSelect }: TemplateCardProps) => {
  return (
    <button
      onClick={() => onSelect(template)}
      className={classNames(
        'group relative text-left rounded-lg overflow-hidden w-full',
        'border border-bolt-elements-borderColor hover:border-accent-500/50',
        'bg-bolt-elements-background-depth-2',
        'transition-transform duration-150 will-change-transform hover:-translate-y-0.5',
      )}
    >
      <PreviewThumbnail
        seed={template.id}
        title={template.name}
        label={template.category}
        imageUrl={template.thumbnailUrl}
      />
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary truncate">{template.name}</h3>
        <p className="text-xs text-bolt-elements-textSecondary line-clamp-2">{template.description}</p>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-500 pt-1">
          Usar de referencia
          <span className="i-ph:arrow-right" />
        </span>
      </div>
    </button>
  );
});
