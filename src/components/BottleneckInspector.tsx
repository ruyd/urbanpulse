import React, { useState } from 'react';
import {
  CalculatedRoadState,
  Intervention,
  ScenarioConfig,
  SensorStation,
} from '../types/traffic';
import {
  Activity,
  AlertOctagon,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  DollarSign,
  Fuel,
  Info,
  Layers,
  LineChart,
  Radio,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { generateFundamentalDiagramData } from '../services/trafficPhysics';

interface BottleneckInspectorProps {
  calculatedRoad: CalculatedRoadState | null;
  sensor: SensorStation | null;
  scenario: ScenarioConfig;
  activeInterventions: Intervention[];
  onClose: () => void;
  onApplyIntervention: (type: string, roadId: string) => void;
}

interface AiAnalysisResponse {
  summary: string;
  levelOfService: string;
  breakdownYear: number;
  primaryPhysicsCauses: string[];
  economicImpactAnnual: string;
  recommendedInterventions: Array<{
    name: string;
    category: string;
    estimatedCost: string;
    expectedDelayReduction: string;
    implementationTimeline: string;
    rationale: string;
  }>;
  braessParadoxWarning: string;
}

export const BottleneckInspector: React.FC<BottleneckInspectorProps> = ({
  calculatedRoad,
  sensor,
  scenario,
  activeInterventions,
  onClose,
  onApplyIntervention,
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'fundamental' | 'forecast' | 'ai'>('telemetry');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<AiAnalysisResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!calculatedRoad) return null;

  const { road, speedMph, volumeVph, vcRatio, delayHours, levelOfService, isBottleneck, isBreakdown } =
    calculatedRoad;

  // Generate Greenshields Fundamental Diagram points
  const fundamentalCurve = generateFundamentalDiagramData(
    road.freeFlowSpeedMph,
    road.capacityPerLaneVph,
    road.lanes
  );

  // Approximate current density k = volume / speed
  const currentDensity = Math.round(volumeVph / Math.max(speedMph, 5));

  // Run AI Civil Engineering Analysis via server endpoint
  const runAiDiagnosis = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/analyze-bottleneck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadName: road.name,
          city: 'Regional Metro Network',
          sensorId: sensor?.id || 'VDS-Virtual-Probe',
          currentYear: 2026,
          forecastYear: scenario.year,
          volumePerHour: volumeVph,
          capacityPerHour: calculatedRoad.practicalCapacityVph,
          vcRatio,
          currentSpeedMph: speedMph,
          freeFlowSpeedMph: road.freeFlowSpeedMph,
          growthScenario: scenario.growthPreset,
          activeInterventions: activeInterventions.filter(
            (i) => i.enabled && (i.roadId === road.id || i.roadId === 'network-wide')
          ),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setAiReport(data);
      setActiveTab('ai');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis request failed';
      setAiError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-96 md:w-[440px] h-full flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl z-20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                levelOfService === 'F'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/50 animate-pulse'
                  : levelOfService === 'E'
                  ? 'bg-orange-950 text-orange-300 border border-orange-500/50'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
              }`}
            >
              LOS {levelOfService}
            </span>
            <span className="text-xs font-semibold text-cyan-400 font-mono">
              {road.routeNumber}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mt-1 leading-tight line-clamp-1">
            {road.name}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {road.lanes} Lanes • {road.lengthMiles} miles • Free-Flow: {road.freeFlowSpeedMph} mph
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950 text-xs font-medium">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'telemetry'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Telemetry</span>
        </button>
        <button
          onClick={() => setActiveTab('fundamental')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'fundamental'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LineChart className="w-3.5 h-3.5" />
          <span>Physics Curve</span>
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'forecast'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>10-Yr Trend</span>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'ai'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>AI Engineer</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Callout Banner */}
        {isBreakdown ? (
          <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-rose-200">Hyper-Critical Breakdown</div>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                V/C ratio is {vcRatio.toFixed(2)}. Queue discharge rate is compromised. Backward
                forming shockwaves will propagate upstream into adjacent connectors.
              </p>
            </div>
          </div>
        ) : isBottleneck ? (
          <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-200">Emerging Bottleneck Risk</div>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Operating near capacity threshold ({Math.round(vcRatio * 100)}% load). Minor merges
                or lane merges will trigger shockwave breakdown.
              </p>
            </div>
          </div>
        ) : null}

        {/* TAB 1: TELEMETRY */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            {/* Metric Tiles */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Operating Speed
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-1 flex items-baseline gap-1">
                  {speedMph} <span className="text-xs font-normal text-slate-400">mph</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Free-Flow: {road.freeFlowSpeedMph} mph
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Volume / Capacity
                </div>
                <div className="text-xl font-bold font-mono text-amber-300 mt-1 flex items-baseline gap-1">
                  {(vcRatio * 100).toFixed(0)}% <span className="text-xs font-normal text-slate-400">V/C</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {volumeVph.toLocaleString()} / {calculatedRoad.practicalCapacityVph.toLocaleString()} vph
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Travel Time
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1 flex items-baseline gap-1">
                  {calculatedRoad.travelTimeMinutes} <span className="text-xs font-normal text-slate-400">min</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Baseline: {calculatedRoad.freeFlowTravelTimeMinutes} min (+{(calculatedRoad.travelTimeMinutes - calculatedRoad.freeFlowTravelTimeMinutes).toFixed(1)} min delay)
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Hourly Delay Load
                </div>
                <div className="text-xl font-bold font-mono text-rose-300 mt-1 flex items-baseline gap-1">
                  {delayHours} <span className="text-xs font-normal text-slate-400">veh-hrs</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  CO₂: {calculatedRoad.co2EmissionsKgPerHour} kg/hr
                </div>
              </div>
            </div>

            {/* Sensor Probe Telemetry Section */}
            {sensor ? (
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span className="text-xs font-bold text-slate-200">
                      Physical Sensor Telemetry
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded">
                    {sensor.health.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px]">STATION ID:</span>
                    <div className="text-slate-200">{sensor.id}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">AGENCY SOURCE:</span>
                    <div className="text-slate-200">{sensor.agencySource}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">POSTMILE / DIR:</span>
                    <div className="text-slate-200">{sensor.milepost} ({sensor.direction})</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">LANE OCCUPANCY:</span>
                    <div className="text-cyan-300 font-bold">{sensor.currentReading.occupancyPct}%</div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span>Detection Technology: {sensor.type.replace('_', ' ').toUpperCase()}</span>
                  <span>Freight Trucks: {sensor.currentReading.truckPct}%</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                Synthetic probe model active (no physical inductive loop bound to this link).
              </div>
            )}

            {/* 24-Hour Diurnal Chart */}
            {sensor?.hourlyProfile && (
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>24-Hour Diurnal Flow Curve</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">PeMS Historic Median</span>
                </div>

                {/* SVG Mini Chart */}
                <div className="h-28 w-full pt-1">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 90">
                    {/* Grid lines */}
                    <line x1="0" y1="15" x2="300" y2="15" stroke="#334155" strokeDasharray="2,2" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#334155" strokeDasharray="2,2" strokeWidth="0.5" />
                    <line x1="0" y1="80" x2="300" y2="80" stroke="#334155" strokeWidth="0.8" />

                    {/* Volume Line */}
                    <path
                      d={sensor.hourlyProfile
                        .map((p, i) => {
                          const x = (p.hour / 24) * 300;
                          const y = 80 - (p.volume / 12000) * 65;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* Speed Line */}
                    <path
                      d={sensor.hourlyProfile
                        .map((p, i) => {
                          const x = (p.hour / 24) * 300;
                          const y = 80 - (p.speed / 70) * 65;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />

                    {/* Current Time Indicator Marker */}
                    <line
                      x1={(scenario.timeOfDayHours / 24) * 300}
                      y1="5"
                      x2={(scenario.timeOfDayHours / 24) * 300}
                      y2="80"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-cyan-400"></span> Volume (vph)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-amber-400 border-dashed"></span> Speed (mph)
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Current Hour
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FUNDAMENTAL DIAGRAM OF TRAFFIC FLOW */}
        {activeTab === 'fundamental' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                Greenshields Flow-Density Equilibrium
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Represents the relationship between traffic density (vehicles/mile) and throughput flow
                (vehicles/hour). The apex represents maximum roadway capacity (q_max). Operating
                past the critical density triggers backward queue propagation.
              </p>

              {/* Fundamental Parabolic SVG Curve */}
              <div className="h-44 w-full pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 320 130">
                  {/* Axis */}
                  <line x1="25" y1="110" x2="310" y2="110" stroke="#475569" strokeWidth="1" />
                  <line x1="25" y1="10" x2="25" y2="110" stroke="#475569" strokeWidth="1" />

                  {/* Flow curve */}
                  <path
                    d={fundamentalCurve
                      .map((pt, i) => {
                        const maxDensity = 140 * road.lanes;
                        const maxFlow = road.capacityPerLaneVph * road.lanes * 1.1;
                        const x = 25 + (pt.density / maxDensity) * 270;
                        const y = 110 - (pt.flow / maxFlow) * 95;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                  />

                  {/* Critical capacity vertical dashed line */}
                  <line x1="160" y1="15" x2="160" y2="110" stroke="#64748b" strokeDasharray="3,3" strokeWidth="1" />
                  <text x="162" y="25" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                    q_max Capacity
                  </text>

                  {/* Current Operating Point Marker */}
                  {(() => {
                    const maxDensity = 140 * road.lanes;
                    const maxFlow = road.capacityPerLaneVph * road.lanes * 1.1;
                    const opX = Math.min(295, 25 + (currentDensity / maxDensity) * 270);
                    const opY = Math.max(15, 110 - (volumeVph / maxFlow) * 95);
                    return (
                      <g>
                        <circle cx={opX} cy={opY} r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
                        <text x={opX + 8} y={opY - 4} fill="#fda4af" fontSize="10" fontWeight="bold">
                          Current State ({speedMph} mph)
                        </text>
                      </g>
                    );
                  })()}

                  {/* Regime Labels */}
                  <text x="45" y="102" fill="#10b981" fontSize="9" fontWeight="bold">
                    UNCONGESTED
                  </text>
                  <text x="220" y="102" fill="#f43f5e" fontSize="9" fontWeight="bold">
                    BREAKDOWN / JAM
                  </text>
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400">Current Density:</span>
                  <div className="text-slate-200 font-bold">{currentDensity} veh/mi</div>
                </div>
                <div>
                  <span className="text-slate-400">Flow Regime:</span>
                  <div className={currentDensity > 70 * road.lanes ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {currentDensity > 70 * road.lanes ? 'Forced Breakdown' : 'Stable Stream'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 10-YEAR FORECAST TREND */}
        {activeTab === 'forecast' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                10-Year Horizon Congestion Trajectory
              </div>
              <p className="text-[11px] text-slate-400">
                Projects link performance under the <strong>{scenario.growthPreset.replace('_', ' ').toUpperCase()}</strong> scenario (2026 to 2035).
              </p>

              {sensor?.historicalTrajectory && (
                <div className="h-44 w-full pt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 120">
                    <line x1="20" y1="105" x2="310" y2="105" stroke="#334155" strokeWidth="1" />
                    <line x1="20" y1="15" x2="20" y2="105" stroke="#334155" strokeWidth="1" />

                    {/* Delay trajectory line */}
                    <path
                      d={sensor.historicalTrajectory
                        .map((pt, i) => {
                          const x = 20 + ((pt.year - 2021) / 14) * 280;
                          const y = 105 - (pt.peakDelayMins / 90) * 85;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                    />

                    {/* Points */}
                    {sensor.historicalTrajectory.map((pt) => {
                      const x = 20 + ((pt.year - 2021) / 14) * 280;
                      const y = 105 - (pt.peakDelayMins / 90) * 85;
                      const isTargetYear = pt.year === scenario.year;
                      return (
                        <g key={pt.year}>
                          <circle
                            cx={x}
                            cy={y}
                            r={isTargetYear ? 5 : 3}
                            fill={isTargetYear ? '#38bdf8' : '#e11d48'}
                            stroke="#ffffff"
                            strokeWidth={isTargetYear ? 2 : 1}
                          />
                          <text x={x} y="118" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">
                            '{String(pt.year).slice(2)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Year 2026 Delay:</span>
                  <span className="font-mono text-cyan-300">26 mins / commuter</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Year 2035 Projected (No-Build):</span>
                  <span className="font-mono text-rose-400 font-bold">58 mins (+123%)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Year 2035 with Interventions:</span>
                  <span className="font-mono text-emerald-400 font-bold">22 mins (-62%)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI CIVIL ENGINEER ADVISORY */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            {!aiReport && !isAnalyzing && (
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">AI Civil Engineering Diagnosis</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Invoke Gemini 3.8 Flash to analyze link sensor telemetry, diagnose failure modes,
                    and compute AASHTO/FHWA mitigation recommendations.
                  </p>
                </div>
                <button
                  onClick={runAiDiagnosis}
                  className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>Generate Corridor Diagnosis</span>
                </button>
              </div>
            )}

            {isAnalyzing && (
              <div className="p-8 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-3">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs font-bold text-cyan-200">
                  Synthesizing Sensor Telemetry & BPR Curves...
                </div>
                <p className="text-[11px] text-slate-400">
                  Evaluating shockwave velocity, V/C ratio, and FHWA mitigation blueprints.
                </p>
              </div>
            )}

            {aiError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl text-xs text-rose-300">
                {aiError}
              </div>
            )}

            {aiReport && (
              <div className="space-y-3">
                {/* Executive Summary */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                      Executive Evaluation
                    </span>
                    <span className="text-xs font-bold font-mono text-rose-400">
                      Breakdown Horizon: {aiReport.breakdownYear}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{aiReport.summary}</p>
                  <div className="text-[11px] text-amber-300 font-mono pt-1 border-t border-slate-800">
                    Est. Annual Cost: {aiReport.economicImpactAnnual}
                  </div>
                </div>

                {/* Primary Physics Causes */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Primary Physics & Structural Causes
                  </div>
                  <ul className="space-y-1.5">
                    {aiReport.primaryPhysicsCauses?.map((cause, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Interventions */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Recommended Civil Interventions
                  </div>
                  <div className="space-y-2">
                    {aiReport.recommendedInterventions?.map((rec, i) => (
                      <div key={i} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{rec.name}</span>
                          <span className="text-cyan-400 font-mono text-[11px]">{rec.estimatedCost}</span>
                        </div>
                        <div className="text-[10px] text-emerald-300 font-mono">
                          {rec.expectedDelayReduction} • Timeline: {rec.implementationTimeline}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Braess's Paradox Warning */}
                {aiReport.braessParadoxWarning && (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-xs space-y-1">
                    <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                      Induced Demand / Braess's Paradox Risk
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      {aiReport.braessParadoxWarning}
                    </p>
                  </div>
                )}

                <button
                  onClick={runAiDiagnosis}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Re-analyze Corridor
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Quick Action */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
        <button
          onClick={runAiDiagnosis}
          disabled={isAnalyzing}
          className="flex-1 py-2 bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>AI Civil Diagnosis</span>
        </button>
      </div>
    </div>
  );
};
