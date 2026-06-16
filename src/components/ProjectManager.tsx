import { useState } from "react";
import type { AppStore, Project } from "../types";
import { PROJECT_COLORS } from "../types";
import { Modal } from "./ui/Modal";
import { Plus, Edit, Trash, Download, Upload, FolderOpen, Copy } from "./ui/icons";
import { exportData, importData } from "../hooks/storage";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";

interface ProjectManagerProps {
  store: AppStore;
  activeProject: Project | null;
  switchProject: (id: string) => void;
  createProject: (name: string, color: string, desc: string) => string;
  updateProject: (id: string, data: Partial<Pick<Project, "name" | "color" | "description">>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  replaceStore: (store: AppStore) => void;
}

export function ProjectManager({
  store,
  switchProject,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
  replaceStore,
}: ProjectManagerProps) {
  const [editModal, setEditModal] = useState<Project | "new" | null>(null);

  function handleExport() {
    const json = exportData(store);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scrumflow-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = importData(text);
        if (confirm("Importer ce fichier ? Les données actuelles seront remplacées.")) {
          replaceStore(data as AppStore);
        }
      } catch {
        alert("Fichier invalide. Veuillez importer un fichier ScrumFlow valide.");
      }
    };
    input.click();
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Projets</h2>
          <p className="text-sm text-slate-500 mt-0.5">{store.projects.length} projet(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" icon={<Upload className="h-4 w-4" />} onClick={handleImport}>
            <span className="hidden sm:inline">Importer</span>
          </Button>
          <Button variant="secondary" size="md" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button variant="primary" size="md" icon={<Plus className="h-4 w-4" />} onClick={() => setEditModal("new")}>
            Nouveau projet
          </Button>
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
        {store.projects.map((project) => {
          const isActive = store.activeProjectId === project.id;
          const s = project.state;
          const totalStories = s.stories.length;
          const totalPoints = s.stories.reduce((acc, st) => acc + st.points, 0);
          const donePoints = s.stories.filter((st) => st.status === "done").reduce((acc, st) => acc + st.points, 0);
          const progress = totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0;

          return (
            <Card
              key={project.id}
              variant={isActive ? "bordered" : "default"}
              padding="md"
              hover
              className={`cursor-pointer ${isActive ? "border-indigo-500 ring-2 ring-indigo-100" : ""}`}
              onClick={() => switchProject(project.id)}
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${project.color} flex items-center justify-center text-white shadow-lg`}>
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div className="flex gap-1">
                  {isActive && (
                    <Badge variant="primary" size="md">Actif</Badge>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModal(project);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    aria-label="Modifier"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Project Info */}
              <h3 className="text-base font-bold text-slate-900 mb-1 truncate">{project.name}</h3>
              <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem] mb-4">
                {project.description || "Aucune description"}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-900">{totalStories}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Stories</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-900">{totalPoints}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Points</div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>Progression</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-1 text-[10px] text-slate-400 mb-3">
                <span>{s.sprints.length} sprints</span>
                <span>·</span>
                <span>{s.members.length} membres</span>
                <span>·</span>
                <span>Créé le {new Date(project.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => duplicateProject(project.id)}
                  className="flex-1"
                >
                  <span className="hidden sm:inline">Dupliquer</span>
                </Button>
                {store.projects.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash className="h-3.5 w-3.5" />}
                    onClick={() => {
                      if (confirm(`Supprimer le projet "${project.name}" ?`)) {
                        deleteProject(project.id);
                      }
                    }}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <span className="hidden sm:inline">Supprimer</span>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ProjectEditModal
        project={editModal === "new" ? null : editModal}
        isOpen={editModal !== null}
        onClose={() => setEditModal(null)}
        onSave={(name, color, desc) => {
          if (editModal === "new") {
            createProject(name, color, desc);
          } else if (editModal) {
            updateProject(editModal.id, { name, color, description: desc });
          }
          setEditModal(null);
        }}
      />
    </div>
  );
}

function ProjectEditModal({
  project,
  isOpen,
  onClose,
  onSave,
}: {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string, description: string) => void;
}) {
  const isNew = !project;
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [desc, setDesc] = useState("");

  const [prevId, setPrevId] = useState<string | null>(null);
  const currentId = project?.id ?? (isNew ? "__new__" : null);
  if (currentId !== prevId) {
    setPrevId(currentId);
    setName(project?.name || "");
    setColor(project?.color || PROJECT_COLORS[0]);
    setDesc(project?.description || "");
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? "Nouveau projet" : "Modifier le projet"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave(name.trim(), color, desc.trim());
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom du projet</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Mon super projet"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="input resize-none"
            placeholder="Description du projet..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-10 w-10 rounded-xl bg-gradient-to-br ${c} transition-all ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                    : "hover:scale-110"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose} type="button" className="flex-1">
            Annuler
          </Button>
          <Button variant="primary" size="md" type="submit" className="flex-1">
            {isNew ? "Créer le projet" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
