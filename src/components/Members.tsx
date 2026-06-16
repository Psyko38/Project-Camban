import { useState } from "react";
import type { AppState, Member } from "../types";
import { ROLE_LABELS } from "../types";
import { Modal } from "./ui/Modal";
import { Plus, Edit, Trash } from "./ui/icons";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";

interface MembersProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

const ROLE_COLORS: Record<Member["role"], string> = {
  po: "from-rose-500 to-pink-600",
  sm: "from-indigo-500 to-blue-600",
  dev: "from-emerald-500 to-teal-600",
  tester: "from-amber-500 to-orange-600",
  designer: "from-purple-500 to-violet-600",
};

export function Members({ state, setState }: MembersProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  function saveMember(member: Member) {
    setState((prev) => {
      const exists = prev.members.find((m) => m.id === member.id);
      const newMembers = exists
        ? prev.members.map((m) => (m.id === member.id ? member : m))
        : [...prev.members, member];
      return { ...prev, members: newMembers };
    });
    setIsModalOpen(false);
    setEditingMember(null);
  }

  function deleteMember(memberId: string) {
    if (!confirm("Supprimer ce membre ?")) return;
    setState((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== memberId),
      stories: prev.stories.map((s) => (s.assigneeId === memberId ? { ...s, assigneeId: undefined } : s)),
    }));
  }

  function openNewMember() {
    setEditingMember({
      id: crypto.randomUUID(),
      name: "",
      role: "dev",
    });
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Équipe</h2>
          <p className="text-sm text-slate-500 mt-0.5">{state.members.length} membres</p>
        </div>
        <Button variant="primary" size="md" icon={<Plus className="h-4 w-4" />} onClick={openNewMember}>
          Ajouter un membre
        </Button>
      </div>

      {/* Member Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
        {state.members.map((member) => {
          const assignedStories = state.stories.filter((s) => s.assigneeId === member.id);
          const doneStories = assignedStories.filter((s) => s.status === "done");
          const completionRate = assignedStories.length
            ? Math.round((doneStories.length / assignedStories.length) * 100)
            : 0;

          return (
            <Card key={member.id} variant="default" padding="md" hover>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ROLE_COLORS[member.role]} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">{member.name}</h3>
                    <Badge variant="default" size="sm" className="mt-0.5">
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingMember({ ...member });
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteMember(member.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-900">{assignedStories.length}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Stories</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-600">{doneStories.length}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Terminées</div>
                </div>
              </div>

              {/* Progress */}
              {assignedStories.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Progression</span>
                    <span className="font-semibold">{completionRate}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${completionRate}%` }} />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <MemberModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMember(null);
        }}
        member={editingMember}
        onSave={saveMember}
        onDelete={
          editingMember && state.members.find((m) => m.id === editingMember.id)
            ? () => {
                deleteMember(editingMember.id);
                setIsModalOpen(false);
                setEditingMember(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function MemberModal({
  isOpen,
  onClose,
  member,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onSave: (m: Member) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Member | null>(member);

  if (isOpen && member && form?.id !== member.id) {
    setForm(member);
  }

  if (!isOpen || !form) return null;

  const isNew = !member?.name;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? "Nouveau membre" : "Modifier le membre"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
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
            placeholder="Nom du membre"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rôle</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Member["role"] })}
            className="input"
          >
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
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
              {isNew ? "Créer le membre" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
