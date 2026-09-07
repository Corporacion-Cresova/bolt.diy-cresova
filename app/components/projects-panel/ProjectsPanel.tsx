import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import {
  $projects,
  $templates,
  $selectedProjectId,
  seedTemplates,
  loadProjects,
  loadTemplates,
  removeProject,
  type ProjectInfo,
  type TemplateInfo,
} from '~/lib/stores/projects-store';
import { ProjectCard } from './ProjectCard';
import { TemplateCard } from './TemplateCard';

type Tab = 'projects' | 'templates';

interface ProjectsPanelProps {
  onSelectProject: (project: ProjectInfo) => void;
  onSelectTemplate: (template: TemplateInfo) => void;
  onNewProject: () => void;
}

export function ProjectsPanel({ onSelectProject, onSelectTemplate, onNewProject }: ProjectsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const projects = useStore($projects);
  const templates = useStore($templates);

  useEffect(() => {
    loadProjects();
    loadTemplates();
    seedTemplates();
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'templates',
      label: 'Plantillas',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: 'projects',
      label: 'Proyectos',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors duration-150',
                activeTab === tab.id
                  ? 'bg-electric-violet/20 text-electric-violet font-medium'
                  : 'text-muted-gray hover:text-soft-white hover:bg-bolt-elements-surface-secondary/50',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'projects' && projects.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-electric-violet/20 text-electric-violet">
                  {projects.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onNewProject}
          className={classNames(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
            'bg-electric-violet hover:bg-electric-violet/90 text-white font-medium',
            'transition-colors duration-150',
          )}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo proyecto
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'templates' && (
              <div>
                {templates.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={onSelectTemplate}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-gray py-8 text-center">No hay plantillas disponibles.</p>
                )}
              </div>
            )}

            {activeTab === 'projects' && (
              <div>
                {projects.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onSelect={onSelectProject}
                        onDelete={removeProject}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-gray mb-3">Aún no has guardado ningún proyecto.</p>
                    <button
                      onClick={onNewProject}
                      className="text-sm text-electric-violet hover:text-electric-violet/80 font-medium"
                    >
                      Crear tu primer proyecto
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}