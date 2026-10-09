import React, { useState } from 'react';
import { MetroPreset, RoadSegment, RoadType, SensorStation, SensorType } from '../types/traffic';
import { Network, Plus, Radio, Route, Trash2, X } from 'lucide-react';

interface NetworkEditorModalProps {
  metro: MetroPreset;
  onAddRoad: (road: RoadSegment) => void;
  onAddSensor: (sensor: SensorStation) => void;
  onClose: () => void;
}

export const NetworkEditorModal: React.FC<NetworkEditorModalProps> = ({
  metro,
  onAddRoad,
  onAddSensor,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'road' | 'sensor'>('road');

  // Road form state
  const [name, setName] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [sourceNodeId, setSourceNodeId] = useState(metro.nodes[0]?.id || '');
  const [targetNodeId, setTargetNodeId] = useState(metro.nodes[1]?.id || '');
  const [roadType, setRoadType] = useState<RoadType>('freeway');
  const [lanes, setLanes] = useState(4);
  const [lengthMiles, setLengthMiles] = useState(3.5);
  const [freeFlowSpeedMph, setFreeFlowSpeedMph] = useState(65);
  const [capacityPerLaneVph, setCapacityPerLaneVph] = useState(2000);
  const [baseVolumeVph, setBaseVolumeVph] = useState(6500);

  // Sensor form state
  const [sensorId, setSensorId] = useState(`PeMS-VDS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [sensorName, setSensorName] = useState('New Arterial Probe Station');
  const [sensorRoadId, setSensorRoadId] = useState(metro.roads[0]?.id || '');
  const [sensorType, setSensorType] = useState<SensorType>('dual_loop');
  const [milepost, setMilepost] = useState('MP 12.4');

  const handleCreateRoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !routeNumber || sourceNodeId === targetNodeId) return;

    const newRoad: RoadSegment = {
      id: `road_${Date.now()}`,
      name,
      routeNumber,
      sourceNodeId,
      targetNodeId,
      type: roadType,
      lanes,
      lengthMiles,
      freeFlowSpeedMph,
      capacityPerLaneVph,
      baseVolumeVph,
      bprAlpha: roadType === 'freeway' ? 0.15 : 0.22,
      bprBeta: 4.0,
    };

    onAddRoad(newRoad);
    onClose();
  };

  const handleCreateSensor = (e: React.FormEvent) => {
    e.preventDefault();
    const road = metro.roads.find((r) => r.id === sensorRoadId);
    if (!road) return;

    const source = metro.nodes.find((n) => n.id === road.sourceNodeId);
    const target = metro.nodes.find((n) => n.id === road.targetNodeId);
    const midX = source && target ? Math.round((source.x + target.x) / 2) : 500;
    const midY = source && target ? Math.round((source.y + target.y) / 2) : 350;

    const newSensor: SensorStation = {
      id: sensorId,
      roadId: sensorRoadId,
      name: sensorName,
      agencySource: `${metro.agencyLabel} (Custom Deploy)`,
      type: sensorType,
      milepost,
      direction: 'Both',
      health: 'operational',
      x: midX,
      y: midY,
      currentReading: {
        volume5m: Math.round(road.baseVolumeVph / 12),
        volumeHourlyEquivalent: road.baseVolumeVph,
        speedMph: road.freeFlowSpeedMph - 5,
        occupancyPct: 22.0,
        truckPct: 6.0,
        timestamp: 'Real-Time Feed',
      },
      hourlyProfile: [
        { hour: 0, volume: 1500, speed: 65, occupancy: 3.5 },
        { hour: 8, volume: road.baseVolumeVph * 1.1, speed: 42, occupancy: 28 },
        { hour: 12, volume: road.baseVolumeVph * 0.8, speed: 58, occupancy: 16 },
        { hour: 17, volume: road.baseVolumeVph * 1.2, speed: 34, occupancy: 35 },
      ],
      historicalTrajectory: [
        { year: 2021, avgDailyVolume: 80000, peakDelayMins: 12 },
        { year: 2026, avgDailyVolume: 105000, peakDelayMins: 24 },
        { year: 2035, avgDailyVolume: 140000, peakDelayMins: 52 },
      ],
    };

    onAddSensor(newSensor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Network Geometry & Sensor Builder</h3>
              <p className="text-xs text-slate-400">
                Deploy links or virtual ITS telemetry probes to {metro.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('road')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'road'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Route className="w-4 h-4" />
            <span>Add Road Link</span>
          </button>
          <button
            onClick={() => setActiveTab('sensor')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'sensor'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Deploy Sensor Probe</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[75vh]">
          {activeTab === 'road' ? (
            <form onSubmit={handleCreateRoad} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Road / Corridor Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Skyline Arterial Expressway"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Route Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CA-35 / I-280 Conn"
                    value={routeNumber}
                    onChange={(e) => setRouteNumber(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Source Node
                  </label>
                  <select
                    value={sourceNodeId}
                    onChange={(e) => setSourceNodeId(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  >
                    {metro.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Target Node
                  </label>
                  <select
                    value={targetNodeId}
                    onChange={(e) => setTargetNodeId(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  >
                    {metro.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Facility Class
                  </label>
                  <select
                    value={roadType}
                    onChange={(e) => setRoadType(e.target.value as RoadType)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="freeway">Freeway</option>
                    <option value="arterial">Arterial</option>
                    <option value="bridge">Bridge Span</option>
                    <option value="tunnel">Tunnel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Lanes (each dir)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={lanes}
                    onChange={(e) => setLanes(Number(e.target.value))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Length (miles)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.5}
                    max={30}
                    value={lengthMiles}
                    onChange={(e) => setLengthMiles(Number(e.target.value))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Free-Flow Speed
                  </label>
                  <input
                    type="number"
                    min={25}
                    max={80}
                    value={freeFlowSpeedMph}
                    onChange={(e) => setFreeFlowSpeedMph(Number(e.target.value))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Cap / Lane (vph)
                  </label>
                  <input
                    type="number"
                    min={800}
                    max={2400}
                    value={capacityPerLaneVph}
                    onChange={(e) => setCapacityPerLaneVph(Number(e.target.value))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Peak Vol (vph)
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={20000}
                    value={baseVolumeVph}
                    onChange={(e) => setBaseVolumeVph(Number(e.target.value))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-cyan-500/20"
                >
                  Add Road Corridor
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateSensor} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Sensor ID
                  </label>
                  <input
                    type="text"
                    required
                    value={sensorId}
                    onChange={(e) => setSensorId(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Station Description
                  </label>
                  <input
                    type="text"
                    required
                    value={sensorName}
                    onChange={(e) => setSensorName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Bind to Road Corridor
                </label>
                <select
                  value={sensorRoadId}
                  onChange={(e) => setSensorRoadId(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                >
                  {metro.roads.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeNumber} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Sensor Technology
                  </label>
                  <select
                    value={sensorType}
                    onChange={(e) => setSensorType(e.target.value as SensorType)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="dual_loop">Dual Inductive Loop Detectors</option>
                    <option value="radar_probe">Microwave / Radar Probe</option>
                    <option value="bluetooth_reader">Bluetooth MAC Reader</option>
                    <option value="wim_scale">Weigh-in-Motion (WIM) Freight Scale</option>
                    <option value="camera_ai">AI Video Detection Camera</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Milepost Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={milepost}
                    onChange={(e) => setMilepost(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-cyan-500/20"
                >
                  Deploy Sensor Station
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
