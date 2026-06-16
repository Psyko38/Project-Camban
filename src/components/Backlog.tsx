import { useState, useEffect } from "react";
import type { AppState, Story } from "../types";
import { STATUS_LABELS, PRIORITY_LABELS, ROLE_LABELS } from "../types";
import { Modal } from "./ui/Modal";
import { Plus, Edit, Trash, Filter, Search } from "./ui/icons";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";

interface BacklogProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function Backlog({ state, setState }: BacklogProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [filter, setFilter] = useState<"all" | Story["priority"]>("all");
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const filteredStories = state.stories.filter((s) => {
    const matchesPriority = filter === "all" || s.priority === filter;
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    return matchesPriority && matchesSearch;
  });

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
    setEditingStory({
      id: crypto.randomUUID(),
      title: "",
      description: "",
      status: "backlog",
      priority: "medium",
      points: 1,
      createdAt: new Date().toISOString().split("T")[0],
    });
    setIsModalOpen(true);
  }

  function openEditStory(story: Story) {
    setEditingStory({ ...story });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingStory(null);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Backlog produit</h2>
          <p className="text-sm text-slate-500 mt-0.5">{state.stories.length} stories au total</p>
        </div>
        <Button variant="primary" size="md" icon={<Plus className="h-4 w-4" />} onClick={openNewStory}>
          Nouvelle story
        </Button>
      </div>

      {/* Search & Filters */}
      <Card variant="default" padding="sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une story..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="hidden h-4 w-4 text-slate-400 md:block" />
            {(["all", "low", "medium", "high", "critical"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  filter === p
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p === "all" ? "Toutes" : PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Desktop Table */}
      {!isMobile && (
        <Card variant="default" padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Story</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Priorité</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Points</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Assigné</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Sprint</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStories.map((story) => (
                <StoryRow
                  key={story.id}
                  story={story}
                  state={state}
                  onEdit={openEditStory}
                  onDelete={deleteStory}
                />
              ))}
              {filteredStories.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Aucune story trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Mobile Cards */}
      {isMobile && (
        <div className="space-y-3">
          {filteredStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              state={state}
              onEdit={openEditStory}
              onDelete={deleteStory}
            />
          ))}
          {filteredStories.length === 0 && (
            <Card variant="default" padding="lg" className="text-center py-8">
              <p className="text-slate-500">Aucune story trouvée.</p>
            </Card>
          )}
        </div>
      )}

      <StoryModal
        isOpen={isModalOpen}
        onClose={closeModal}
        story={editingStory}
        members={state.members}
        sprints={state.sprints}
        onSave={saveStory}
        onDelete={
          editingStory && state.stories.find((s) => s.id === editingStory.id)
            ? () => {
                deleteStory(editingStory.id);
                closeModal();
              }
            : undefined
        }
      />
    </div>
  );
}

function StoryRow({
  story,
  state,
  onEdit,
  onDelete,
}: {
  story: Story;
  state: AppState;
  onEdit: (s: Story) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onEdit(story)}>
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-900">{story.title}</div>
        {story.description && (
          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{story.description}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant={story.priority} size="sm">{PRIORITY_LABELS[story.priority]}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={story.status} size="sm" dot>{STATUS_LABELS[story.status]}</Badge>
      </td>
      <td className="px-4 py-3 font-bold text-slate-700">{story.points}</td>
      <td className="px-4 py-3 text-slate-600">
        {story.assigneeId ? state.members.find((m) => m.id === story.assigneeId)?.name : "—"}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {story.sprintId ? state.sprints.find((s) => s.id === story.sprintId)?.name : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(story); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(story.id); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StoryCard({
  story,
  state,
  onEdit,
  onDelete,
}: {
  story: Story;
  state: AppState;
  onEdit: (s: Story) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card
      variant="default"
      padding="md"
      hover
      className="cursor-pointer"
      onClick={() => onEdit(story)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900 flex-1">{story.title}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(story.id); }}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
          aria-label="Supprimer"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
      
      {story.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{story.description}</p>
      )}
      
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={story.priority} size="sm">{PRIORITY_LABELS[story.priority]}</Badge>
        <Badge variant={story.status} size="sm" dot>{STATUS_LABELS[story.status]}</Badge>
        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
          {story.points} pts
        </span>
        {story.assigneeId && (
          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {state.members.find((m) => m.id === story.assigneeId)?.name.split(" ")[0]}
          </span>
        )}
      </div>
    </Card>
  );
}

function StoryModal({
  isOpen,
  onClose,
  story,
  members,
  sprints,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  story: Story | null;
  members: AppState["members"];
  sprints: AppState["sprints"];
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sprint</label>
            <select
              value={form.sprintId || ""}
              onChange={(e) => {
                const sprintId = e.target.value || undefined;
                const newStatus = sprintId && form.status === "backlog" ? "todo" : form.status;
                setForm({ ...form, sprintId, status: newStatus });
              }}
              className="input"
            >
              <option value="">Backlog</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
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
