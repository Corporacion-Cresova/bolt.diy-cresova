import { memo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { classNames } from '~/utils/classNames';
import type { RecentChatSummary } from '~/lib/persistence';
import { PreviewThumbnail } from './PreviewThumbnail';

interface ProjectCardProps {
  chat: RecentChatSummary;
  onDelete: (id: string) => void;
}

export const ProjectCard = memo(({ chat, onDelete }: ProjectCardProps) => {
  const updated = format(new Date(chat.timestamp), "d 'de' LLL, yyyy", { locale: es });

  return (
    <div
      className={classNames(
        'group relative rounded-lg overflow-hidden',
        'border border-bolt-elements-borderColor hover:border-accent-500/50',
        'bg-bolt-elements-background-depth-2',
        'transition-transform duration-150 will-change-transform hover:-translate-y-0.5',
      )}
    >
      <a href={`/chat/${chat.urlId}`} className="block" aria-label={`Abrir ${chat.description}`}>
        <PreviewThumbnail seed={chat.id} title={chat.description} label="Proyecto" />
        <div className="p-3 space-y-1">
          <h3 className="text-sm font-semibold text-bolt-elements-textPrimary truncate pr-6">{chat.description}</h3>
          <div className="flex items-center gap-1.5 text-xs text-bolt-elements-textTertiary">
            <span className="i-ph:clock-counter-clockwise" />
            <span>{updated}</span>
          </div>
        </div>
      </a>

      <button
        onClick={(event) => {
          event.preventDefault();
          onDelete(chat.id);
        }}
        className={classNames(
          'absolute bottom-3 right-2 p-1 rounded bg-transparent',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'text-bolt-elements-textTertiary hover:text-red-500 hover:bg-red-500/10',
        )}
        title="Eliminar proyecto"
      >
        <span className="i-ph:trash text-base" />
      </button>
    </div>
  );
});
