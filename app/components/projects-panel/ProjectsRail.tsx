import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { classNames } from '~/utils/classNames';
import { useRecentChats } from '~/lib/persistence';
import { gradientForSeed } from './PreviewThumbnail';

const RAIL_LIMIT = 8;

interface ProjectsRailProps {
  onNewProject: () => void;
}

/**
 * Always-on list of recent projects docked to the right of the landing screen.
 * It only exists before a build starts — from then on the right side belongs to
 * the workbench (see --workbench-left / --workbench-width).
 */
export function ProjectsRail({ onNewProject }: ProjectsRailProps) {
  const { chats } = useRecentChats({ limit: RAIL_LIMIT });

  return (
    <aside
      className={classNames(
        'hidden lg:flex shrink-0 w-[264px] flex-col',
        'sticky top-0 self-start h-[calc(100vh-var(--header-height))]',
        'border-l border-bolt-elements-borderColor bg-bolt-elements-background-depth-2/40',
      )}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-bolt-elements-borderColor">
        <span className="text-sm font-semibold text-bolt-elements-textPrimary">Proyectos</span>
        <button
          onClick={onNewProject}
          title="Nuevo proyecto"
          className={classNames(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-theme',
            'bg-accent-600 hover:bg-accent-700 text-white',
          )}
        >
          <span className="i-ph:plus text-sm" />
          Nuevo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto modern-scrollbar px-2 py-3">
        {chats.length === 0 ? (
          <p className="px-2 py-6 text-xs text-bolt-elements-textTertiary text-center">
            Tus proyectos aparecerán aquí cuando construyas el primero.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => (
              <li key={chat.id}>
                <a
                  href={`/chat/${chat.urlId}`}
                  className={classNames(
                    'flex items-center gap-2.5 px-2 py-2 rounded-md group',
                    'hover:bg-bolt-elements-background-depth-3 transition-theme',
                  )}
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded-md"
                    style={{ backgroundImage: gradientForSeed(chat.id) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-bolt-elements-textPrimary truncate">{chat.description}</span>
                    <span className="block text-xs text-bolt-elements-textTertiary">
                      {format(new Date(chat.timestamp), "d 'de' LLL", { locale: es })}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => document.querySelector('#projects-gallery')?.scrollIntoView({ behavior: 'smooth' })}
        className={classNames(
          'flex items-center justify-center gap-1 px-4 py-3 text-xs font-medium',
          'bg-transparent border-t border-bolt-elements-borderColor',
          'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-theme',
        )}
      >
        Ver todos
        <span className="i-ph:arrow-down text-sm" />
      </button>
    </aside>
  );
}
