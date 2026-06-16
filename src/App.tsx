import { useState, useEffect, useCallback } from "react";
import { useStore } from "./hooks/useStore";
import { initialStore, initialState } from "./data";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { Board } from "./components/Board";
import { Sprints } from "./components/Sprints";
import { Backlog } from "./components/Backlog";
import { Members } from "./components/Members";
import { ProjectManager } from "./components/ProjectManager";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { QuickNewProject } from "./components/QuickNewProject";
import { AIPanel } from "./components/AIPanel";
import { LayoutDashboard, Kanban, Sprint, ListTodo, Users, RotateCcw, Folder, Menu, X, LogOut, Sparkles } from "./components/ui/icons";
import { Button } from "./components/ui/Button";
import { getToken, setToken } from "./api/client";

type Tab = "dashboard" | "board" | "sprints" | "backlog" | "members" | "projects" | "ai";

const NAV_TABS: { id: Tab; label: string; icon: React.ReactNode; shortLabel: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, shortLabel: "Accueil" },
  { id: "board", label: "Kanban", icon: <Kanban className="h-5 w-5" />, shortLabel: "Board" },
  { id: "sprints", label: "Sprints", icon: <Sprint className="h-5 w-5" />, shortLabel: "Sprints" },
  { id: "backlog", label: "Backlog", icon: <ListTodo className="h-5 w-5" />, shortLabel: "Liste" },
  { id: "members", label: "Équipe", icon: <Users className="h-5 w-5" />, shortLabel: "Équipe" },
  { id: "ai", label: "IA", icon: <Sparkles className="h-5 w-5" />, shortLabel: "IA" },
  { id: "projects", label: "Projets", icon: <Folder className="h-5 w-5" />, shortLabel: "Projets" },
];

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => !!getToken());
  const store = useStore(initialStore);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [showNewProject, setShowNewProject] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const handleLogout = useCallback(() => {
    setToken(null);
    setAuthenticated(false);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { activeProject } = store;
  const projectState = activeProject?.state ?? initialState;
  const setProjectState = store.setProjectState;

  function resetProject() {
    if (!activeProject) return;
    if (confirm(`Réinitialiser le projet "${activeProject.name}" ?`)) {
      store.resetProject(initialState);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-sm">
                <Kanban className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-slate-900">ScrumFlow</h1>
                <p className="text-[11px] text-slate-500 -mt-0.5">Gestion de projet Scrum</p>
              </div>
            </div>

            {/* Center: Project Switcher (desktop) */}
            <div className="hidden md:block">
              <ProjectSwitcher
                projects={store.store.projects}
                activeProject={activeProject}
                switchProject={store.switchProject}
                onManage={() => handleTabChange("projects")}
                onNew={() => setShowNewProject(true)}
              />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {activeProject && (
                <button
                  onClick={resetProject}
                  className="hidden sm:flex p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Réinitialiser"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={handleLogout}
                className="hidden sm:flex p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </button>
              
              {/* Mobile: Project Switcher */}
              <div className="md:hidden">
                <ProjectSwitcher
                  projects={store.store.projects}
                  activeProject={activeProject}
                  switchProject={store.switchProject}
                  onManage={() => handleTabChange("projects")}
                  onNew={() => setShowNewProject(true)}
                />
              </div>

              {/* Mobile: Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:block max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex gap-1 -mb-px">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-2 animate-fade-in">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
        {!activeProject ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-6">
              <Folder className="h-10 w-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucun projet sélectionné</h2>
            <p className="text-slate-500 mb-8 max-w-md">
              Créez un nouveau projet ou sélectionnez-en un existant pour commencer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="lg"
                icon={<Folder className="h-5 w-5" />}
                onClick={() => setShowNewProject(true)}
              >
                Nouveau projet
              </Button>
              {store.store.projects.length > 0 && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => store.switchProject(store.store.projects[0].id)}
                >
                  Voir les projets
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && <Dashboard state={projectState} />}
            {activeTab === "board" && <Board state={projectState} setState={setProjectState} />}
            {activeTab === "sprints" && <Sprints state={projectState} setState={setProjectState} />}
            {activeTab === "backlog" && <Backlog state={projectState} setState={setProjectState} />}
            {activeTab === "members" && <Members state={projectState} setState={setProjectState} />}
            {activeTab === "ai" && (
              <AIPanel
                state={projectState}
                createProject={store.createProject}
                setProjectState={setProjectState}
              />
            )}
          </>
        )}
        {activeTab === "projects" && (
          <ProjectManager
            store={store.store}
            activeProject={activeProject}
            switchProject={store.switchProject}
            createProject={store.createProject}
            updateProject={store.updateProject}
            deleteProject={store.deleteProject}
            duplicateProject={store.duplicateProject}
            replaceStore={store.replaceStore}
          />
        )}
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 safe-area-bottom">
          <div className="grid grid-cols-7">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-indigo-600"
                    : "text-slate-400"
                }`}
              >
                {tab.icon}
                <span className="mt-0.5">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* New Project Modal */}
      <QuickNewProject
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreate={(name, color, desc) => {
          store.createProject(name, color, desc);
          setActiveTab("dashboard");
        }}
      />
    </div>
  );
}
