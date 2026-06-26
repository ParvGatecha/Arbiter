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
        throw new Error(f"Failed to fetch statistical analysis: {res.statusText}");
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

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link 
          to={`/runs/${runId}`} 
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Run #{runId}
        </Link>
        <button 
          onClick={fetchComparison} 
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
        >
          <RefreshCw className="h-3 w-3" /> Re-calculate
        </button>
      </div>

      {/* Decision Banner */}
      <div>
        {report.outcome === "REGRESSION" && (
          <div className="flex items-start gap-4 p-5 bg-red-950/30 border border-red-900/60 rounded-2xl">
            <div className="p-3 bg-red-900/40 rounded-xl text-red-400">
              <TrendingDown className="h-6 w-6 animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-red-200 text-base">Warning: Statistically Significant Regression Detected</h3>
              <p className="text-gray-400 text-sm mt-1">
                The candidate run shows a statistically significant degradation in evaluation score ($p$-value = {report.p_value.toFixed(6)}). 
                The 95% confidence interval is entirely below zero.
              </p>
            </div>
          </div>
        )}
        {report.outcome === "IMPROVEMENT" && (
          <div className="flex items-start gap-4 p-5 bg-green-950/30 border border-green-900/60 rounded-2xl">
            <div className="p-3 bg-green-900/40 rounded-xl text-green-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-green-200 text-base">Success: Candidate shows statistically significant improvement</h3>
              <p className="text-gray-400 text-sm mt-1">
                The candidate run demonstrates a statistically significant improvement in evaluation performance ($p$-value = {report.p_value.toFixed(6)}).
                The 95% confidence interval is entirely above zero.
              </p>
            </div>
          </div>
        )}
        {report.outcome === "NO_CHANGE" && (
          <div className="flex items-start gap-4 p-5 bg-blue-950/20 border border-blue-900/30 rounded-2xl">
            <div className="p-3 bg-blue-900/30 rounded-xl text-blue-400">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-blue-200 text-base">No statistically significant difference detected between runs</h3>
              <p className="text-gray-400 text-sm mt-1">
                The difference in means between runs is either too small or the score distribution overlapping is too high. 
                There is insufficient statistical evidence to declare a regression or improvement ($p$-value = {report.p_value.toFixed(4)}).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Primary Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Baseline Mean */}
        <div className="bg-darkCard border border-darkBorder rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Baseline Mean</span>
          <span className="text-3xl font-black text-gray-100 mt-2">{report.baseline_mean.toFixed(4)}</span>
        </div>

        {/* Candidate Mean */}
        <div className="bg-darkCard border border-darkBorder rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Candidate Mean</span>
          <span className="text-3xl font-black text-gray-100 mt-2">{report.candidate_mean.toFixed(4)}</span>
        </div>

        {/* Mean Delta */}
        <div className="bg-darkCard border border-darkBorder rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mean Delta</span>
          <span className={`text-3xl font-black mt-2 ${
            report.mean_difference > 0 ? "text-green-400" : report.mean_difference < 0 ? "text-red-400" : "text-gray-400"
          }`}>
            {report.mean_difference > 0 ? "+" : ""}{report.mean_difference.toFixed(4)}
          </span>
        </div>

        {/* P-Value */}
        <div className="bg-darkCard border border-darkBorder rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mann-Whitney P-Value</span>
          <span className={`text-3xl font-black mt-2 ${isSig ? "text-red-400" : "text-green-400"}`}>
            {report.p_value.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Recharts Confidence Interval Visualizer */}
      <div className="bg-darkCard border border-darkBorder rounded-2xl p-6 space-y-4">
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
                stroke="#4b5563" 
                fontSize={11}
                tickFormatter={(val) => val.toFixed(2)}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#4b5563" 
                fontSize={11}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#121216", borderColor: "#1e1e24" }}
                formatter={(value: any) => [`Bounds: [${value[0].toFixed(4)}, ${value[1].toFixed(4)}]`, "CI Range"]}
              />
              {/* Vertical Reference Line at 0.0 */}
              <ReferenceLine x={0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: '0.0', fill: '#ef4444', fontSize: 10, position: 'top' }} />
              {/* Floating Range Bar */}
              <Bar 
                dataKey="range" 
                fill="#3b82f6" 
                radius={[4, 4, 4, 4]} 
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-darkBorder/40">
          <span>Lower Bound (2.5%): [bold]{report.ci_lower.toFixed(4)}[/bold]</span>
          <span>Mean Delta: [bold]{report.mean_difference.toFixed(4)}[/bold]</span>
          <span>Upper Bound (97.5%): [bold]{report.ci_upper.toFixed(4)}[/bold]</span>
        </div>
      </div>
    </div>
  );
}
