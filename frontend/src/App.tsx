import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useParams } from "react-router-dom";
import {
  Activity,
  Layers,
  FolderPlus,
  ChevronRight,
  Database,
  Flame,
  Clock,
  Play,
  RotateCw,
  Plus,
  HelpCircle
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
      <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-darkBorder rounded-xl bg-darkCard/25 text-center p-6">
        <Layers className="h-12 w-12 text-gray-700 animate-pulse mb-3" />
        <h3 className="text-lg font-bold text-gray-300">No Projects Configured</h3>
        <p className="text-gray-500 text-sm mt-1 max-w-sm">Create a project container at the top right to start modeling evaluation test cases.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left side: suites */}
      <div className="col-span-12 md:col-span-4 bg-darkCard border border-darkBorder rounded-xl p-5 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
            <Database className="text-blue-500 h-4.5 w-4.5" />
            Test Suites
          </h2>
          <button
            onClick={() => setShowSuiteModal(true)}
            className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <RotateCw className="h-6 w-6 text-blue-500 animate-spin" />
          </div>
        ) : testSuites.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-6">No test suites created yet.</p>
        ) : (
          <div className="space-y-2.5">
            {testSuites.map(suite => (
              <div
                key={suite.id}
                onClick={() => setSelectedSuite(suite)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedSuite?.id === suite.id
                    ? "bg-darkBg border-blue-500 shadow-lg shadow-blue-500/5"
                    : "bg-darkBg/40 hover:bg-darkBg border-darkBorder/60"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-gray-200">{suite.name}</span>
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </div>
                <span className="text-[10px] text-gray-500 font-mono mt-2 block">
                  Model: {suite.target_model_config.model}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right side: Suite execution and runs */}
      <div className="col-span-12 md:col-span-8 space-y-6">
        {selectedSuite ? (
          <>
            {/* Header info */}
            <div className="bg-darkCard border border-darkBorder rounded-xl p-5 shadow-xl flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-200">{selectedSuite.name}</h2>
                <p className="text-xs text-gray-500 mt-1 flex gap-2 font-mono">
                  <span>Provider: {selectedSuite.target_model_config.provider}</span>
                  <span>|</span>
                  <span>Model: {selectedSuite.target_model_config.model}</span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTriggerAdversarial}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-950/60 border border-red-900/60 text-red-300 text-xs font-bold rounded-lg transition-all"
                >
                  <Flame className="h-3.5 w-3.5 text-red-400" />
                  Red-Team Intents
                </button>
                <button
                  onClick={() => setIsTriggerModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow shadow-blue-500/10"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  Run Evaluation
                </button>
              </div>
            </div>

            {/* Test boundary and cases */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-darkCard border border-darkBorder rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  Intent boundaries
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {Object.entries(selectedSuite.intent_definition).map(([cat, desc]) => (
                    <div key={cat} className="p-3 bg-darkBg border border-darkBorder rounded-lg">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">{cat}</span>
                      <p className="text-xs text-gray-300 mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-darkCard border border-darkBorder rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-blue-500" />
                    Test Cases ({testCases.length})
                  </h3>
                  <button 
                    onClick={() => setShowCaseModal(true)} 
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Case
                  </button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {testCases.map((tc, idx) => (
                    <div key={tc.id} className="p-3 bg-darkBg border border-darkBorder rounded-lg relative overflow-hidden">
                      <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                        <span>#{idx + 1}</span>
                        {tc.adversarial_flag && <span className="text-red-400 font-bold uppercase">Adversarial</span>}
                      </div>
                      <p className="text-xs text-gray-200 mt-1.5 font-mono truncate">{tc.input_prompt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Runs list */}
            <div className="bg-darkCard border border-darkBorder rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-4">Evaluation execution history</h3>
              {runs.length === 0 ? (
                <p className="text-gray-500 text-xs py-2">No runs found. Trigger a run above to execute tests.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {runs.map(run => (
                    <Link
                      key={run.id}
                      to={`/runs/${run.id}`}
                      className="p-4 bg-darkBg hover:bg-darkBg/60 border border-darkBorder/60 hover:border-gray-700 rounded-xl transition-all flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-200">Run #{run.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          run.status === "COMPLETED" ? "bg-green-950/40 text-green-400 border border-green-900" : run.status === "RUNNING" ? "bg-yellow-950/40 text-yellow-400 border border-yellow-900 animate-pulse" : "bg-red-950/40 text-red-400 border border-red-900"
                        }`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-[10px] text-gray-500 font-mono mt-3">
                        <span>Branch: {run.branch || "main"}</span>
                        <span>Commit: {run.commit_sha ? run.commit_sha.substring(0, 7) : "manual"}</span>
                        <span>Time: {new Date(run.created_at).toLocaleTimeString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Run execution trigger Modal */}
            <TriggerRunModal
              isOpen={isTriggerModalOpen}
              onClose={() => setIsTriggerModalOpen(false)}
              projectId={projectId}
              suiteId={selectedSuite.id}
              defaultTargetUrl={selectedSuite.target_model_config.url}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 border border-darkBorder rounded-xl bg-darkCard/25 text-center p-6 text-gray-500">
            <Database className="h-10 w-10 text-gray-700 mb-2" />
            <p className="text-sm">Select a test suite from the sidebar to display configuration boundaries and pipeline runs.</p>
          </div>
        )}

        {/* Modal Forms */}
        {showSuiteModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-darkCard border border-darkBorder rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-gray-200">New Test Suite</h3>
              <form onSubmit={handleCreateSuite} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Suite Name"
                  value={suiteName}
                  onChange={e => setSuiteName(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 focus:outline-none"
                />
                <textarea
                  required
                  placeholder="System Prompt configured on target model"
                  value={suitePrompt}
                  onChange={e => setSuitePrompt(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 h-20 focus:outline-none"
                />
                <textarea
                  required
                  placeholder="Intents mapping (category: explanation per line)"
                  value={suiteIntents}
                  onChange={e => setSuiteIntents(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 h-24 font-mono focus:outline-none"
                />
                <textarea
                  required
                  placeholder="Target model config JSON"
                  value={suiteConfig}
                  onChange={e => setSuiteConfig(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 h-20 font-mono focus:outline-none"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowSuiteModal(false)} className="w-1/2 py-2 bg-darkBg border border-darkBorder rounded-lg text-xs font-bold text-gray-300">Cancel</button>
                  <button type="submit" className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white shadow">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCaseModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-darkCard border border-darkBorder rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-gray-200">New Custom Case</h3>
              <form onSubmit={handleCreateCase} className="space-y-3">
                <textarea
                  required
                  placeholder="Input Prompt text"
                  value={casePrompt}
                  onChange={e => setCasePrompt(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 h-20 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="Intent Category (must match an intent boundary key)"
                  value={caseCategory}
                  onChange={e => setCaseCategory(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Expected output text (Optional)"
                  value={caseExpected}
                  onChange={e => setCaseExpected(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 focus:outline-none"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCaseModal(false)} className="w-1/2 py-2 bg-darkBg border border-darkBorder rounded-lg text-xs font-bold text-gray-300">Cancel</button>
                  <button type="submit" className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white shadow">Add Case</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-darkBg text-gray-100 flex flex-col font-sans">
        
        {/* Consistent Top Header */}
        <header className="border-b border-darkBorder bg-darkCard/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-md">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Arbiter
              </h1>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Evaluation Guard</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {projects.length > 0 && (
              <div className="flex items-center gap-2 bg-darkBg border border-darkBorder px-3.5 py-1.5 rounded-lg text-xs">
                <span className="text-gray-500">Project:</span>
                <select
                  value={selectedProject?.id || ""}
                  onChange={e => {
                    const p = projects.find(proj => proj.id === Number(e.target.value));
                    if (p) setSelectedProject(p);
                  }}
                  className="bg-transparent text-gray-200 border-none outline-none font-bold cursor-pointer"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id} className="bg-darkCard">{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white rounded-lg transition-all"
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

        <footer className="border-t border-darkBorder bg-darkCard/20 py-4 text-center text-xs text-gray-600">
          ARBITER LLM Evaluator &copy; {new Date().getFullYear()} - Red-Teaming & Statistical Regression Control Portal.
        </footer>

        {/* Project Form Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-darkCard border border-darkBorder rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-gray-200">New Project Container</h3>
              <form onSubmit={handleCreateProject} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Project Name"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none"
                />
                <textarea
                  placeholder="Project Description Details"
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2.5 text-xs text-gray-200 h-24 focus:outline-none resize-none"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowProjectModal(false)} className="w-1/2 py-2 bg-darkBg border border-darkBorder rounded-lg text-xs font-bold text-gray-300">Cancel</button>
                  <button type="submit" className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white shadow">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </HashRouter>
  );
}
