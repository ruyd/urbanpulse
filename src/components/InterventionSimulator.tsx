import React, { useState } from 'react';
import {
  Intervention,
  InterventionType,
  MetroPreset,
  NetworkSimulationState,
} from '../types/traffic';
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Fuel,
  Hammer,
  Layers,
  Leaf,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

interface InterventionSimulatorProps {
  metro: MetroPreset;
  interventions: Intervention[];
  onToggleIntervention: (id: string) => void;
  onAddIntervention: (intervention: Intervention) => void;
  baselineState: NetworkSimulationState;
  currentState: NetworkSimulationState;
  onClose?: () => void;
}

interface AiProjectAssessment {
  projectTitle: string;
  feasibilityScore: number;
  benefitCostRatio: number;
  projectedLosShift: string;
  dailyHoursSaved: number;
  annualCo2ReductionTons: number;
  constructionDisruptionSeverity: string;
  constructionDurationMonths: number;
  keyPhasingSteps: string[];
  downstreamNetworkEffects: string;
  fundingProgramsEligible: string[];
}

export const InterventionSimulator: React.FC<InterventionSimulatorProps> = ({
  metro,
  interventions,
  onToggleIntervention,
  onAddIntervention,
  baselineState,
  currentState,
  onClose,
}) => {
  const [selectedCorridorForAi, setSelectedCorridorForAi] = useState<string>(
    metro.roads[0]?.id || ''
  );
  const [candidateType, setCandidateType] = useState<InterventionType>('ramp_metering');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<AiProjectAssessment | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Metric Deltas
  const delaySavedHours = Math.max(0, baselineState.totalDailyDelayHours - currentState.totalDailyDelayHours);
  const speedGainMph = Math.max(0, currentState.averageSpeedMph - baselineState.averageSpeedMph);
  const economicSavingsAnnualM = Math.max(
    0,
    baselineState.economicCostOfDelayAnnualM - currentState.economicCostOfDelayAnnualM
  );
  const co2SavedTons = Math.max(0, baselineState.totalCo2TonsPerDay - currentState.totalCo2TonsPerDay) * 365;

  // Active interventions CapEx total
  const totalActiveCapExM = interventions
    .filter((i) => i.enabled)
    .reduce((sum, i) => sum + i.capExMillions, 0);

  // Evaluated Benefit-Cost Ratio (BCR over 20-year horizon)
  const bcr =
    totalActiveCapExM > 0
      ? Math.round(((economicSavingsAnnualM * 12.5) / totalActiveCapExM) * 10) / 10
      : 0;

  // Run AI Project Feasibility Evaluation via backend
  const evaluateProjectAi = async () => {
    setIsEvaluating(true);
    setAiError(null);
    try {
      const road = metro.roads.find((r) => r.id === selectedCorridorForAi);
      const res = await fetch('/api/ai/propose-interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: metro.name,
          corridorName: road?.name || 'Selected Corridor',
          interventionType: candidateType.replace('_', ' ').toUpperCase(),
          targetMetric: 'Reduce critical bottleneck delay and prevent mainline breakdown',
          budgetRange: 'Optimized State & Federal Grant CapEx',
          yearHorizon: 2030,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setAiAssessment(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evaluation failed';
      setAiError(msg);
    } finally {
      setIsEvaluating(false);
    }
  };

  const getInterventionIcon = (type: InterventionType) => {
    switch (type) {
      case 'ramp_metering':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'adaptive_signals':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'brt_lane':
        return <Leaf className="w-4 h-4 text-emerald-400" />;
      case 'flyover_overpass':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case 'auxiliary_lane':
        return <Layers className="w-4 h-4 text-indigo-400" />;
      case 'congestion_pricing':
        return <DollarSign className="w-4 h-4 text-rose-400" />;
      case 'shoulder_running':
        return <Hammer className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <div className="w-96 md:w-[460px] h-full flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl z-20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <Hammer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Infrastructure Mitigation Engine</h3>
            <p className="text-[11px] text-slate-400">Simulate Civil Interventions & Benefit-Cost ROI</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ROI Impact Summary Dashboard */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span>Simulated Network Return (ROI)</span>
            <span className="text-[10px] font-mono text-cyan-400">
              Active CapEx: ${totalActiveCapExM.toFixed(1)}M
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Daily Delay Saved
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                -{delaySavedHours.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-400">veh-hrs</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Annual Commuter Savings
              </div>
              <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                ${economicSavingsAnnualM.toFixed(1)}M{' '}
                <span className="text-xs font-normal text-slate-400">/ yr</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Benefit-Cost Ratio (BCR)
              </div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                {bcr > 0 ? `${bcr}:1` : '—'}{' '}
                <span className="text-xs font-normal text-slate-400">
                  {bcr >= 1.5 ? 'Strong ROI' : bcr > 0 ? 'Moderate' : 'No CapEx'}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                CO₂ Averted Annually
              </div>
              <div className="text-lg font-bold font-mono text-teal-400 mt-0.5">
                {Math.round(co2SavedTons).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">tons</span>
              </div>
            </div>
          </div>
        </div>

        {/* Candidate Mitigation Projects List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Candidate Infrastructure Projects</span>
            <span className="text-[10px] text-slate-500 font-mono">
              {interventions.filter((i) => i.enabled).length} of {interventions.length} Enabled
            </span>
          </div>

          <div className="space-y-2">
            {interventions.map((inv) => {
              const road = metro.roads.find((r) => r.id === inv.roadId);
              return (
                <div
                  key={inv.id}
                  onClick={() => onToggleIntervention(inv.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    inv.enabled
                      ? 'bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-950/20'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-900 border border-slate-800">
                        {getInterventionIcon(inv.type)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white leading-tight">
                          {inv.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {road ? road.routeNumber : 'Network-Wide'} • Target Horizon:{' '}
                          {inv.targetYearAvailable}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                        inv.enabled ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md transform" />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    {inv.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="text-cyan-300 font-bold">
                      CapEx: ${inv.capExMillions.toFixed(1)}M
                    </span>
                    <span>
                      Capacity: +{Math.round((inv.capacityMultiplier - 1) * 100)}%
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Delay: -{Math.round((1 - inv.delayReductionFactor) * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Civil Project Evaluator Accordion / Section */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">AI Project Feasibility Evaluator</span>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Target Corridor
              </label>
              <select
                value={selectedCorridorForAi}
                onChange={(e) => setSelectedCorridorForAi(e.target.value)}
                className="w-full text-xs bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                {metro.roads.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeNumber} - {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Civil Mitigation Concept
              </label>
              <select
                value={candidateType}
                onChange={(e) => setCandidateType(e.target.value as InterventionType)}
                className="w-full text-xs bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="ramp_metering">Smart Coordinated Ramp Metering & VSL</option>
                <option value="adaptive_signals">Adaptive Signal Coordination (ASCT)</option>
                <option value="brt_lane">Dedicated Bus Rapid Transit (BRT) Expressway</option>
                <option value="flyover_overpass">Grade-Separated Flyover / Overpass</option>
                <option value="auxiliary_lane">Auxiliary De-weaving Lane Addition</option>
                <option value="congestion_pricing">Dynamic Congestion Cordon Pricing</option>
                <option value="shoulder_running">Peak Hard Shoulder Running (ATM)</option>
              </select>
            </div>

            <button
              onClick={evaluateProjectAi}
              disabled={isEvaluating}
              className="w-full py-2 mt-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isEvaluating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Calculating BCR & Phasing...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  <span>Evaluate Civil Feasibility & BCR</span>
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/50 rounded-lg text-xs text-rose-300">
              {aiError}
            </div>
          )}

          {aiAssessment && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>{aiAssessment.projectTitle}</span>
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-500 text-emerald-300 rounded font-mono text-[10px]">
                  Score: {aiAssessment.feasibilityScore}/100
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400">PROJECTED SHIFT:</span>
                  <div className="text-cyan-300 font-bold">{aiAssessment.projectedLosShift}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400">BENEFIT-COST RATIO:</span>
                  <div className="text-amber-300 font-bold">{aiAssessment.benefitCostRatio}:1</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-200">Construction Phasing & Disruption:</div>
                <div className="text-slate-400">
                  Severity: {aiAssessment.constructionDisruptionSeverity} • Duration: {aiAssessment.constructionDurationMonths} months
                </div>
                <ul className="mt-1 space-y-1 text-slate-400 text-[10px]">
                  {aiAssessment.keyPhasingSteps?.map((step, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">Eligible Grants: </span>
                {aiAssessment.fundingProgramsEligible?.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
