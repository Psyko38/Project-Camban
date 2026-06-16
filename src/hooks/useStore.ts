import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { AppStore, AppState, Project } from "../types";
import { storeApi } from "../api/client";

export function useStore(initial: AppStore) {
  const [store, setStore] = useState<AppStore>(initial);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from API on mount
  useEffect(() => {
    storeApi.load()
      .then((data) => {
        setStore(data);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("Failed to load from API, using initial state:", err);
        setLoaded(true);
      });
  }, []);

  // Debounced save to API
  useEffect(() => {
    if (!loaded) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      storeApi.save(store).catch((err) => {
        console.warn("Failed to save to API:", err);
      });
    }, 500);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [store, loaded]);

  // Get active project
  const activeProject = store.projects.find((p) => p.id === store.activeProjectId) || null;

  // Update active project state (compatible with React.Dispatch<SetStateAction<AppState>>)
  const setProjectState: Dispatch<SetStateAction<AppState>> = useCallback(
    (updater) => {
      setStore((prev) => {
        const projectId = prev.activeProjectId;
        if (!projectId) return prev;
        return {
          ...prev,
          projects: prev.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newState = typeof updater === "function" ? updater(p.state) : updater;
            return { ...p, state: newState };
          }),
        };
      });
    },
    []
  );

  // Switch active project
  const switchProject = useCallback((projectId: string) => {
    setStore((prev) => ({ ...prev, activeProjectId: projectId }));
  }, []);

  // Create project
  const createProject = useCallback((name: string, color: string, description: string) => {
    const id = `proj-${crypto.randomUUID()}`;
    setStore((prev) => ({
      ...prev,
      activeProjectId: id,
      projects: [
        ...prev.projects,
        {
          id,
          name,
          color,
          description,
          createdAt: new Date().toISOString().split("T")[0],
          state: { sprints: [], stories: [], members: [] },
        },
      ],
    }));
    return id;
  }, []);

  // Update project metadata
  const updateProject = useCallback(
    (projectId: string, data: Partial<Pick<Project, "name" | "color" | "description">>) => {
      setStore((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, ...data } : p
        ),
      }));
    },
    []
  );

  // Delete project
  const deleteProject = useCallback((projectId: string) => {
    setStore((prev) => {
      const remaining = prev.projects.filter((p) => p.id !== projectId);
      const wasActive = prev.activeProjectId === projectId;
      return {
        ...prev,
        projects: remaining,
        activeProjectId: wasActive ? (remaining[0]?.id ?? null) : prev.activeProjectId,
      };
    });
  }, []);

  // Duplicate project
  const duplicateProject = useCallback((projectId: string) => {
    setStore((prev) => {
      const source = prev.projects.find((p) => p.id === projectId);
      if (!source) return prev;
      const id = `proj-${crypto.randomUUID()}`;
      const clone: Project = {
        ...source,
        id,
        name: `${source.name} (copie)`,
        createdAt: new Date().toISOString().split("T")[0],
        state: JSON.parse(JSON.stringify(source.state)),
      };
      return {
        ...prev,
        projects: [...prev.projects, clone],
        activeProjectId: id,
      };
    });
  }, []);

  // Reset active project
  const resetProject = useCallback((defaultState: AppState) => {
    setStore((prev) => {
      const projectId = prev.activeProjectId;
      if (!projectId) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, state: defaultState } : p
        ),
      };
    });
  }, []);

  // Full store operations (import/export)
  const replaceStore = useCallback((newStore: AppStore) => {
    setStore(newStore);
  }, []);

  return {
    store,
    loaded,
    activeProject,
    setProjectState,
    switchProject,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    resetProject,
    replaceStore,
  };
}
