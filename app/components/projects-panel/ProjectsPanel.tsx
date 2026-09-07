import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useRecentChats } from '~/lib/persistence';
import { $templates, seedTemplates, loadTemplates, type TemplateInfo } from '~/lib/stores/projects-store';
import { ProjectCard } from './ProjectCard';
import { TemplateCard } from './TemplateCard';

type Tab = 'templates' | 'projects';

interface ProjectsPanelProps {
  onSelectTemplate: (template: TemplateInfo) => void;
  onNewProject: () => void;
}

export function ProjectsPanel({ onSelectTemplate, onNewProject }: ProjectsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const templates = useStore($templates);
  const { chats, removeChat } = useRecentChats();

  useEffect(() => {
    loadTemplates();
    seedTemplates();
  }, []);

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: 'templates', label: 'Plantillas', icon: 'i-ph:squares-four', count: templates.length },
    { id: 'projects', label: 'Mis proyectos', icon: 'i-ph:folder-simple', count: chats.length },
  ];

  return (
    <div id="projects-gallery" className="w-full pt-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-theme',
                activeTab === tab.id
                  ? 'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary font-medium shadow-xs'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
              )}
            >
              <span className={classNames(tab.icon, 'text-base')} />
              {tab.label}
              {tab.count ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-500/15 text-accent-500">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          onClick={onNewProject}
          className={classNames(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-theme',
            'bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover',
            'text-bolt-elements-button-primary-text',
          )}
        >
          <span className="i-ph:plus text-base" />
          Nuevo proyecto
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'templates' &&
            (templates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <TemplateCard key={template.id} template={template} onSelect={onSelectTemplate} />
                ))}
              </div>
            ) : (
              <EmptyState text="No hay plantillas disponibles." />
            ))}

          {activeTab === 'projects' &&
            (chats.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {chats.map((chat) => (
                  <ProjectCard key={chat.id} chat={chat} onDelete={removeChat} />
                ))}
              </div>
            ) : (
              <EmptyState
                text="Todavía no has construido nada."
                action={{ label: 'Empezar un proyecto', onClick: onNewProject }}
              />
            ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="py-12 text-center rounded-lg border border-dashed border-bolt-elements-borderColor">
      <p className="text-sm text-bolt-elements-textSecondary">{text}</p>
      {action && (
        <button onClick={action.onClick} className="mt-2 text-sm font-medium text-accent-500 hover:text-accent-600">
          {action.label}
        </button>
      )}
    </div>
  );
}
