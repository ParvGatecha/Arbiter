import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  GitBranch, 
  GitCommit, 
  Globe, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronsUpDown, 
  Filter, 
  FileJson,
  TrendingDown
} from "lucide-react";

const API_URL = "http://localhost:8000";

interface EvaluationResult {
  id: number;
  run_id: number;
  test_case_id: number;
  actual_output: string;
  score: number;
  rationale: string;
  latency_ms: number;
  token_count: number;
  cost: number;
  // Merged test case details
  input_prompt?: string;
  intent_category?: string;
  adversarial_flag?: boolean;
}

interface EvaluationRun {
  id: number;
  suite_id: number;
  status: string;
  commit_sha?: string;
  branch?: string;
  target_url?: string;
  created_at: string;
  completed_at?: string;
  results: EvaluationResult[];
}

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [allRuns, setAllRuns] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [onlyAdversarial, setOnlyAdversarial] = useState(false);
  const [onlyViolations, setOnlyViolations] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Selected baseline for comparison redirect
  const [baselineId, setBaselineId] = useState<number | "">("");

  // Collapsed row tracking
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const toggleRow = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Run details
      const runRes = await fetch(`${API_URL}/api/runs/${runId}`);
      if (!runRes.ok) throw new Error("Evaluation run not found.");
      const runData = await runRes.json();
      
      // 2. Fetch associated test cases to resolve prompt details & categories
      const casesRes = await fetch(`${API_URL}/api/suites/${runData.suite_id}/cases`);
      let suiteCases: any[] = [];
      if (casesRes.ok) {
        suiteCases = await casesRes.json();
        setTestCases(suiteCases);
      }

      // Merge prompt details into results
      const mergedResults = runData.results.map((res: EvaluationResult) => {
        const matchingCase = suiteCases.find(c => c.id === res.test_case_id);
        return {
          ...res,
          input_prompt: matchingCase ? matchingCase.input_prompt : "Unknown prompt",
          intent_category: matchingCase ? matchingCase.intent_category : "default",
          adversarial_flag: matchingCase ? matchingCase.adversarial_flag : false
        };
      });

      setRun({ ...runData, results: mergedResults });

      // 3. Fetch all completed runs of the same suite to populate baseline options
      const runsRes = await fetch(`${API_URL}/api/runs/`);
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setAllRuns(runsData.filter((r: any) => r.suite_id === runData.suite_id && r.status === "COMPLETED" && r.id !== runData.id));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load run details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (runId) {
      fetchData();
    }
  }, [runId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm">Loading run execution telemetry...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900 rounded-xl space-y-4 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold text-gray-200">Load Error</h3>
        <p className="text-gray-400 text-sm">{error || "Failed to retrieve run details."}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs">
          Retry
        </button>
      </div>
    );
  }

  // Categories list for dropdown filter
  const categories = Array.from(new Set(run.results.map(r => r.intent_category).filter(Boolean))) as string[];

  // Apply filters
  const filteredResults = run.results.filter(res => {
    if (onlyAdversarial && !res.adversarial_flag) return false;
    // We treat scores < 0.7 or score == 0.0 as violation
    if (onlyViolations && res.score >= 0.7) return false;
    if (categoryFilter !== "all" && res.intent_category !== categoryFilter) return false;
    return true;
  });

  // Calculate Duration
  let durationStr = "N/A";
  if (run.created_at && run.completed_at) {
    const durSec = (new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000;
    durationStr = durSec.toFixed(1) + "s";
  }

  const handleCompareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (baselineId) {
      navigate(`/runs/${run.id}/compare/${baselineId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Panel */}
      <div className="bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl flex flex-wrap justify-between items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-100">Run #{run.id} Details</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              run.status === "COMPLETED" ? "bg-green-950/50 text-green-400 border border-green-900" : "bg-red-950/50 text-red-400 border border-red-900"
            }`}>
              {run.status}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 font-mono">
            <span className="flex items-center gap-1">
              <GitBranch className="h-4 w-4 text-gray-600" />
              {run.branch || "main"}
            </span>
            <span className="flex items-center gap-1">
              <GitCommit className="h-4 w-4 text-gray-600" />
              {run.commit_sha ? run.commit_sha.substring(0, 7) : "manual-run"}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4 text-gray-600" />
              {run.target_url || "Ollama-Local"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-600" />
              Duration: {durationStr}
            </span>
          </div>
        </div>

        {/* Statistical comparison side panel */}
        {allRuns.length > 0 && (
          <form onSubmit={handleCompareSubmit} className="flex items-center gap-3 bg-darkBg border border-darkBorder p-2 rounded-xl">
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">Statistical Regression Check</label>
              <select
                value={baselineId}
                onChange={e => setBaselineId(e.target.value ? Number(e.target.value) : "")}
                className="bg-transparent text-xs text-gray-200 border-none outline-none cursor-pointer pr-4 font-semibold mt-1"
              >
                <option value="" className="bg-darkCard">Select Baseline Run</option>
                {allRuns.map(r => (
                  <option key={r.id} value={r.id} className="bg-darkCard">
                    Run #{r.id} ({r.commit_sha?.substring(0, 7) || "manual"})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!baselineId}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Verify Regression
            </button>
          </form>
        )}
      </div>

      {/* Filter and controls bar */}
      <div className="bg-darkCard border border-darkBorder rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-5">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2 bg-darkBg border border-darkBorder px-3 py-1.5 rounded-lg text-xs">
            <Filter className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-gray-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none outline-none font-semibold text-gray-200 cursor-pointer"
            >
              <option value="all" className="bg-darkCard">All Intents</option>
              {categories.map(cat => (
                <option key={cat} value={cat} className="bg-darkCard">{cat}</option>
              ))}
            </select>
          </div>

          {/* Adversarial Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
            <input
              type="checkbox"
              checked={onlyAdversarial}
              onChange={e => setOnlyAdversarial(e.target.checked)}
              className="rounded bg-darkBg border-darkBorder text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            Only Adversarial Variations
          </label>

          {/* Violations Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
            <input
              type="checkbox"
              checked={onlyViolations}
              onChange={e => setOnlyViolations(e.target.checked)}
              className="rounded bg-darkBg border-darkBorder text-red-600 focus:ring-0 focus:ring-offset-0"
            />
            Only Low Scores/Violations
          </label>
        </div>

        <span className="text-xs text-gray-500 font-mono">
          Showing {filteredResults.length} / {run.results.length} cases
        </span>
      </div>

      {/* Table Results */}
      <div className="bg-darkCard border border-darkBorder rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-darkBorder bg-darkBg/50 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-4 px-6 w-16">ID</th>
                <th className="py-4 px-6">Prompt / Output</th>
                <th className="py-4 px-6 w-32">Intent Category</th>
                <th className="py-4 px-6 w-24 text-center">Score</th>
                <th className="py-4 px-6 w-28 text-center">Safety</th>
                <th className="py-4 px-6 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkBorder/60">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500 text-sm">
                    No results match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredResults.map((res, index) => {
                  const isExpanded = !!expandedRows[res.id];
                  const hasViolation = res.score < 0.7; // score threshold

                  return (
                    <React.Fragment key={res.id}>
                      <tr className="hover:bg-darkBg/20 transition-colors text-sm">
                        <td className="py-4 px-6 font-mono text-gray-500">#{index + 1}</td>
                        <td className="py-4 px-6 max-w-md">
                          <div className="space-y-1">
                            <p className="font-mono text-gray-200 line-clamp-2">{res.input_prompt}</p>
                            <p className="text-xs text-gray-500 italic mt-1 line-clamp-1">Output: {res.actual_output}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[10px] bg-darkBg border border-darkBorder px-2.5 py-1 rounded text-gray-400 uppercase tracking-wide">
                            {res.intent_category}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center font-bold">
                          <span className={res.score >= 0.9 ? "text-green-400" : res.score >= 0.7 ? "text-yellow-400" : "text-red-400"}>
                            {res.score.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {hasViolation ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-950 px-2 py-0.5 rounded uppercase">
                              <AlertTriangle className="h-3 w-3" />
                              Leak
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-950/30 border border-green-950 px-2 py-0.5 rounded uppercase">
                              <CheckCircle2 className="h-3 w-3" />
                              Safe
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => toggleRow(res.id)}
                            className="p-1 text-gray-500 hover:text-gray-300 rounded"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded View: Rationale & JSON inspection */}
                      {isExpanded && (
                        <tr className="bg-darkBg/40 border-t border-darkBorder/40">
                          <td colSpan={6} className="py-4 px-8 text-xs space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Prompts/outputs */}
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Input Prompt</span>
                                  <div className="p-3 bg-darkBg border border-darkBorder rounded-lg font-mono text-gray-300 leading-relaxed max-h-40 overflow-y-auto mt-1 break-all">
                                    {res.input_prompt}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Model Response Output</span>
                                  <div className="p-3 bg-darkBg border border-darkBorder rounded-lg font-mono text-gray-300 leading-relaxed max-h-40 overflow-y-auto mt-1 break-all">
                                    {res.actual_output}
                                  </div>
                                </div>
                              </div>

                              {/* Justification / rationale */}
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Judge Rationale & Critique</span>
                                  <div className="p-3 bg-darkBg border border-darkBorder/80 rounded-lg text-gray-300 leading-relaxed mt-1 italic">
                                    {res.rationale}
                                  </div>
                                </div>
                                <div className="flex justify-between text-gray-500 font-mono text-[10px]">
                                  <span>Latency: {res.latency_ms.toFixed(0)} ms</span>
                                  <span>Tokens: {res.token_count}</span>
                                  <span>Cost: ${res.cost.toFixed(5)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
