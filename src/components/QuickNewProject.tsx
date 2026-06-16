import { useState } from "react";
import { PROJECT_COLORS } from "../types";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

interface QuickNewProjectProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string, description: string) => void;
}

export function QuickNewProject({ isOpen, onClose, onCreate }: QuickNewProjectProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [desc, setDesc] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color, desc.trim());
    setName("");
    setDesc("");
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau projet" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Nom du projet
          </label>
          <input
            required
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Mon super projet"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Description
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="input resize-none"
            placeholder="Description du projet..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Couleur
          </label>
          <div className="flex flex-wrap gap-2.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${c} transition-all ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                    : "hover:scale-110"
                }`}
              />
            ))}
          </div>
        </div>
        
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={onClose}
            type="button"
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            size="lg"
            type="submit"
            className="flex-1"
          >
            Créer le projet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
