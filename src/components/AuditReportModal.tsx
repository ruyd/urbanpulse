import React, { useState } from 'react';
import { MetroPreset, NetworkSimulationState, ScenarioConfig } from '../types/traffic';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';

interface AuditReportModalProps {
  metro: MetroPreset;
  scenario: ScenarioConfig;
  simulationState: NetworkSimulationState;
  onClose: () => void;
}

interface AuditReport {
  reportTitle: string;
  executiveSummary: string;
  infrastructureVulnerabilityRating: string;
  sensorNetworkHealthNote: string;
  priorityRecommendations: Array<{
    rank: number;
    corridor: string;
    action: string;
    urgency: string;
    estimatedCapEx: string;
  }>;
  longRangeOutlook: string;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({
  metro,
  scenario,
  simulationState,
  onClose,
}) => {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/generate-audit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkName: metro.name,
          year: scenario.year,
          totalVmt: simulationState.totalVMT.toLocaleString(),
          averageLos: Object.entries(simulationState.losCounts)
            .map(([los, count]) => `${los}: ${count} links`)
            .join(', '),
          topBottlenecks: simulationState.topBottlenecks.map((b) => ({
            name: b.road.name,
            vcRatio: b.vcRatio.toFixed(2),
            speedMph: b.speedMph,
            delayHours: b.delayHours,
          })),
          activeProjects: metro.defaultInterventions
            .filter((i) => i.enabled)
            .map((i) => i.name),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setReport(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audit generation failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Trigger report on mount if not yet generated
  React.useEffect(() => {
    generateReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Civil Infrastructure & Sensor Telemetry Audit
              </h2>
              <p className="text-xs text-slate-400">
                {metro.name} • Horizon Year {scenario.year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Report</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-bold text-slate-200">
                Synthesizing MPO Transportation Master Audit...
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Aggregating sensor counts, BPR delay functions, and multi-year federal funding eligibility.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          {report && (
            <div className="space-y-6 text-slate-300">
              {/* Report Header Banner */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{report.reportTitle}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Evaluated under scenario:{' '}
                    <span className="text-cyan-400 font-semibold font-mono">
                      {scenario.growthPreset.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Vulnerability Index
                  </div>
                  <span
                    className={`inline-block px-2.5 py-1 mt-1 rounded font-mono font-bold text-xs ${
                      report.infrastructureVulnerabilityRating === 'Critical'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                        : report.infrastructureVulnerabilityRating === 'Severe'
                        ? 'bg-orange-950 text-orange-300 border border-orange-500/50'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                    }`}
                  >
                    {report.infrastructureVulnerabilityRating.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Executive Summary
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  {report.executiveSummary}
                </p>
              </div>

              {/* Sensor Health Note */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sensor Network & Calibration Integrity
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  {report.sensorNetworkHealthNote}
                </p>
              </div>

              {/* Prioritized Recommendations */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Prioritized Capital Improvement Program (CIP)
                </h4>
                <div className="space-y-2">
                  {report.priorityRecommendations.map((rec) => (
                    <div
                      key={rec.rank}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {rec.rank}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{rec.corridor}</span>
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {rec.estimatedCapEx}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{rec.action}</p>
                        <div className="text-[10px] text-amber-400 font-mono mt-1">
                          Urgency: {rec.urgency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Long Range Outlook */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Long-Range Outlook (2035+)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  {report.longRangeOutlook}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
