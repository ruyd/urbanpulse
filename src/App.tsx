import React, { useMemo, useState } from 'react';
import { METRO_PRESETS } from './data/presetNetworks';
import {
  Intervention,
  MetroPreset,
  RoadSegment,
  ScenarioConfig,
  SensorStation,
} from './types/traffic';
import { simulateNetwork } from './services/trafficPhysics';
import { ColorMode, NetworkCanvas } from './components/NetworkCanvas';
import { TimeMachineScrubber } from './components/TimeMachineScrubber';
import { BottleneckInspector } from './components/BottleneckInspector';
import { InterventionSimulator } from './components/InterventionSimulator';
import { AuditReportModal } from './components/AuditReportModal';
import { NetworkEditorModal } from './components/NetworkEditorModal';
import {
  Activity,
  AlertTriangle,
  Building,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  FileText,
  Fuel,
  Hammer,
  Layers,
  MapPin,
  Plus,
  Radio,
  Sliders,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

export default function App() {
  // Active city preset
  const [selectedMetroId, setSelectedMetroId] = useState<string>('sf-bay-area');

  // Network state (cloned from preset to allow dynamic link additions)
  const [metroOverrides, setMetroOverrides] = useState<Record<string, MetroPreset>>({});

  const currentPreset = useMemo(() => {
    return (
      metroOverrides[selectedMetroId] ||
      METRO_PRESETS.find((m) => m.id === selectedMetroId) ||
      METRO_PRESETS[0]
    );
  }, [selectedMetroId, metroOverrides]);

  // Interventions state
  const [interventionsByMetro, setInterventionsByMetro] = useState<
    Record<string, Intervention[]>
  >(() => {
    const initial: Record<string, Intervention[]> = {};
    METRO_PRESETS.forEach((m) => {
      initial[m.id] = [...m.defaultInterventions];
    });
    return initial;
  });

  const activeInterventions = interventionsByMetro[selectedMetroId] || [];

  // Scenario config state (Year 2026 to 2035, diurnal time, growth preset)
  const [scenario, setScenario] = useState<ScenarioConfig>({
    year: 2026,
    timeOfDayHours: 8.0, // 08:00 AM peak rush
    growthPreset: 'baseline',
    customAnnualGrowthRate: 0.021,
    weatherFactor: 'clear',
  });

  // Selected road & sensor for deep inspection
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>('r_macarthur_maze');
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>('PeMS-VDS-401580');

  // UI Drawer & Modal controls
  const [rightPanel, setRightPanel] = useState<'inspector' | 'mitigation' | null>('inspector');
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false);

  // Canvas visual toggles
  const [colorMode, setColorMode] = useState<ColorMode>('los');
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [showSensors, setShowSensors] = useState<boolean>(true);

  // Compute Simulation State (with active interventions)
  const simulationState = useMemo(() => {
    return simulateNetwork(currentPreset.roads, scenario, activeInterventions);
  }, [currentPreset.roads, scenario, activeInterventions]);

  // Compute Baseline "No-Build" State (zero interventions, for comparison)
  const baselineState = useMemo(() => {
    return simulateNetwork(currentPreset.roads, scenario, []);
  }, [currentPreset.roads, scenario]);

  // Active selected road state
  const selectedRoadCalculated = selectedRoadId
    ? simulationState.roads[selectedRoadId] || null
    : null;

  // Active selected sensor
  const selectedSensor = selectedSensorId
    ? currentPreset.sensors.find((s) => s.id === selectedSensorId) || null
    : null;

  // Handlers
  const handleToggleIntervention = (id: string) => {
    setInterventionsByMetro((prev) => {
      const currentList = prev[selectedMetroId] || [];
      const updated = currentList.map((inv) =>
        inv.id === id ? { ...inv, enabled: !inv.enabled } : inv
      );
      return { ...prev, [selectedMetroId]: updated };
    });
  };

  const handleAddIntervention = (inv: Intervention) => {
    setInterventionsByMetro((prev) => {
      const currentList = prev[selectedMetroId] || [];
      return { ...prev, [selectedMetroId]: [inv, ...currentList] };
    });
  };

  const handleAddRoad = (road: RoadSegment) => {
    setMetroOverrides((prev) => {
      const base = currentPreset;
      const updated = {
        ...base,
        roads: [...base.roads, road],
      };
      return { ...prev, [selectedMetroId]: updated };
    });
    setSelectedRoadId(road.id);
    setRightPanel('inspector');
  };

  const handleAddSensor = (sensor: SensorStation) => {
    setMetroOverrides((prev) => {
      const base = currentPreset;
      const updated = {
        ...base,
        sensors: [...base.sensors, sensor],
      };
      return { ...prev, [selectedMetroId]: updated };
    });
    setSelectedSensorId(sensor.id);
  };

  const handleSelectRoad = (roadId: string | null) => {
    setSelectedRoadId(roadId);
    if (roadId) {
      setRightPanel('inspector');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Branding & City Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm tracking-tight text-white">UrbanPulse</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  TRAFFIC ENGINE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Multi-Year Bottleneck Forecasting & Infrastructure Digital Twin
              </p>
            </div>
          </div>

          {/* Metro Dropdown */}
          <div className="relative border-l border-slate-800 pl-4">
            <select
              value={selectedMetroId}
              onChange={(e) => {
                setSelectedMetroId(e.target.value);
                setSelectedRoadId(null);
                setSelectedSensorId(null);
              }}
              className="appearance-none bg-slate-900 border border-slate-700/80 text-xs text-slate-200 font-semibold rounded-lg pl-3 pr-8 py-1.5 hover:border-cyan-500 focus:outline-none focus:border-cyan-400 cursor-pointer shadow-sm"
            >
              {METRO_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Center: Real-Time Network Macro Telemetry */}
        <div className="hidden xl:flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase">Avg Speed:</span>
            <span className="font-bold text-cyan-300 text-sm">
              {simulationState.averageSpeedMph} mph
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase">Delay Load:</span>
            <span
              className={`font-bold text-sm ${
                simulationState.totalDailyDelayHours > 120 ? 'text-rose-400' : 'text-amber-300'
              }`}
            >
              {simulationState.totalDailyDelayHours.toLocaleString()} veh-hrs/day
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase">Congestion Cost:</span>
            <span className="font-bold text-rose-300 text-sm">
              ${simulationState.economicCostOfDelayAnnualM.toFixed(1)}M/yr
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase">Daily CO₂:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {simulationState.totalCo2TonsPerDay.toLocaleString()} tons
            </span>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRightPanel(rightPanel === 'mitigation' ? null : 'mitigation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              rightPanel === 'mitigation'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-lg shadow-cyan-500/20'
                : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Open Infrastructure Mitigation Simulator"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Mitigation Projects</span>
            {activeInterventions.filter((i) => i.enabled).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/50">
                {activeInterventions.filter((i) => i.enabled).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowEditorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
            title="Add Custom Road Link or Sensor Probe"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Build Network</span>
          </button>

          <button
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all"
            title="Generate Civil Engineering Transportation Audit"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Regional Audit</span>
          </button>
        </div>
      </header>

      {/* Main Workspace (Map + Inspector / Mitigation Drawers) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Vector Canvas & Digital Twin */}
        <div className="flex-1 relative h-full">
          <NetworkCanvas
            metro={currentPreset}
            roadsCalculated={simulationState.roads}
            selectedRoadId={selectedRoadId}
            selectedSensorId={selectedSensorId}
            onSelectRoad={handleSelectRoad}
            onSelectSensor={(sensorId) => {
              setSelectedSensorId(sensorId);
              if (sensorId) {
                setRightPanel('inspector');
              }
            }}
            colorMode={colorMode}
            onChangeColorMode={setColorMode}
            showParticles={showParticles}
            onToggleParticles={() => setShowParticles(!showParticles)}
            showSensors={showSensors}
            onToggleSensors={() => setShowSensors(!showSensors)}
          />

          {/* Floating Bottleneck Radar Badge */}
          {simulationState.topBottlenecks.length > 0 && (
            <div className="absolute top-4 left-4 z-10 pointer-events-auto">
              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl max-w-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4 animate-bounce" />
                    <span>Bottleneck Radar</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Year {scenario.year}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {simulationState.topBottlenecks.slice(0, 3).map((bn) => (
                    <div
                      key={bn.road.id}
                      onClick={() => {
                        setSelectedRoadId(bn.road.id);
                        if (bn.road.sensorId) setSelectedSensorId(bn.road.sensorId);
                        setRightPanel('inspector');
                      }}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedRoadId === bn.road.id
                          ? 'bg-rose-950/60 border-rose-500 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{bn.road.routeNumber}</span>
                        <span className="font-mono text-rose-400 font-bold">
                          {bn.speedMph} mph
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {bn.road.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Drawer: Bottleneck Inspector */}
        {rightPanel === 'inspector' && selectedRoadCalculated && (
          <BottleneckInspector
            calculatedRoad={selectedRoadCalculated}
            sensor={selectedSensor}
            scenario={scenario}
            activeInterventions={activeInterventions}
            onClose={() => setRightPanel(null)}
            onApplyIntervention={(type, roadId) => {
              setRightPanel('mitigation');
            }}
          />
        )}

        {/* Right Drawer: Mitigation Simulator */}
        {rightPanel === 'mitigation' && (
          <InterventionSimulator
            metro={currentPreset}
            interventions={activeInterventions}
            onToggleIntervention={handleToggleIntervention}
            onAddIntervention={handleAddIntervention}
            baselineState={baselineState}
            currentState={simulationState}
            onClose={() => setRightPanel(null)}
          />
        )}
      </div>

      {/* Bottom Timeline & Scenario Scrubber */}
      <footer className="shrink-0 z-30">
        <TimeMachineScrubber scenario={scenario} onChangeScenario={setScenario} />
      </footer>

      {/* Audit Report Modal */}
      {showAuditModal && (
        <AuditReportModal
          metro={currentPreset}
          scenario={scenario}
          simulationState={simulationState}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* Network Geometry & Sensor Builder Modal */}
      {showEditorModal && (
        <NetworkEditorModal
          metro={currentPreset}
          onAddRoad={handleAddRoad}
          onAddSensor={handleAddSensor}
          onClose={() => setShowEditorModal(false)}
        />
      )}
    </div>
  );
}
