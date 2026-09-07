import { memo } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import type { ProjectInfo } from '~/lib/stores/projects-store';

interface ProjectCardProps {
  project: ProjectInfo;
  onSelect: (project: ProjectInfo) => void;
  onDelete: (id: string) => void;
}

export const ProjectCard = memo(({ project, onSelect, onDelete }: ProjectCardProps) => {
  const createdDate = new Date(project.createdAt).toLocaleDateString('es-HN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
      onClick={() => onSelect(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(project)}
    >
      {/* Preview thumbnail */}
      <div className="aspect-video w-full bg-gradient-to-br from-dark-surface/50 to-deep-space flex items-center justify-center overflow-hidden">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.name}
            className="w-full h-full object-cover"
            width={320}
            height={180}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-gray/60">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <span className="text-xs">Sin preview</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-soft-white truncate flex-1">{project.name}</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-400/10 rounded"
            title="Eliminar proyecto"
          >
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-muted-gray line-clamp-2">{project.description}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-gray/60">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{createdDate}</span>
        </div>
      </div>
    </motion.div>
  );
});