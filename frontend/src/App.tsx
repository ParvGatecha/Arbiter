import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useParams } from "react-router-dom";
import {
  Activity,
  Layers,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Database,
  Flame,
  Clock,
  Play,
  RotateCw,
  Plus,
  HelpCircle,
  LayoutGrid,
  Terminal,
  ArrowLeft,
  BookOpen,
  TrendingUp
} from "lucide-react";

import CompareRuns from "./pages/CompareRuns";
import RunDetail from "./pages/RunDetail";
import TriggerRunModal from "./components/TriggerRunModal";

const API_URL = "http://localhost:8000";

// --- Interfaces ---
interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

interface TestSuite {
  id: number;
  project_id: number;
  name: string;
  system_prompt: string;
  target_model_config: Record<string, any>;
  intent_definition: Record<string, string>;
}

interface TestCase {
  id: number;
  suite_id: number;
  input_prompt: string;
  expected_output?: string;
  intent_category: string;
  adversarial_flag: boolean;
}

interface EvaluationRun {
  id: number;
  suite_id: number;
  status: string;
  commit_sha?: string;
  branch?: string;
  created_at: string;
}

// --- HomeDashboard Component (Previously main page body) ---
function HomeDashboard({
  selectedProject,
  setSelectedProject,
  projects,
  fetchProjects
}: {
  selectedProject: Project | null;
  setSelectedProject: (p: Project) => void;
  projects: Project[];
  fetchProjects: () => void;
}) {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [activeTab, setActiveTab] = useState<"intents" | "cases" | "history">("intents");
  
  // Modals
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);

  // Form states
  const [suiteName, setSuiteName] = useState("");
  const [suitePrompt, setSuitePrompt] = useState("");
  const [suiteIntents, setSuiteIntents] = useState<string>("sql_generation: Must output clean SQL only.\nsafety: Must reject toxic questions.");
  const [suiteConfig, setSuiteConfig] = useState<string>('{"provider": "ollama", "model": "llama3", "temperature": 0.7}');

  const [casePrompt, setCasePrompt] = useState("");
  const [caseCategory, setCaseCategory] = useState("");
  const [caseExpected, setCaseExpected] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedProject) {
      fetchSuites(selectedProject.id);
      setSelectedSuite(null);
      setRuns([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedSuite) {
      fetchRuns(selectedSuite.id);
      fetchCases(selectedSuite.id);
    }
  }, [selectedSuite]);

  const fetchSuites = async (projectId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/suites`);
      if (res.ok) {
        const data = await res.json();
        setTestSuites(data.filter((s: any) => s.project_id === projectId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async (suiteId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/suites/${suiteId}/cases`);
      if (res.ok) {
        const data = await res.json();
        setTestCases(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRuns = async (suiteId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/runs/`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.filter((r: any) => r.suite_id === suiteId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !suiteName || !suitePrompt) return;

    const intentMap: Record<string, string> = {};
    suiteIntents.split("\n").forEach(line => {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 1).trim();
        if (key && val) intentMap[key] = val;
      }
    });

    try {
      const res = await fetch(`${API_URL}/api/suites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProject.id,
          name: suiteName,
          system_prompt: suitePrompt,
          target_model_config: JSON.parse(suiteConfig),
          intent_definition: intentMap
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTestSuites([...testSuites, data]);
        setSelectedSuite(data);
        setShowSuiteModal(false);
        setSuiteName("");
        setSuitePrompt("");
      }
    } catch (err) {
      alert("Error: invalid JSON configuration or connection failure.");
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuite || !casePrompt || !caseCategory) return;
    try {
      const res = await fetch(`${API_URL}/api/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suite_id: selectedSuite.id,
          input_prompt: casePrompt,
          intent_category: caseCategory,
          expected_output: caseExpected || null,
          adversarial_flag: false
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTestCases([...testCases, data]);
        setShowCaseModal(false);
        setCasePrompt("");
        setCaseCategory("");
        setCaseExpected("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerAdversarial = async () => {
    if (!selectedSuite) return;
    try {
      const res = await fetch(`${API_URL}/api/suites/${selectedSuite.id}/generate-adversarial`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Pydantic AI Red-Teaming triggered. Generating test variants in background.");
        setTimeout(() => fetchCases(selectedSuite.id), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-96 border border-white/[0.04] bg-white/[0.01] rounded-2xl text-center p-8 backdrop-blur-sm max-w-lg mx-auto mt-12 animate-fade-in shadow-xl shadow-black/5">
        <Layers className="h-14 w-14 text-indigo-500/80 animate-pulse mb-4" />
        <h3 className="text-xl font-bold text-gray-200">No Projects Configured</h3>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">Create a project container at the top right to start modeling evaluation test cases and pipelines.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {!selectedSuite ? (
        <div className="space-y-8">
          {/* Hero Landing Analytics Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-[#0c0d19]/40 to-[#050609]/40 p-8 shadow-2xl backdrop-blur-sm">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 space-y-4 max-w-2xl">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full font-bold uppercase tracking-widest">Enterprise Console</span>
              <h2 className="text-3xl font-black text-gray-100 tracking-tight leading-none mt-2">
                Model Evaluation & Trust Workspace
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Arbiter enables automated adversarial generation, intent validation boundaries, and bootstrap statistical regression checks on local and API LLM deployments.
              </p>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 border-t border-white/[0.05] pt-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Active Project</span>
                <span className="text-lg font-extrabold text-gray-200 mt-1">{selectedProject.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Configured Suites</span>
                <span className="text-lg font-extrabold text-indigo-400 mt-1">{testSuites.length} suites</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Workspace Status</span>
                <span className="text-lg font-extrabold text-emerald-450 mt-1 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Operational
                </span>
              </div>
            </div>
          </div>

          {/* Suites Grid Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold text-gray-150 tracking-tight flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-indigo-500" />
                  Validation Pipelines
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Deploy custom red-teaming targets and boundaries.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {testSuites.map(suite => {
                const intentsCount = Object.keys(suite.intent_definition).length;
                return (
                  <div
                    key={suite.id}
                    onClick={() => setSelectedSuite(suite)}
                    className="glass-card rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.01] hover:border-indigo-500/30 hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer shadow-lg relative overflow-hidden group min-h-[180px]"
                  >
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none"></div>
                    <div className="space-y-3">
                      <span className="text-[9px] bg-white/[0.03] border border-white/[0.06] text-indigo-400 px-2.5 py-0.5 rounded-lg font-mono font-semibold uppercase tracking-wider">
                        {suite.target_model_config.provider}
                      </span>
                      <h4 className="text-lg font-bold text-gray-155 group-hover:text-white transition-colors tracking-tight line-clamp-1">{suite.name}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.keys(suite.intent_definition).slice(0, 2).map(cat => (
                          <span key={cat} className="text-[8px] bg-indigo-500/5 text-indigo-400/90 border border-indigo-500/10 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">{cat}</span>
                        ))}
                        {intentsCount > 2 && <span className="text-[8px] text-gray-500 font-semibold uppercase tracking-wider">+{intentsCount - 2} more</span>}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.03] pt-4 mt-6 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                      <span>Model: {suite.target_model_config.model}</span>
                      <span className="flex items-center gap-1 text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                        Open Workspace <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Create Suite Card Grid Trigger */}
              <div
                onClick={() => setShowSuiteModal(true)}
                className="border-2 border-dashed border-white/[0.05] hover:border-indigo-500/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[180px] bg-white/[0.005] hover:bg-white/[0.01] shadow-inner group"
              >
                <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all text-gray-500 group-hover:text-indigo-400 mb-3 shadow">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Create Test Suite</span>
                <p className="text-[10px] text-gray-500 max-w-[200px] mt-1 leading-relaxed">Establish intent security metrics and testing boundaries.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Breadcrumb Path Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase tracking-widest">
              <span>Suites</span>
              <span>/</span>
              <span className="text-gray-400">{selectedSuite.name}</span>
            </div>
            <button 
              onClick={() => setSelectedSuite(null)} 
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace Grid
            </button>
          </div>

          {/* Main Suite Workspace Header Panel */}
          <div className="glass-card rounded-2xl p-6 shadow-xl flex flex-wrap justify-between items-center gap-4 transition-all duration-300 hover:shadow-indigo-500/5">
            <div>
              <h2 className="text-2xl font-black text-gray-100 tracking-tight">{selectedSuite.name}</h2>
              <p className="text-xs text-gray-500 mt-1.5 flex gap-2 font-mono">
                <span>Provider: <span className="text-indigo-400">{selectedSuite.target_model_config.provider}</span></span>
                <span>|</span>
                <span>Model: <span className="text-indigo-400">{selectedSuite.target_model_config.model}</span></span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTriggerAdversarial}
                className="flex items-center gap-2 px-4.5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold rounded-xl transition-all duration-200 active:scale-95 shadow-md shadow-red-500/5 cursor-pointer"
              >
                <Flame className="h-4 w-4 text-red-400 animate-pulse" />
                Red-Team Intents
              </button>
              <button
                onClick={() => setIsTriggerModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-500/15 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-white text-white" />
                Run Evaluation
              </button>
            </div>
          </div>

          {/* Modern Workspace Navigation Tabs */}
          <div className="flex border-b border-white/[0.04]">
            <button
              onClick={() => setActiveTab("intents")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-[2px] cursor-pointer ${
                activeTab === "intents"
                  ? "text-indigo-400 border-indigo-500 font-extrabold"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              Intent Boundaries
            </button>
            <button
              onClick={() => setActiveTab("cases")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-[2px] cursor-pointer ${
                activeTab === "cases"
                  ? "text-indigo-400 border-indigo-500 font-extrabold"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              Test Cases ({testCases.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-[2px] cursor-pointer ${
                activeTab === "history"
                  ? "text-indigo-400 border-indigo-500 font-extrabold"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              Execution Runs ({runs.length})
            </button>
          </div>

          {/* Tab Content Rendering */}
          <div className="animate-fade-in">
            {activeTab === "intents" && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-bold text-gray-200">
                  <BookOpen className="h-4.5 w-4.5 text-indigo-500" />
                  <h4>Defined Security Guardrails</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedSuite.intent_definition).map(([cat, desc]) => (
                    <div key={cat} className="p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl hover:border-indigo-500/10 transition-colors">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{cat}</span>
                      <p className="text-xs text-gray-300 mt-2 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "cases" && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
                    <Layers className="h-4.5 w-4.5 text-blue-500" />
                    <h4>Evaluation Prompt Templates</h4>
                  </div>
                  <button 
                    onClick={() => setShowCaseModal(true)} 
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 px-3 py-1.5 rounded-xl transition-all duration-200 cursor-pointer"
                  >
                    <Plus className="h-3 w-3 inline mr-1" /> Add Custom Case
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[480px] overflow-y-auto pr-1">
                  {testCases.map((tc, idx) => (
                    <div key={tc.id} className="p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl relative overflow-hidden hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between min-h-[100px]">
                      <p className="text-xs text-gray-200 font-mono leading-relaxed break-all">{tc.input_prompt}</p>
                      <div className="border-t border-white/[0.03] pt-3 mt-4 flex justify-between items-center text-[9px] text-gray-500 font-mono">
                        <span>CASE #{idx + 1} | Category: <span className="text-indigo-400/80">{tc.intent_category}</span></span>
                        {tc.adversarial_flag && (
                          <span className="text-red-400 font-bold uppercase tracking-wider">Adversarial</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-bold text-gray-200">
                  <Terminal className="h-4.5 w-4.5 text-emerald-500" />
                  <h4>Evaluation Run Logs</h4>
                </div>

                {runs.length === 0 ? (
                  <p className="text-gray-500 text-xs py-4 text-center">No runs found. Launch a run above to execute security benchmarks.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {runs.map(run => (
                      <Link
                        key={run.id}
                        to={`/runs/${run.id}`}
                        className="p-5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.05] hover:border-indigo-500/30 rounded-2xl transition-all duration-300 flex flex-col justify-between hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-gray-200">Run #{run.id}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            run.status === "COMPLETED" ? "bg-green-500/10 text-green-400 border border-green-500/20 shadow-sm shadow-green-500/10" : run.status === "RUNNING" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse shadow-sm shadow-yellow-500/10" : "bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm shadow-red-500/10"
                          }`}>
                            {run.status}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-gray-500 font-mono mt-4 border-t border-white/[0.03] pt-3">
                          <span>Branch: {run.branch || "main"}</span>
                          <span>Commit: {run.commit_sha ? run.commit_sha.substring(0, 7) : "manual"}</span>
                          <span>Time: {new Date(run.created_at).toLocaleTimeString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Run execution trigger Modal */}
          <TriggerRunModal
            isOpen={isTriggerModalOpen}
            onClose={() => setIsTriggerModalOpen(false)}
            projectId={selectedProject.id}
            suiteId={selectedSuite.id}
            defaultTargetUrl={selectedSuite.target_model_config.url}
            defaultSystemPrompt={selectedSuite.system_prompt}
          />
        </div>
      )}

      {/* Modal Forms */}
      {showSuiteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-center items-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-100">New Test Suite</h3>
            <form onSubmit={handleCreateSuite} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Suite Name"
                value={suiteName}
                onChange={e => setSuiteName(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
              />
              <textarea
                required
                placeholder="System Prompt configured on target model"
                value={suitePrompt}
                onChange={e => setSuitePrompt(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 h-20 focus:outline-none resize-none"
              />
              <textarea
                required
                placeholder="Intents mapping (category: explanation per line)"
                value={suiteIntents}
                onChange={e => setSuiteIntents(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 h-24 font-mono focus:outline-none resize-none"
              />
              <textarea
                required
                placeholder="Target model config JSON"
                value={suiteConfig}
                onChange={e => setSuiteConfig(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 h-20 font-mono focus:outline-none resize-none"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSuiteModal(false)} className="w-1/2 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-gray-300 transition-colors hover:bg-white/[0.06]">Cancel</button>
                <button type="submit" className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow shadow-blue-500/10 transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCaseModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-center items-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-100">New Custom Case</h3>
            <form onSubmit={handleCreateCase} className="space-y-4">
              <textarea
                required
                placeholder="Test Query / Input Prompt (e.g. Solve: 3x + 5 = 11)"
                value={casePrompt}
                onChange={e => setCasePrompt(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 h-20 focus:outline-none resize-none"
              />
              <input
                type="text"
                required
                placeholder="Intent Category (e.g. correctness, sql_generation)"
                value={caseCategory}
                onChange={e => setCaseCategory(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Expected Correct Answer / Perfect Output (Optional, e.g. x = 2)"
                value={caseExpected}
                onChange={e => setCaseExpected(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCaseModal(false)} className="w-1/2 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-gray-300 transition-colors hover:bg-white/[0.06]">Cancel</button>
                <button type="submit" className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow shadow-blue-500/10 transition-colors">Add Case</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- App Main Component containing Router and Layout ---
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
        }
      }
    } catch (err) {
      console.error("Backend offline", err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName) return;
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, description: projectDesc })
      });
      if (res.ok) {
        const data = await res.json();
        setProjects([...projects, data]);
        setSelectedProject(data);
        setShowProjectModal(false);
        setProjectName("");
        setProjectDesc("");
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to create project: ${errData.detail || res.statusText || "Unknown server error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create project: Network connection error or backend offline.");
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-darkBg text-gray-100 flex flex-col font-sans">
        
        {/* Consistent Top Header */}
        <header className="border-b border-white/[0.05] bg-[#090a0f]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-lg shadow-black/20">
          <Link to="/" className="flex items-center gap-3 hover:opacity-95 transition-all no-underline">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/25 animate-pulse-glow">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 leading-none">
                Arbiter
              </h1>
              <p className="text-[9px] text-indigo-400/60 font-extrabold uppercase tracking-widest mt-1">Evaluation Guard</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {projects.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                  className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.04] px-4.5 py-2.5 rounded-xl text-xs font-bold text-gray-250 shadow-lg transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
                >
                  <span className="text-indigo-400 font-extrabold uppercase tracking-wider text-[9px]">Project:</span>
                  <span className="font-extrabold tracking-tight text-gray-200">{selectedProject?.name || "Select Project"}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isProjectDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isProjectDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProjectDropdownOpen(false)}
                    />
                    
                    <div className="absolute right-0 mt-2 w-56 bg-[#090a0f]/95 border border-white/[0.06] rounded-2xl shadow-2xl backdrop-blur-xl p-2.5 z-50 animate-fade-in space-y-1">
                      <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest px-2.5 py-1.5 border-b border-white/[0.03] mb-1">
                        Select Workspace
                      </div>
                      {projects.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProject(p);
                            setIsProjectDropdownOpen(false);
                          }}
                          className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-xs font-semibold flex items-center justify-between border ${
                            selectedProject?.id === p.id 
                              ? "bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-sm shadow-indigo-500/5" 
                              : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.02]"
                          }`}
                        >
                          <span className="truncate pr-2">{p.name}</span>
                          {selectedProject?.id === p.id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            
            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-xs font-bold text-white rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-500/15"
            >
              <FolderPlus className="h-4 w-4" />
              New Project
            </button>
          </div>
        </header>

        {/* Router View Area */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <Routes>
            <Route 
              path="/" 
              element={
                <HomeDashboard 
                  projects={projects} 
                  selectedProject={selectedProject} 
                  setSelectedProject={setSelectedProject}
                  fetchProjects={fetchProjects}
                />
              } 
            />
            <Route path="/runs/:runId" element={<RunDetail />} />
            <Route path="/runs/:runId/compare/:baselineId" element={<CompareRuns />} />
          </Routes>
        </main>

        <footer className="border-t border-white/[0.05] bg-[#0c0d12]/20 py-4 text-center text-xs text-gray-600">
          ARBITER LLM Evaluator &copy; {new Date().getFullYear()} - Red-Teaming & Statistical Regression Control Portal.
        </footer>

        {/* Project Form Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-center items-center p-4">
            <div className="glass-card rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-gray-100">New Project Container</h3>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Project Name"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
                />
                <textarea
                  placeholder="Project Description Details"
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 h-24 focus:outline-none resize-none"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowProjectModal(false)} className="w-1/2 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-gray-300 transition-colors hover:bg-white/[0.06]">Cancel</button>
                  <button type="submit" className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow shadow-blue-500/10 transition-colors">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </HashRouter>
  );
}
