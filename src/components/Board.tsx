import { useState, useEffect } from "react";
import type { AppState, Story, StoryStatus } from "../types";
import { STATUS_LABELS, PRIORITY_LABELS, ROLE_LABELS } from "../types";
import { Modal } from "./ui/Modal";
import { Plus, Edit, Trash } from "./ui/icons";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";

interface BoardProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

const COLUMNS: StoryStatus[] = ["todo", "in-progress", "review", "done"];

const columnConfig: Record<StoryStatus, { label: string; color: string; bg: string }> = {
  backlog: { label: "Backlog", color: "text-slate-600", bg: "bg-slate-100" },
  todo: { label: "À faire", color: "text-blue-600", bg: "bg-blue-50" },
  "in-progress": { label: "En cours", color: "text-amber-600", bg: "bg-amber-50" },
  review: { label: "En revue", color: "text-purple-600", bg: "bg-purple-50" },
  done: { label: "Terminé", color: "text-emerald-600", bg: "bg-emerald-50" },
};

export function Board({ state, setState }: BoardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const activeSprint = state.sprints.find((s) => s.id === state.activeSprintId);
  const boardStories = activeSprint
    ? state.stories.filter((s) => s.sprintId === activeSprint.id && s.status !== "backlog")
    : [];

  function handleDragStart(e: React.DragEvent, storyId: string) {
    e.dataTransfer.setData("storyId", storyId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, status: StoryStatus) {
    e.preventDefault();
    const storyId = e.dataTransfer.getData("storyId");
    if (!storyId) return;
    setState((prev) => ({
      ...prev,
      stories: prev.stories.map((s) => (s.id === storyId ? { ...s, status } : s)),
    }));
  }

  function saveStory(story: Story) {
    setState((prev) => {
      const exists = prev.stories.find((s) => s.id === story.id);
      const newStories = exists
        ? prev.stories.map((s) => (s.id === story.id ? story : s))
        : [...prev.stories, story];
      return { ...prev, stories: newStories };
    });
    setIsModalOpen(false);
    setEditingStory(null);
  }

  function deleteStory(storyId: string) {
    if (!confirm("Supprimer cette story ?")) return;
    setState((prev) => ({
      ...prev,
      stories: prev.stories.filter((s) => s.id !== storyId),
      sprints: prev.sprints.map((s) => ({
        ...s,
        storyIds: s.storyIds.filter((id) => id !== storyId),
      })),
    }));
  }

  function openNewStory() {
    if (!activeSprint) return;
    setEditingStory({
      id: crypto.randomUUID(),
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      points: 1,
      sprintId: activeSprint.id,
      createdAt: new Date().toISOString().split("T")[0],
    });
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tableau Kanban</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeSprint ? activeSprint.name : "Aucun sprint actif"}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={openNewStory}
          disabled={!activeSprint}
        >
          Nouvelle story
        </Button>
      </div>

      {/* Board */}
      {!activeSprint ? (
        <Card variant="default" padding="lg" className="text-center py-12">
          <p className="text-slate-500">Sélectionnez un sprint actif dans l'onglet Sprints pour afficher le tableau.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4 -mx-3 px-3 md:mx-0 md:px-0 md:overflow-visible">
          <div className={`flex gap-3 md:grid md:grid-cols-4 ${isMobile ? 'min-w-[800px]' : ''}`}>
            {COLUMNS.map((status) => {
              const config = columnConfig[status];
              const columnStories = boardStories.filter((s) => s.status === status);
              
              return (
                <div
                  key={status}
                  className="flex w-[260px] md:w-auto flex-shrink-0 md:flex-shrink flex-col min-h-[12rem]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${config.bg.replace('50', '400')}`} />
                      <span className="text-sm font-semibold text-slate-700">
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {columnStories.length}
                    </span>
                  </div>
                  
                  {/* Story Cards */}
                  <div className="flex flex-1 flex-col gap-2">
                    {columnStories.map((story) => (
                      <div
                        key={story.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, story.id)}
                        onClick={() => {
                          if (isMobile) {
                            setEditingStory({ ...story });
                            setIsModalOpen(true);
                          }
                        }}
                        className="group card p-3 cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all"
                      >
                        {/* Title & Actions */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 flex-1">
                            {story.title}
                          </h4>
                          <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStory({ ...story });
                                setIsModalOpen(true);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteStory(story.id);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Description */}
                        {story.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                            {story.description}
                          </p>
                        )}
                        
                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <Badge variant={story.priority} size="sm">
                            {PRIORITY_LABELS[story.priority]}
                          </Badge>
                          <div className="flex items-center gap-2">
                            {story.assigneeId && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {state.members.find((m) => m.id === story.assigneeId)?.name.split(" ")[0]}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-700">
                              {story.points} pts
                            </span>
                          </div>
                        </div>
                        
                        {/* Mobile Status Selector */}
                        {isMobile && (
                          <select
                            value={story.status}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              setState((prev) => ({
                                ...prev,
                                stories: prev.stories.map((s) =>
                                  s.id === story.id ? { ...s, status: e.target.value as StoryStatus } : s
                                ),
                              }));
                            }}
                            className="mt-2 w-full input text-xs py-1.5"
                          >
                            {COLUMNS.map((colStatus) => (
                              <option key={colStatus} value={colStatus}>
                                {columnConfig[colStatus].label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <StoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStory(null);
        }}
        story={editingStory}
        members={state.members}
        onSave={saveStory}
        onDelete={
          editingStory && state.stories.find((s) => s.id === editingStory.id)
            ? () => {
                deleteStory(editingStory.id);
                setIsModalOpen(false);
                setEditingStory(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function StoryModal({
  isOpen,
  onClose,
  story,
  members,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  story: Story | null;
  members: AppState["members"];
  onSave: (s: Story) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Story | null>(story);

  useEffect(() => {
    if (isOpen) {
      setForm(story);
    }
  }, [story, isOpen]);

  if (!isOpen || !form) return null;

  const isNew = !story?.title && !story?.description;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? "Nouvelle story" : "Modifier la story"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) return;
          onSave(form);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Titre</label>
          <input
            required
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input"
            placeholder="En tant que... je veux..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="input resize-none"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priorité</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Story["priority"] })}
              className="input"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="critical">Critique</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Points</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) || 1 })}
              className="input"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Story["status"] })}
              className="input"
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigné à</label>
            <select
              value={form.assigneeId || ""}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value || undefined })}
              className="input"
            >
              <option value="">Non assigné</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role]})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-100">
          {onDelete && (
            <Button variant="danger" size="md" icon={<Trash className="h-4 w-4" />} onClick={onDelete} type="button">
              Supprimer
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="secondary" size="md" onClick={onClose} type="button">
              Annuler
            </Button>
            <Button variant="primary" size="md" type="submit">
              {isNew ? "Créer la story" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
