import { useState, useRef, useEffect } from "react";
import type { Project } from "../types";
import { ChevronDown, Folder, Plus, Settings } from "./ui/icons";

interface ProjectSwitcherProps {
  projects: Project[];
  activeProject: Project | null;
  switchProject: (id: string) => void;
  onManage: () => void;
  onNew: () => void;
}

export function ProjectSwitcher({
  projects,
  activeProject,
  switchProject,
  onManage,
  onNew,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
      >
        {activeProject ? (
          <>
            <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${activeProject.color} flex items-center justify-center`}>
              <Folder className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="hidden sm:block max-w-[120px] truncate">{activeProject.name}</span>
          </>
        ) : (
          <>
            <Folder className="h-5 w-5 text-slate-400" />
            <span className="hidden sm:block">Aucun projet</span>
          </>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-scale-in">
          {/* Projects List */}
          <div className="p-2 max-h-64 overflow-y-auto">
            {projects.map((project) => {
              const isActive = activeProject?.id === project.id;
              return (
                <button
                  key={project.id}
                  onClick={() => {
                    switchProject(project.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center shrink-0`}>
                    <Folder className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{project.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {project.state.stories.length} stories · {project.state.sprints.length} sprints
                    </p>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="border-t border-slate-100 p-2">
            <button
              onClick={() => {
                onNew();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nouveau projet
            </button>
            <button
              onClick={() => {
                onManage();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Gérer les projets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
