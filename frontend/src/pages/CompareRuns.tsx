import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  HelpCircle, 
  CheckCircle2, 
  AlertOctagon, 
  BarChart4,
  RefreshCw
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  ReferenceLine, 
  Tooltip 
} from "recharts";

const API_URL = "http://localhost:8000";

interface StatisticalReport {
  baseline_mean: number;
  candidate_mean: number;
  mean_difference: number;
  p_value: number;
  ci_lower: number;
  ci_upper: number;
  outcome: "REGRESSION" | "IMPROVEMENT" | "NO_CHANGE";
  is_significant: boolean;
  test_method?: string;
  cliffs_delta?: number;
  effect_size_magnitude?: "NEGLIGIBLE" | "SMALL" | "MEDIUM" | "LARGE";
  cohens_d?: number;
  sample_size?: number;
  sample_size_warning?: boolean;
}

export default function CompareRuns() {
  const { runId, baselineId } = useParams<{ runId: string; baselineId: string }>();
  const [report, setReport] = useState<StatisticalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchComparison = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/runs/${runId}/compare/${baselineId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch statistical analysis: ${res.statusText}`);
      }
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while running regression checks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (runId && baselineId) {
      fetchComparison();
    }
  }, [runId, baselineId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <RefreshCw className="h-10 w-10 text-blue-500 animate-spin" />
        <p className="text-gray-400 text-sm">Calculating bootstrap intervals and hypothesis tests...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900 rounded-xl space-y-4">
        <div className="flex items-center gap-3 text-red-400">
          <AlertOctagon className="h-6 w-6" />
          <h3 className="font-bold">Regression Check Failed</h3>
        </div>
        <p className="text-gray-300 text-sm">{error || "Failed to load statistical report."}</p>
        <button 
          onClick={fetchComparison} 
          className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-semibold rounded-lg"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  // Check if p-value is significant (< 0.05)
  const isSig = report.p_value < 0.05;

  // Data for the horizontal range bar representing 95% Confidence Interval
  const chartData = [
    {
      name: "95% Bootstrap CI",
      range: [report.ci_lower, report.ci_upper],
      delta: report.mean_difference
    }
  ];

  // Dynamic axis domains to prevent bar clipping
  const axisMin = Math.min(-0.1, report.ci_lower - 0.05);
  const axisMax = Math.max(0.1, report.ci_upper + 0.05);

  const testLabel = report.test_method === "WILCOXON_SIGNED_RANK" 
    ? "Wilcoxon Signed-Rank (Paired)" 
    : report.test_method === "MANN_WHITNEY_U" 
      ? "Mann-Whitney U (Unpaired)" 
      : "Hypothesis Test";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link 
          to={`/runs/${runId}`} 
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Run #{runId}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono">
            {testLabel}
          </span>
          <button 
            onClick={fetchComparison} 
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors duration-200"
          >
            <RefreshCw className="h-3 w-3" /> Re-calculate
          </button>
        </div>
      </div>

      {/* Decision Banner */}
      <div>
        {report.outcome === "REGRESSION" && (
          <div className="flex items-start gap-5 p-6 bg-red-500/10 border border-red-500/25 rounded-2xl shadow-xl shadow-red-500/5 glow-border">
            <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
              <TrendingDown className="h-6 w-6 animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-red-100 text-lg tracking-tight">Warning: Statistically Significant Regression Detected</h3>
              <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">
                The candidate run shows a statistically significant degradation in evaluation score ($p$-value = {report.p_value.toFixed(6)}, Effect Size = {report.cliffs_delta !== undefined ? report.cliffs_delta.toFixed(3) : "N/A"}). 
                The 95% confidence interval is entirely below zero.
              </p>
            </div>
          </div>
        )}
        {report.outcome === "IMPROVEMENT" && (
          <div className="flex items-start gap-5 p-6 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl shadow-xl shadow-emerald-500/5 glow-border">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 animate-pulse-glow">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-emerald-100 text-lg tracking-tight">Success: Candidate shows statistically significant improvement</h3>
              <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">
                The candidate run demonstrates a statistically significant improvement in evaluation performance ($p$-value = {report.p_value.toFixed(6)}, Effect Size = {report.cliffs_delta !== undefined ? report.cliffs_delta.toFixed(3) : "N/A"}).
                The 95% confidence interval is entirely above zero.
              </p>
            </div>
          </div>
        )}
        {report.outcome === "NO_CHANGE" && (
          <div className="flex items-start gap-5 p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl shadow-xl shadow-blue-500/5 glow-border">
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-blue-100 text-lg tracking-tight">No statistically significant difference detected between runs</h3>
              <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">
                The difference in means between runs is either too small or the score distributions are too overlapping. 
                There is insufficient statistical evidence to declare a regression or improvement ($p$-value = {report.p_value.toFixed(4)}).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Primary Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Baseline Mean */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Baseline Mean</span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400 mt-2">{report.baseline_mean.toFixed(4)}</span>
        </div>

        {/* Candidate Mean */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Candidate Mean</span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400 mt-2">{report.candidate_mean.toFixed(4)}</span>
        </div>

        {/* Mean Delta */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mean Delta</span>
          <span className={`text-3xl font-black mt-2 bg-clip-text text-transparent ${
            report.mean_difference > 0 ? "bg-gradient-to-r from-emerald-400 to-teal-400" : report.mean_difference < 0 ? "bg-gradient-to-r from-red-400 to-pink-500" : "bg-gradient-to-r from-gray-400 to-gray-550"
          }`}>
            {report.mean_difference > 0 ? "+" : ""}{report.mean_difference.toFixed(4)}
          </span>
        </div>

        {/* P-Value */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">P-Value ({report.test_method === "WILCOXON_SIGNED_RANK" ? "Paired" : "Unpaired"})</span>
          <span className={`text-3xl font-black mt-2 bg-clip-text text-transparent ${isSig ? "bg-gradient-to-r from-red-400 to-pink-500" : "bg-gradient-to-r from-emerald-400 to-teal-400"}`}>
            {report.p_value.toFixed(6)}
          </span>
        </div>

        {/* Cliff's Delta Effect Size */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Effect Size (Cliff's d)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">
              {report.cliffs_delta !== undefined ? (report.cliffs_delta > 0 ? `+${report.cliffs_delta.toFixed(2)}` : report.cliffs_delta.toFixed(2)) : "0.00"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-semibold uppercase">
              {report.effect_size_magnitude || "NEGLIGIBLE"}
            </span>
          </div>
        </div>
      </div>


      {/* Recharts Confidence Interval Visualizer */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h4 className="text-sm font-bold text-gray-300 tracking-wide uppercase flex items-center gap-2">
          <BarChart4 className="h-4.5 w-4.5 text-blue-500" />
          95% Bootstrap Confidence Interval Range
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          The chart below plots the bounds of the bootstrap differences in means. If the floating range bar crosses the vertical dashed zero reference line, the evaluation difference is statistically inconclusive.
        </p>

        <div className="h-48 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <XAxis 
                type="number" 
                domain={[axisMin, axisMax]} 
                stroke="#6b7280" 
                fontSize={11}
                tickFormatter={(val) => val.toFixed(2)}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#6b7280" 
                fontSize={11}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0b0c13", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: "12px", fontSize: "11px", color: "#f3f4f6" }}
                formatter={(value: any) => [`Bounds: [${value[0].toFixed(4)}, ${value[1].toFixed(4)}]`, "CI Range"]}
              />
              {/* Vertical Reference Line at 0.0 */}
              <ReferenceLine x={0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: '0.0', fill: '#ef4444', fontSize: 10, position: 'top' }} />
              {/* Floating Range Bar */}
              <Bar 
                dataKey="range" 
                fill="#3b82f6" 
                radius={[6, 6, 6, 6]} 
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-white/[0.04]">
          <span>Lower Bound (2.5%): <strong className="text-gray-300 font-bold">{report.ci_lower.toFixed(4)}</strong></span>
          <span>Mean Delta: <strong className="text-gray-300 font-bold">{report.mean_difference.toFixed(4)}</strong></span>
          <span>Upper Bound (97.5%): <strong className="text-gray-300 font-bold">{report.ci_upper.toFixed(4)}</strong></span>
        </div>
      </div>
    </div>
  );
}
