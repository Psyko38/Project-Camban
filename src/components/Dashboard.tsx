import type { AppState, Sprint, Story } from "../types";
import { CheckCircle, TrendingDown, AlertCircle, Sprint as SprintIcon, Calendar, Users } from "./ui/icons";
import { Card, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";

interface DashboardProps {
  state: AppState;
}

function getActiveSprint(state: AppState): Sprint | undefined {
  return state.sprints.find((s) => s.id === state.activeSprintId);
}

function getSprintStories(state: AppState, sprintId: string): Story[] {
  return state.stories.filter((s) => s.sprintId === sprintId);
}

function getCompletionData(stories: Story[]) {
  const total = stories.reduce((acc, s) => acc + s.points, 0);
  const done = stories.filter((s) => s.status === "done").reduce((acc, s) => acc + s.points, 0);
  const remaining = total - done;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, remaining, percent };
}

function generateBurndownData(activeSprint: Sprint, stories: Story[]) {
  const start = new Date(activeSprint.startDate);
  const end = new Date(activeSprint.endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const total = stories.reduce((acc, s) => acc + s.points, 0);

  const ideal = Array.from({ length: days + 1 }, (_, i) => ({
    x: i,
    y: total - (total / days) * i,
  }));

  const donePoints = stories.filter((s) => s.status === "done").reduce((acc, s) => acc + s.points, 0);
  const actual = Array.from({ length: days + 1 }, (_, i) => {
    const dayDone = i === days ? donePoints : donePoints * (i / days);
    return { x: i, y: Math.max(0, total - dayDone) };
  });

  return { ideal, actual, days, total };
}

export function Dashboard({ state }: DashboardProps) {
  const activeSprint = getActiveSprint(state);
  const activeStories = activeSprint ? getSprintStories(state, activeSprint.id) : [];
  const { total, done, remaining, percent } = getCompletionData(activeStories);

  const totalStories = state.stories.length;
  const doneStories = state.stories.filter((s) => s.status === "done").length;
  const inProgressStories = state.stories.filter((s) => s.status === "in-progress").length;
  const criticalStories = state.stories.filter((s) => s.priority === "critical" && s.status !== "done");

  const statusCounts = {
    backlog: state.stories.filter((s) => s.status === "backlog").length,
    todo: state.stories.filter((s) => s.status === "todo").length,
    "in-progress": state.stories.filter((s) => s.status === "in-progress").length,
    review: state.stories.filter((s) => s.status === "review").length,
    done: state.stories.filter((s) => s.status === "done").length,
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<SprintIcon className="h-5 w-5" />}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          label="Sprint actif"
          value={activeSprint ? activeSprint.name : "Aucun"}
          sub={activeSprint ? `${activeStories.length} stories` : "Sélectionnez un sprint"}
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          label="Stories terminées"
          value={`${doneStories}/${totalStories}`}
          sub={`${totalStories ? Math.round((doneStories / totalStories) * 100) : 0}% du backlog`}
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5" />}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          label="Points restants"
          value={remaining.toString()}
          sub={`sur ${total} points du sprint`}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-50"
          label="Membres"
          value={state.members.length.toString()}
          sub={`${state.members.filter((m) => m.role === "dev").length} développeurs`}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
        {/* Sprint Progress */}
        <Card variant="default" padding="lg" className="lg:col-span-2">
          <CardHeader title="Avancement du sprint actif" />
          
          {activeSprint ? (
            <div className="space-y-5">
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600 truncate max-w-[70%]">
                    Objectif : {activeSprint.goal}
                  </span>
                  <span className="font-bold text-indigo-600">{percent}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                </div>
              </div>

              {/* Mini Stats */}
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Stories" value={activeStories.length.toString()} />
                <MiniStat label="Complétés" value={done.toString()} />
                <MiniStat label="En cours" value={inProgressStories.toString()} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  Du {new Date(activeSprint.startDate).toLocaleDateString("fr-FR")} au{" "}
                  {new Date(activeSprint.endDate).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* Burndown Chart */}
              <BurndownChart activeSprint={activeSprint} stories={activeStories} />
            </div>
          ) : (
            <div className="py-12 text-center">
              <SprintIcon className="h-12 w-12 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-500">Aucun sprint actif sélectionné.</p>
            </div>
          )}
        </Card>

        {/* Critical Alerts */}
        <Card variant="default" padding="lg">
          <CardHeader title="Alertes prioritaires" />
          
          <div className="space-y-3">
            {criticalStories.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-700">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">Aucune story critique en attente.</p>
              </div>
            ) : (
              criticalStories.map((story) => (
                <div
                  key={story.id}
                  className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-700 animate-fade-in"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold line-clamp-2">{story.title}</p>
                    <p className="text-xs mt-1 text-red-600/80 line-clamp-1">{story.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card variant="default" padding="lg">
        <CardHeader title="Répartition par statut" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 md:gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="rounded-xl bg-slate-50 p-3 text-center transition hover:bg-slate-100"
            >
              <div className="text-2xl font-bold text-slate-900">{count}</div>
              <Badge variant={status as any} size="sm" className="mt-1">
                {status === "backlog" ? "Backlog" : 
                 status === "todo" ? "À faire" :
                 status === "in-progress" ? "En cours" :
                 status === "review" ? "En revue" : "Terminé"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Priority Distribution */}
      <Card variant="default" padding="lg">
        <CardHeader title="Répartition par priorité" />
        <div className="flex flex-wrap gap-2 md:gap-3">
          {(["low", "medium", "high", "critical"] as const).map((p) => {
            const count = state.stories.filter((s) => s.priority === p).length;
            return (
              <Badge key={p} variant={p} size="md">
                {p === "low" ? "Basse" : p === "medium" ? "Moyenne" : p === "high" ? "Haute" : "Critique"}
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/50 text-[10px]">
                  {count}
                </span>
              </Badge>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ 
  icon, 
  iconColor,
  iconBg,
  label, 
  value, 
  sub 
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card variant="default" padding="md" hover>
      <div className={`inline-flex p-2 rounded-xl ${iconBg} ${iconColor} mb-3`}>
        {icon}
      </div>
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900 truncate">{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function BurndownChart({ activeSprint, stories }: { activeSprint: Sprint; stories: Story[] }) {
  const { ideal, actual, days, total } = generateBurndownData(activeSprint, stories);
  if (days <= 0 || total <= 0) return null;

  const width = 600;
  const height = 200;
  const padding = 32;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  function x(i: number) {
    return padding + (i / days) * chartWidth;
  }
  function y(points: number) {
    return padding + chartHeight - (points / total) * chartHeight;
  }

  const idealPath = ideal.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.x)} ${y(p.y)}`).join(" ");
  const actualPath = actual.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.x)} ${y(p.y)}`).join(" ");

  return (
    <div className="mt-2">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">Burndown chart</h4>
      <div className="overflow-x-auto -mx-1 px-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 md:h-48 w-full min-w-[280px]">
          {/* Grid */}
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e2e8f0" strokeWidth={1} />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth={1} />
          
          {/* Labels */}
          <text x={padding - 8} y={padding + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
            {total}
          </text>
          <text x={padding - 8} y={height - padding + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
            0
          </text>
          <text x={padding} y={height - padding + 18} textAnchor="middle" className="fill-slate-400 text-[10px]">
            J0
          </text>
          <text x={width - padding} y={height - padding + 18} textAnchor="middle" className="fill-slate-400 text-[10px]">
            J{days}
          </text>
          
          {/* Ideal line */}
          <path d={idealPath} fill="none" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 4" />
          
          {/* Actual line */}
          <path d={actualPath} fill="none" stroke="url(#gradient)" strokeWidth={3} strokeLinecap="round" />
          
          {/* Gradient */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          
          {/* Points */}
          {actual.map((p, i) => (
            <circle key={i} cx={x(p.x)} cy={y(p.y)} r={4} fill="white" stroke="#4f46e5" strokeWidth={2} />
          ))}
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-slate-300 rounded" />
          Idéal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gradient-to-r from-indigo-600 to-cyan-500 rounded" />
          Réel
        </span>
      </div>
    </div>
  );
}
