import { Router } from "express";
import { getDb } from "../db.js";
import type { AppStore, Project, AppState, Story, Sprint, Member } from "@src/types.js";

const router = Router();

// GET /api/store — Get the full store
router.get("/", (_req, res) => {
  try {
    const store = loadFullStore();
    res.json(store);
  } catch (err) {
    console.error("Failed to load store:", err);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// PUT /api/store — Replace the full store
router.put("/", (req, res) => {
  try {
    const newStore = req.body as AppStore;
    if (!newStore || typeof newStore !== "object" || !("projects" in newStore)) {
      return res.status(400).json({ error: "Format invalide" });
    }
    saveFullStore(newStore);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to save store:", err);
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
});

export function loadFullStore(): AppStore {
  const db = getDb();

  const projects = db.prepare("SELECT * FROM projects").all() as any[];
  const members = db.prepare("SELECT * FROM members").all() as any[];
  const sprints = db.prepare("SELECT * FROM sprints").all() as any[];
  const stories = db.prepare("SELECT * FROM stories").all() as any[];
  const sprintStories = db.prepare("SELECT * FROM sprint_stories ORDER BY position").all() as any[];

  const membersByProject = new Map<string, Member[]>();
  for (const m of members) {
    const member: Member = { id: m.id, name: m.name, role: m.role, avatar: m.avatar || undefined };
    if (!membersByProject.has(m.project_id)) membersByProject.set(m.project_id, []);
    membersByProject.get(m.project_id)!.push(member);
  }

  const storiesByProject = new Map<string, Story[]>();
  for (const s of stories) {
    const story: Story = {
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      priority: s.priority,
      points: s.points,
      assigneeId: s.assignee_id || undefined,
      sprintId: undefined,
      createdAt: s.created_at,
    };
    if (!storiesByProject.has(s.project_id)) storiesByProject.set(s.project_id, []);
    storiesByProject.get(s.project_id)!.push(story);
  }

  const storySprintMap = new Map<string, string>();
  for (const ss of sprintStories) {
    storySprintMap.set(ss.story_id, ss.sprint_id);
  }

  for (const [, projectStories] of storiesByProject) {
    for (const story of projectStories) {
      story.sprintId = storySprintMap.get(story.id);
    }
  }

  const sprintsByProject = new Map<string, Sprint[]>();
  for (const s of sprints) {
    const sprintStoryIds = sprintStories
      .filter((ss) => ss.sprint_id === s.id)
      .sort((a, b) => a.position - b.position)
      .map((ss) => ss.story_id);

    const sprint: Sprint = {
      id: s.id,
      name: s.name,
      goal: s.goal,
      startDate: s.start_date,
      endDate: s.end_date,
      status: s.status,
      storyIds: sprintStoryIds,
    };
    if (!sprintsByProject.has(s.project_id)) sprintsByProject.set(s.project_id, []);
    sprintsByProject.get(s.project_id)!.push(sprint);
  }

  const projectList: Project[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    description: p.description,
    createdAt: p.created_at,
    state: {
      sprints: sprintsByProject.get(p.id) || [],
      stories: storiesByProject.get(p.id) || [],
      members: membersByProject.get(p.id) || [],
      activeSprintId: p.active_sprint_id || undefined,
    },
  }));

  const activeProjectId = db.prepare("SELECT value FROM config WHERE key = 'active_project_id'").get() as { value: string } | undefined;

  return {
    projects: projectList,
    activeProjectId: activeProjectId?.value || (projectList.length > 0 ? projectList[0].id : null),
    version: 1,
  };
}

export function saveFullStore(store: AppStore): void {
  const db = getDb();

  const transaction = db.transaction(() => {
    // Clear everything
    db.exec("DELETE FROM sprint_stories");
    db.exec("DELETE FROM stories");
    db.exec("DELETE FROM sprints");
    db.exec("DELETE FROM members");
    db.exec("DELETE FROM projects");
    db.exec("DELETE FROM config");

    // Insert config
    if (store.activeProjectId) {
      db.prepare("INSERT INTO config (key, value) VALUES ('active_project_id', ?)").run(store.activeProjectId);
    }

    // Insert projects
    const insertProject = db.prepare("INSERT INTO projects (id, name, color, description, created_at, active_sprint_id) VALUES (?, ?, ?, ?, ?, ?)");
    const insertMember = db.prepare("INSERT INTO members (id, project_id, name, role, avatar) VALUES (?, ?, ?, ?, ?)");
    const insertSprint = db.prepare("INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const insertStory = db.prepare("INSERT INTO stories (id, project_id, title, description, status, priority, points, assignee_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertSprintStory = db.prepare("INSERT INTO sprint_stories (sprint_id, story_id, position) VALUES (?, ?, ?)");

    for (const project of store.projects) {
      const activeSprintId = project.state.sprints.find((s) => s.status === "active")?.id || project.state.activeSprintId || null;
      insertProject.run(project.id, project.name, project.color, project.description, project.createdAt, activeSprintId);

      for (const member of project.state.members) {
        insertMember.run(member.id, project.id, member.name, member.role, member.avatar || null);
      }

      for (const sprint of project.state.sprints) {
        insertSprint.run(sprint.id, project.id, sprint.name, sprint.goal, sprint.startDate, sprint.endDate, sprint.status);

        for (let i = 0; i < sprint.storyIds.length; i++) {
          insertSprintStory.run(sprint.id, sprint.storyIds[i], i);
        }
      }

      for (const story of project.state.stories) {
        insertStory.run(story.id, project.id, story.title, story.description, story.status, story.priority, story.points, story.assigneeId || null, story.createdAt);
      }
    }
  });

  transaction();
}

export default router;
