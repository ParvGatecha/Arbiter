import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Play, RotateCw, AlertTriangle, Cpu } from "lucide-react";

const API_URL = "http://localhost:8000";

interface TriggerRunModalProps {
  suiteId: number;
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  defaultTargetUrl?: string;
}

export default function TriggerRunModal({
  suiteId,
  projectId,
  isOpen,
  onClose,
  defaultTargetUrl = "http://localhost:8000/health"
}: TriggerRunModalProps) {
  const navigate = useNavigate();

  // Form Fields
  const [targetUrl, setTargetUrl] = useState(defaultTargetUrl);
  const [commitSha, setCommitSha] = useState("");
  const [branch, setBranch] = useState("main");

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
    }
  }, [isOpen]);

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
      branch: branch
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-darkCard border border-darkBorder rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Progress Loading Overlay when polling */}
        {runId !== null && (
          <div className="absolute inset-0 bg-darkCard/95 flex flex-col items-center justify-center p-6 space-y-4 z-10">
            <RotateCw className="h-10 w-10 text-blue-500 animate-spin" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-gray-200">Executing Evaluation Run #{runId}</h4>
              <p className="text-xs text-gray-400">Current Queue State: <span className="font-bold text-blue-400 uppercase">{runStatus}</span></p>
            </div>
            <p className="text-[11px] text-gray-500 max-w-xs text-center">
              The worker is currently dispatching HTTP request batches to the target and running statistical evaluation checks via LLM-as-a-Judge.
            </p>
            {errorMsg && (
              <div className="p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs flex items-center gap-2 max-w-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {errorMsg && (
              <button 
                onClick={onClose} 
                className="px-4 py-2 bg-darkBg hover:bg-darkBorder border border-darkBorder rounded-lg text-xs font-semibold text-gray-300 transition-colors"
              >
                Close Portal
              </button>
            )}
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-gray-100 tracking-wide flex items-center gap-2">
            <Cpu className="h-5 w-5 text-blue-500" />
            Trigger Evaluation Run
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Endpoint */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Target Endpoint URL</label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              placeholder="e.g. http://localhost:8000/health"
              className="w-full bg-darkBg border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Branch */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Branch Name</label>
              <input
                type="text"
                required
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="e.g. main"
                className="w-full bg-darkBg border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            {/* Commit SHA */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Commit SHA</label>
              <input
                type="text"
                required
                value={commitSha}
                onChange={e => setCommitSha(e.target.value)}
                placeholder="e.g. manual-101"
                className="w-full bg-darkBg border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <RotateCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            Launch Task Pipeline
          </button>
        </form>
      </div>
    </div>
  );
}
