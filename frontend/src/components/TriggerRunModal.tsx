import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Play, RotateCw, AlertTriangle, Cpu, ChevronDown, CheckCircle2 } from "lucide-react";

const API_URL = "http://localhost:8000";

interface TriggerRunModalProps {
  suiteId: number;
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  defaultTargetUrl?: string;
  defaultSystemPrompt?: string;
}

export default function TriggerRunModal({
  suiteId,
  projectId,
  isOpen,
  onClose,
  defaultTargetUrl = "http://localhost:8000/health",
  defaultSystemPrompt = ""
}: TriggerRunModalProps) {
  const navigate = useNavigate();

  // Form Fields
  const [targetUrl, setTargetUrl] = useState(defaultTargetUrl);
  const [commitSha, setCommitSha] = useState("");
  const [branch, setBranch] = useState("main");
  const [provider, setProvider] = useState("");
  const [modelName, setModelName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt || "");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  // State Management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<string>("PENDING");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Reset state on open
    if (isOpen) {
      setCommitSha("manual-" + Math.floor(Math.random() * 10000));
      setRunId(null);
      setRunStatus("PENDING");
      setErrorMsg("");
      setIsSubmitting(false);
      setProvider("");
      setModelName("");
      setSystemPrompt(defaultSystemPrompt || "");
      setIsProviderDropdownOpen(false);
    }
  }, [isOpen, defaultSystemPrompt]);

  // Polling implementation when runId is set
  useEffect(() => {
    if (runId === null) return;

    let timer: any;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/runs/${runId}`);
        if (res.ok) {
          const data = await res.json();
          setRunStatus(data.status);
          
          if (data.status === "COMPLETED") {
            clearInterval(timer);
            onClose();
            // Automatically redirect to the run details page
            navigate(`/runs/${runId}`);
          } else if (data.status === "FAILED") {
            clearInterval(timer);
            setErrorMsg("Evaluation execution failed on the Celery worker task.");
            setIsSubmitting(false);
          }
        }
      } catch (err) {
        console.error("Polling status failed", err);
      }
    };

    // Poll every 3 seconds
    timer = setInterval(checkStatus, 3000);
    return () => clearInterval(timer);
  }, [runId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    const payload = {
      project_id: projectId,
      suite_id: suiteId,
      target_url: targetUrl,
      commit_sha: commitSha,
      branch: branch,
      provider: provider || null,
      model: modelName || null,
      system_prompt: systemPrompt || null
    };

    try {
      const res = await fetch(`${API_URL}/api/runs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(await res.text() || "Failed to trigger run.");
      }

      const data = await res.json();
      setRunId(data.id);
      setRunStatus(data.status);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while launching evaluation run.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-center items-center p-4">
      <div className="glass-card rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 relative overflow-hidden animate-fade-in">
        
        {/* Progress Loading Overlay when polling */}
        {runId !== null && (
          <div className="absolute inset-0 bg-[#090a0f]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-4 z-10 animate-fade-in">
            <RotateCw className="h-10 w-10 text-indigo-500 animate-spin" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-gray-200">Executing Evaluation Run #{runId}</h4>
              <p className="text-xs text-gray-400">Current Queue State: <span className="font-bold text-indigo-400 uppercase">{runStatus}</span></p>
            </div>
            <p className="text-[11px] text-gray-500 max-w-xs text-center leading-relaxed">
              The worker is currently dispatching HTTP request batches to the target and running statistical evaluation checks via LLM-as-a-Judge.
            </p>
            {errorMsg && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 max-w-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {errorMsg && (
              <button 
                onClick={onClose} 
                className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs font-semibold text-gray-300 transition-colors"
              >
                Close Portal
              </button>
            )}
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-gray-100 tracking-wide flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-500 animate-pulse" />
            Trigger Evaluation Run
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Endpoint */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Endpoint URL</label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              placeholder="e.g. http://localhost:8000/health"
              className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Branch */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Branch Name</label>
              <input
                type="text"
                required
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="e.g. main"
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
              />
            </div>
            
            {/* Commit SHA */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Commit SHA</label>
              <input
                type="text"
                required
                value={commitSha}
                onChange={e => setCommitSha(e.target.value)}
                placeholder="e.g. manual-101"
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Target Provider Override */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Provider Override</label>
              <button
                type="button"
                onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                className="w-full text-left flex items-center justify-between bg-[#090a0f]/90 border border-indigo-500/30 hover:border-indigo-500/50 hover:bg-[#0d0e17] px-4 py-2.5 rounded-xl text-xs font-bold text-gray-200 focus:outline-none cursor-pointer select-none active:scale-[0.98] transition-all shadow-lg shadow-indigo-950/20"
              >
                <span className="font-bold text-indigo-300">
                  {provider === "" && "Suite Default"}
                  {provider === "openai" && "OpenAI"}
                  {provider === "anthropic" && "Anthropic (Claude)"}
                  {provider === "ollama" && "Ollama (Local)"}
                  {provider === "sglang" && "SGLang (Local)"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isProviderDropdownOpen ? "rotate-180 text-indigo-400" : ""}`} />
              </button>

              {isProviderDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[110]" 
                    onClick={() => setIsProviderDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-full bg-[#090a0f]/95 border border-indigo-500/20 rounded-2xl shadow-2xl backdrop-blur-2xl p-2 z-[120] animate-fade-in space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/[0.04] mb-1">
                      Select Target Provider
                    </div>
                    {[
                      { val: "", label: "Suite Default" },
                      { val: "openai", label: "OpenAI" },
                      { val: "anthropic", label: "Anthropic (Claude)" },
                      { val: "ollama", label: "Ollama (Local)" },
                      { val: "sglang", label: "SGLang (Local)" }
                    ].map(opt => {
                      const isSelected = provider === opt.val;
                      return (
                        <div
                          key={opt.val}
                          onClick={() => {
                            setProvider(opt.val);
                            setIsProviderDropdownOpen(false);
                          }}
                          className={`px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 text-xs font-semibold flex items-center justify-between border ${
                            isSelected
                              ? "bg-indigo-600/15 text-indigo-300 border-indigo-500/30 font-bold" 
                              : "text-gray-300 border-transparent hover:text-white hover:bg-white/[0.04]"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            
            {/* Target Model Override */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Model Override</label>
              <input
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                placeholder="e.g. gpt-4o-mini"
                className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none"
              />
            </div>
          </div>

          {/* System Prompt Override */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Prompt Override</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Override baseline system prompt..."
              className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 h-20 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:from-[#141620] disabled:to-[#141620] disabled:text-gray-600 rounded-xl text-sm font-bold text-white shadow-lg shadow-indigo-500/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <RotateCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-white text-white" />
            )}
            Launch Task Pipeline
          </button>
        </form>
      </div>
    </div>
  );
}
