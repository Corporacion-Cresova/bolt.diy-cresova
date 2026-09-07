import { memo } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import type { TemplateInfo } from '~/lib/stores/projects-store';

interface TemplateCardProps {
  template: TemplateInfo;
  onSelect: (template: TemplateInfo) => void;
}

export const TemplateCard = memo(({ template, onSelect }: TemplateCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames(
        'group relative rounded-lg border border-bolt-elements-borderColor',
        'bg-bolt-elements-surface-secondary/50 hover:bg-bolt-elements-surface-secondary',
        'transition-transform duration-150 will-change-transform cursor-pointer overflow-hidden',
        'hover:border-electric-violet/30 hover:shadow-lg hover:shadow-electric-violet/10',
        'hover:-translate-y-0.5',
      )}
      onClick={() => onSelect(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(template)}
    >
      {/* Template preview */}
      <div className="aspect-video w-full bg-gradient-to-br from-electric-violet/10 to-electric-blue/10 flex items-center justify-center">
        <svg className="w-10 h-10 text-electric-violet/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-soft-white">{template.name}</h3>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-electric-violet/20 text-electric-violet">
            {template.category}
          </span>
        </div>
        <p className="text-xs text-muted-gray line-clamp-2">{template.description}</p>
        <p className="text-[10px] text-muted-gray/40">Creado: {template.createdAt}</p>
      </div>
    </motion.div>
  );
});