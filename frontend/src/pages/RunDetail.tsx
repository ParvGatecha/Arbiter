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
  TrendingDown,
  ChevronDown
} from "lucide-react";

const API_URL = "http://localhost:8000";

interface EvaluationResult {
  id: number;
  run_id: number;
  test_case_id: number;
  actual_output: string;
  score: number;
  rubric_scores?: Record<string, number>;
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
  provider?: string;
  model?: string;
  system_prompt?: string;
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
  const [isBaselineDropdownOpen, setIsBaselineDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

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
        const baselines = runsData.filter((r: any) => Number(r.suite_id) === Number(runData.suite_id) && r.status === "COMPLETED" && Number(r.id) !== Number(runData.id));
        setAllRuns(baselines);
        if (baselines.length > 0) {
          setBaselineId(baselines[0].id);
        }
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
      <div className="flex flex-col items-center justify-center h-96 space-y-4 animate-fade-in">
        <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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

  const totalCases = run.results.length;
  const avgScore = totalCases > 0 ? run.results.reduce((acc, curr) => acc + curr.score, 0) / totalCases : 0;
  const avgLatency = totalCases > 0 ? run.results.reduce((acc, curr) => acc + curr.latency_ms, 0) / totalCases : 0;
  const totalTokens = run.results.reduce((acc, curr) => acc + (curr.token_count || 0), 0);
  const totalCost = run.results.reduce((acc, curr) => acc + (curr.cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Info Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-2xl flex flex-wrap justify-between items-center gap-6 animate-fade-in relative z-30">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-100">Run #{run.id} Details</h1>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              run.status === "COMPLETED" ? "bg-green-500/10 text-green-400 border border-green-500/20 shadow-sm shadow-green-500/10" : "bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm shadow-red-500/10"
            }`}>
              {run.status}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 font-mono">
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-4 w-4 text-gray-600" />
              {run.branch || "main"}
            </span>
            <span className="flex items-center gap-1.5">
              <GitCommit className="h-4 w-4 text-gray-600" />
              {run.commit_sha ? run.commit_sha.substring(0, 7) : "manual-run"}
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-gray-600" />
              {run.target_url || "Ollama-Local"}
            </span>
            {run.model && (
              <span className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                Model: {run.model} ({run.provider || "openai"})
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-600" />
              Duration: {durationStr}
            </span>
          </div>
        </div>

        {/* Statistical comparison side panel */}
        <form onSubmit={handleCompareSubmit} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl shadow-inner">
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-0.5">Statistical Regression Check</label>
            <div className="relative mt-1">
              {allRuns.length > 0 ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsBaselineDropdownOpen(!isBaselineDropdownOpen)}
                    className="flex items-center justify-between gap-2.5 bg-[#090a0f]/90 border border-indigo-500/30 hover:border-indigo-500/50 hover:bg-[#0d0e17] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-200 transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-950/20 active:scale-[0.98] select-none min-w-[200px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <GitCommit className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">
                        {baselineId === ""
                          ? "Select Baseline Run..."
                          : `Run #${baselineId} (${allRuns.find((r: any) => r.id === baselineId)?.commit_sha?.substring(0, 7) || "manual"})`}
                      </span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${isBaselineDropdownOpen ? "rotate-180 text-indigo-400" : ""}`} />
                  </button>

                  {isBaselineDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[99]" 
                        onClick={() => setIsBaselineDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 bg-[#090a0f]/95 border border-indigo-500/20 rounded-2xl shadow-2xl backdrop-blur-2xl p-1.5 z-[100] animate-fade-in space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/[0.04] mb-1">
                          Select Baseline Run
                        </div>
                        {allRuns.map((r: any) => {
                          const isSelected = baselineId === r.id;
                          return (
                            <div
                              key={r.id}
                              onClick={() => {
                                setBaselineId(r.id);
                                setIsBaselineDropdownOpen(false);
                              }}
                              className={`px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 text-xs flex items-center justify-between border ${
                                isSelected
                                  ? "bg-indigo-600/15 text-indigo-300 border-indigo-500/30 font-bold"
                                  : "text-gray-300 border-transparent hover:bg-white/[0.04] hover:text-white"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-gray-200">
                                  Run #{r.id} <span className="text-[10px] text-gray-400 font-normal">({r.commit_sha ? r.commit_sha.substring(0, 7) : "manual"})</span>
                                </span>
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-mono">
                                  <GitBranch className="h-3 w-3 text-indigo-400/70" />
                                  {r.branch || "main"}
                                </span>
                              </div>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-500 italic px-1">No prior runs to compare</span>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={!baselineId || allRuns.length === 0}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-95 shadow shadow-indigo-500/10 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Verify Regression
          </button>
        </form>
      </div>

      {run.system_prompt && (
        <div className="glass-card rounded-2xl p-5 border border-white/[0.04] bg-[#0c0d12]/20 text-xs space-y-2 animate-fade-in shadow-xl relative z-20">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-mono">System Prompt for Run #{run.id}</span>
          <pre className="font-mono text-gray-300 whitespace-pre-wrap select-text leading-relaxed bg-[#06070a]/40 p-4 rounded-xl border border-white/[0.03]">
            {run.system_prompt}
          </pre>
        </div>
      )}

      {/* Visual Metrics Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in relative z-10">
        <div className="glass-card rounded-2xl p-5 hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Average Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              {avgScore.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500 font-medium">/ 1.0</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Avg Latency</span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mt-2">
            {avgLatency.toFixed(0)} <span className="text-sm font-medium text-gray-500">ms</span>
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Tokens</span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 mt-2">
            {totalTokens.toLocaleString()}
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Cost</span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400 mt-2">
            ${totalCost.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Filter and controls bar */}
      <div className="glass-card rounded-2xl p-4.5 flex flex-wrap justify-between items-center gap-4 animate-fade-in relative z-20">
        <div className="flex flex-wrap items-center gap-5">
          {/* Category Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="flex items-center gap-2.5 bg-[#090a0f]/90 border border-white/[0.08] hover:border-indigo-500/30 hover:bg-[#0d0e17] px-4 py-2 rounded-xl text-xs font-bold text-gray-200 shadow-lg cursor-pointer select-none active:scale-[0.98] transition-all"
            >
              <Filter className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Category:</span>
              <span className="font-bold text-indigo-300">{categoryFilter === "all" ? "All Intents" : categoryFilter}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isCategoryDropdownOpen ? "rotate-180 text-indigo-400" : ""}`} />
            </button>

            {isCategoryDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[99]" 
                  onClick={() => setIsCategoryDropdownOpen(false)}
                />
                
                <div className="absolute left-0 mt-2 w-56 bg-[#090a0f]/95 border border-indigo-500/20 rounded-2xl shadow-2xl backdrop-blur-2xl p-2 z-[100] animate-fade-in space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/[0.04] mb-1">
                    Filter Intent Categories
                  </div>
                  <div
                    onClick={() => {
                      setCategoryFilter("all");
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 text-xs font-semibold flex items-center justify-between border ${
                      categoryFilter === "all" 
                        ? "bg-indigo-600/15 text-indigo-300 border-indigo-500/30 font-bold" 
                        : "text-gray-300 border-transparent hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span>All Intents</span>
                    {categoryFilter === "all" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    )}
                  </div>
                  {categories.map(cat => (
                    <div
                      key={cat}
                      onClick={() => {
                        setCategoryFilter(cat);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 text-xs font-semibold flex items-center justify-between border ${
                        categoryFilter === cat 
                          ? "bg-indigo-600/15 text-indigo-300 border-indigo-500/30 font-bold" 
                          : "text-gray-300 border-transparent hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>{cat}</span>
                      {categoryFilter === cat && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Adversarial Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
            <input
              type="checkbox"
              checked={onlyAdversarial}
              onChange={e => setOnlyAdversarial(e.target.checked)}
              className="rounded bg-white/[0.02] border-white/[0.08] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            Only Adversarial Variations
          </label>

          {/* Violations Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
            <input
              type="checkbox"
              checked={onlyViolations}
              onChange={e => setOnlyViolations(e.target.checked)}
              className="rounded bg-white/[0.02] border-white/[0.08] text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            Only Low Scores/Violations
          </label>
        </div>

        <span className="text-xs text-gray-500 font-mono">
          Showing {filteredResults.length} / {run.results.length} cases
        </span>
      </div>

      {/* Table Results */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.01] text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                <th className="py-4 px-6 w-16">ID</th>
                <th className="py-4 px-6">Prompt / Output</th>
                <th className="py-4 px-6 w-32">Intent Category</th>
                <th className="py-4 px-6 w-24 text-center">Score</th>
                <th className="py-4 px-6 w-28 text-center">Safety</th>
                <th className="py-4 px-6 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
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
                      <tr className="hover:bg-white/[0.02] transition-colors duration-200 text-sm">
                        <td className="py-4 px-6 font-mono text-gray-500">#{index + 1}</td>
                        <td className="py-4 px-6 max-w-md">
                          <div className="space-y-1">
                            <p className="font-mono text-gray-200 line-clamp-2">{res.input_prompt}</p>
                            <p className="text-xs text-gray-500 italic mt-1 line-clamp-1">Output: {res.actual_output}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[9px] bg-white/[0.02] border border-white/[0.06] px-2.5 py-1 rounded-lg text-gray-400 font-semibold uppercase tracking-widest">
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
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-red-500/5">
                              <AlertTriangle className="h-3 w-3" />
                              Leak
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-green-500/5">
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
                        <tr className="bg-white/[0.01] border-t border-white/[0.03]">
                          <td colSpan={6} className="py-4 px-8 text-xs space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Prompts/outputs */}
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Input Prompt</span>
                                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl font-mono text-gray-300 leading-relaxed max-h-40 overflow-y-auto mt-1 break-all shadow-inner">
                                    {res.input_prompt}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Model Response Output</span>
                                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl font-mono text-gray-300 leading-relaxed max-h-40 overflow-y-auto mt-1 break-all shadow-inner">
                                    {res.actual_output}
                                  </div>
                                </div>
                              </div>

                              {/* Justification / rationale */}
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Judge Rationale & Critique</span>
                                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-gray-300 leading-relaxed mt-1.5 italic shadow-inner">
                                    {res.rationale}
                                  </div>
                                </div>

                                {/* Decomposed Rubric Badges */}
                                {res.rubric_scores && Object.keys(res.rubric_scores).length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Rubric Breakdown</span>
                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                      {Object.entries(res.rubric_scores).map(([rubricKey, rubricVal]) => (
                                        <span 
                                          key={rubricKey} 
                                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1.5 ${
                                            rubricVal >= 0.9 
                                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                              : rubricVal >= 0.7
                                                ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                                                : "bg-red-500/10 border-red-500/20 text-red-300"
                                          }`}
                                        >
                                          <span className="capitalize">{rubricKey.replace(/_/g, " ")}:</span>
                                          <span className="font-bold">{rubricVal.toFixed(2)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

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
