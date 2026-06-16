import { useState } from "react";
import type { AppState, Sprint } from "../types";
import { STATUS_LABELS, PRIORITY_LABELS } from "../types";
import { Modal } from "./ui/Modal";
import { Plus, Edit, Trash, Calendar } from "./ui/icons";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";

interface SprintsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function Sprints({ state, setState }: SprintsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [expandedSprint, setExpandedSprint] = useState<string | null>(state.activeSprintId || null);

  function setActiveSprint(sprintId: string) {
    setState((prev) => ({
      ...prev,
      activeSprintId: sprintId,
      sprints: prev.sprints.map((s) => ({
        ...s,
        status: s.id === sprintId ? "active" : s.status === "active" ? "planned" : s.status,
      })),
    }));
  }

  function saveSprint(sprint: Sprint) {
    setState((prev) => {
      const exists = prev.sprints.find((s) => s.id === sprint.id);
      const newSprints = exists
        ? prev.sprints.map((s) => (s.id === sprint.id ? sprint : s))
        : [...prev.sprints, sprint];
      return { ...prev, sprints: newSprints };
    });
    setIsModalOpen(false);
    setEditingSprint(null);
  }

  function deleteSprint(sprintId: string) {
    if (!confirm("Supprimer ce sprint ? Les stories ne seront pas supprimées.")) return;
    setState((prev) => ({
      ...prev,
      sprints: prev.sprints.filter((s) => s.id !== sprintId),
      activeSprintId: prev.activeSprintId === sprintId ? undefined : prev.activeSprintId,
    }));
  }

  function toggleStoryInSprint(sprintId: string, storyId: string) {
    setState((prev) => {
      const sprint = prev.sprints.find((s) => s.id === sprintId);
      if (!sprint) return prev;
      const hasStory = sprint.storyIds.includes(storyId);
      const newStoryIds = hasStory
        ? sprint.storyIds.filter((id) => id !== storyId)
        : [...sprint.storyIds, storyId];
      return {
        ...prev,
        sprints: prev.sprints.map((s) => (s.id === sprintId ? { ...s, storyIds: newStoryIds } : s)),
        stories: prev.stories.map((s) =>
          s.id === storyId
            ? { ...s, sprintId: hasStory ? undefined : sprintId, status: hasStory ? "backlog" : "todo" }
            : s
        ),
      };
    });
  }

  function openNewSprint() {
    const today = new Date().toISOString().split("T")[0];
    const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setEditingSprint({
      id: crypto.randomUUID(),
      name: `Sprint ${state.sprints.length + 1}`,
      goal: "",
      startDate: today,
      endDate: end,
      status: "planned",
      storyIds: [],
    });
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sprints</h2>
          <p className="text-sm text-slate-500 mt-0.5">{state.sprints.length} sprint(s) planifié(s)</p>
        </div>
        <Button variant="primary" size="md" icon={<Plus className="h-4 w-4" />} onClick={openNewSprint}>
          Nouveau sprint
        </Button>
      </div>

      {/* Sprint List */}
      <div className="space-y-4">
        {state.sprints.map((sprint) => {
          const sprintStories = state.stories.filter((s) => s.sprintId === sprint.id);
          const totalPoints = sprintStories.reduce((acc, s) => acc + s.points, 0);
          const donePoints = sprintStories.filter((s) => s.status === "done").reduce((acc, s) => acc + s.points, 0);
          const isActive = state.activeSprintId === sprint.id;
          const isExpanded = expandedSprint === sprint.id;
          const progress = totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0;

          return (
            <Card
              key={sprint.id}
              variant={isActive ? "bordered" : "default"}
              padding="lg"
              className={isActive ? "border-indigo-500 ring-1 ring-indigo-100" : ""}
            >
              {/* Sprint Header */}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">{sprint.name}</h3>
                    {isActive && <Badge variant="primary" size="md">Actif</Badge>}
                    {sprint.status === "completed" && <Badge variant="success" size="md">Terminé</Badge>}
                  </div>
                  
                  {sprint.goal && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{sprint.goal}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(sprint.startDate).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(sprint.endDate).toLocaleDateString("fr-FR")}
                    </span>
                    <span>{sprintStories.length} stories</span>
                    <span>{totalPoints} pts</span>
                    <span className="text-emerald-600 font-medium">{donePoints} pts terminés</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isActive && (
                    <Button variant="secondary" size="sm" onClick={() => setActiveSprint(sprint.id)}>
                      Activer
                    </Button>
                  )}
                  <button
                    onClick={() => {
                      setEditingSprint({ ...sprint });
                      setIsModalOpen(true);
                    }}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteSprint(sprint.id)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedSprint(isExpanded ? null : sprint.id)}
                    className="md:hidden px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {isExpanded ? "Masquer" : "Voir stories"}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {totalPoints > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>Progression</span>
                    <span className="font-semibold">{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Stories Section */}
              {(isActive || isExpanded) && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Stories du sprint ({sprintStories.length})
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {state.stories
                      .filter((s) => !s.sprintId || s.sprintId === sprint.id)
                      .map((story) => {
                        const inSprint = sprint.storyIds.includes(story.id);
                        return (
                          <label
                            key={story.id}
                            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                              inSprint
                                ? "border-indigo-200 bg-indigo-50/50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={inSprint}
                              onChange={() => toggleStoryInSprint(sprint.id, story.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 line-clamp-2">
                                {story.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <Badge variant={story.priority} size="sm">
                                  {PRIORITY_LABELS[story.priority]}
                                </Badge>
                                <span className="text-[10px] text-slate-400">{story.points} pts</span>
                                <Badge variant={story.status} size="sm" dot>
                                  {STATUS_LABELS[story.status]}
                                </Badge>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <SprintModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSprint(null);
        }}
        sprint={editingSprint}
        onSave={saveSprint}
        onDelete={
          editingSprint && state.sprints.find((s) => s.id === editingSprint.id)
            ? () => {
                deleteSprint(editingSprint.id);
                setIsModalOpen(false);
                setEditingSprint(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function SprintModal({
  isOpen,
  onClose,
  sprint,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  sprint: Sprint | null;
  onSave: (s: Sprint) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Sprint | null>(sprint);

  if (isOpen && sprint && form?.id !== sprint.id) {
    setForm(sprint);
  }

  if (!isOpen || !form) return null;

  const isNew = !sprint?.goal && sprint?.name?.startsWith("Sprint");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? "Nouveau sprint" : "Modifier le sprint"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Objectif</label>
          <textarea
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
            rows={2}
            className="input resize-none"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de début</label>
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de fin</label>
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="input"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Statut</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Sprint["status"] })}
            className="input"
          >
            <option value="planned">Planifié</option>
            <option value="active">Actif</option>
            <option value="completed">Terminé</option>
          </select>
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
              {isNew ? "Créer le sprint" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
