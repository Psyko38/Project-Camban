export type StoryStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
export type StoryPriority = "low" | "medium" | "high" | "critical";

export interface Member {
  id: string;
  name: string;
  role: "po" | "sm" | "dev" | "tester" | "designer";
  avatar?: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: "planned" | "active" | "completed";
  storyIds: string[];
}

export interface Story {
  id: string;
  title: string;
  description: string;
  status: StoryStatus;
  priority: StoryPriority;
  points: number;
  assigneeId?: string;
  sprintId?: string;
  createdAt: string;
}

export interface AppState {
  sprints: Sprint[];
  stories: Story[];
  members: Member[];
  activeSprintId?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
  state: AppState;
}

export interface AppStore {
  projects: Project[];
  activeProjectId: string | null;
  version: number;
}

export const PROJECT_COLORS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-red-500 to-rose-600",
];

export const STATUS_LABELS: Record<StoryStatus, string> = {
  backlog: "Backlog",
  todo: "À faire",
  "in-progress": "En cours",
  review: "En revue",
  done: "Terminé",
};

export const STATUS_COLORS: Record<StoryStatus, string> = {
  backlog: "bg-slate-100 text-slate-700 border-slate-200",
  todo: "bg-blue-50 text-blue-700 border-blue-200",
  "in-progress": "bg-amber-50 text-amber-700 border-amber-200",
  review: "bg-purple-50 text-purple-700 border-purple-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const PRIORITY_LABELS: Record<StoryPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

export const PRIORITY_COLORS: Record<StoryPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export const ROLE_LABELS: Record<Member["role"], string> = {
  po: "Product Owner",
  sm: "Scrum Master",
  dev: "Développeur",
  tester: "Testeur",
  designer: "Designer",
};

// ── AI Generated Types ────────────────────────────────────────────────

export interface AcceptanceCriteriaItem {
  given: string;
  when: string;
  then: string;
  priority: "must" | "should" | "could";
}

export interface AcceptanceCriteria {
  criteria: AcceptanceCriteriaItem[];
  testSuggestions: string[];
}

export interface RetrospectiveAction {
  action: string;
  owner?: string;
  deadline?: string;
}

export interface RetrospectiveMetric {
  label: string;
  value: string;
  trend: "improving" | "stable" | "declining";
}

export interface Retrospective {
  keepDoing: string[];
  startDoing: string[];
  stopDoing: string[];
  actions: RetrospectiveAction[];
  metrics: RetrospectiveMetric[];
}

export interface StoryReviewIssue {
  severity: "critical" | "warning" | "info";
  message: string;
  suggestion: string;
}

export interface StoryReview {
  score: number;
  issues: StoryReviewIssue[];
  improvedStory: {
    title: string;
    description: string;
    points: number;
    priority: string;
  };
}

export interface Estimation {
  recommendedPoints: number;
  minPoints: number;
  maxPoints: number;
  reasoning: string;
  factors: { factor: string; impact: "low" | "medium" | "high" }[];
}
