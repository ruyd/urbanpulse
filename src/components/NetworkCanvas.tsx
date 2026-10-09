import React, { useEffect, useRef, useState } from 'react';
import {
  CalculatedRoadState,
  LevelOfService,
  MetroPreset,
  RoadSegment,
  SensorStation,
} from '../types/traffic';
import {
  Activity,
  AlertTriangle,
  Compass,
  Layers,
  Maximize2,
  Minimize2,
  Radio,
  RotateCcw,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type ColorMode = 'los' | 'speed_deficit' | 'vc_ratio' | 'emissions';

interface NetworkCanvasProps {
  metro: MetroPreset;
  roadsCalculated: Record<string, CalculatedRoadState>;
  selectedRoadId: string | null;
  selectedSensorId: string | null;
  onSelectRoad: (roadId: string | null) => void;
  onSelectSensor: (sensorId: string | null) => void;
  colorMode: ColorMode;
  onChangeColorMode: (mode: ColorMode) => void;
  showParticles: boolean;
  onToggleParticles: () => void;
  showSensors: boolean;
  onToggleSensors: () => void;
}

interface Particle {
  roadId: string;
  progress: number; // 0.0 to 1.0
  speedMultiplier: number;
  offsetLat: number; // lateral lane jitter
  color: string;
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  metro,
  roadsCalculated,
  selectedRoadId,
  selectedSensorId,
  onSelectRoad,
  onSelectSensor,
  colorMode,
  onChangeColorMode,
  showParticles,
  onToggleParticles,
  showSensors,
  onToggleSensors,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Transform state for pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredRoadId, setHoveredRoadId] = useState<string | null>(null);
  const [hoveredSensorId, setHoveredSensorId] = useState<string | null>(null);

  // Particle simulation pool
  const particlesRef = useRef<Particle[]>([]);

  // Node coordinate lookup
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, { x: number; y: number; name: string }>();
    metro.nodes.forEach((n) => map.set(n.id, { x: n.x, y: n.y, name: n.name }));
    return map;
  }, [metro]);

  // Color helper functions
  const getRoadColor = (calc: CalculatedRoadState | undefined, mode: ColorMode): string => {
    if (!calc) return '#475569';

    if (mode === 'los') {
      switch (calc.levelOfService) {
        case 'A':
          return '#10b981'; // Emerald 500
        case 'B':
          return '#34d399'; // Emerald 400
        case 'C':
          return '#facc15'; // Yellow 400
        case 'D':
          return '#fb923c'; // Orange 400
        case 'E':
          return '#f43f5e'; // Rose 500
        case 'F':
          return '#e11d48'; // Crimson 600 / Gridlock
      }
    } else if (mode === 'speed_deficit') {
      const deficit = calc.road.freeFlowSpeedMph - calc.speedMph;
      if (deficit <= 5) return '#06b6d4'; // Cyan
      if (deficit <= 15) return '#eab308'; // Amber
      if (deficit <= 25) return '#f97316'; // Orange
      return '#ef4444'; // Red
    } else if (mode === 'vc_ratio') {
      if (calc.vcRatio < 0.6) return '#3b82f6';
      if (calc.vcRatio < 0.85) return '#eab308';
      if (calc.vcRatio < 1.0) return '#f97316';
      return '#ef4444';
    } else {
      // emissions
      if (calc.co2EmissionsKgPerHour < 1000) return '#10b981';
      if (calc.co2EmissionsKgPerHour < 2500) return '#eab308';
      return '#f43f5e';
    }
  };

  // Initialize or re-populate particles when road list or speed changes
  useEffect(() => {
    const particles: Particle[] = [];
    metro.roads.forEach((road) => {
      const calc = roadsCalculated[road.id];
      const count = Math.max(3, Math.min(18, Math.round((road.baseVolumeVph || 3000) / 900)));
      for (let i = 0; i < count; i++) {
        particles.push({
          roadId: road.id,
          progress: Math.random(),
          speedMultiplier: 0.6 + Math.random() * 0.8,
          offsetLat: (Math.random() - 0.5) * (road.lanes * 2.2),
          color: calc?.levelOfService === 'F' ? '#f43f5e' : '#38bdf8',
        });
      }
    });
    particlesRef.current = particles;
  }, [metro.roads, roadsCalculated]);

  // Main Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Background GIS styling (radar grid and base map tone)
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Apply camera transform
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-500, -350); // Center on 1000x700 virtual canvas coordinates

      // 1. Draw subtle GIS Grid lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= 1000; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 700);
        ctx.stroke();
      }
      for (let y = 0; y <= 700; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1000, y);
        ctx.stroke();
      }

      // 2. Draw District labels & background features
      if (metro.backgroundFeatures?.districts) {
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.textAlign = 'center';
        metro.backgroundFeatures.districts.forEach((d) => {
          ctx.fillText(d.name.toUpperCase(), d.x, d.y);
        });
      }

      // 3. Draw Road Corridors (Base & Active glow)
      metro.roads.forEach((road) => {
        const source = nodeMap.get(road.sourceNodeId);
        const target = nodeMap.get(road.targetNodeId);
        if (!source || !target) return;

        const calc = roadsCalculated[road.id];
        const isSelected = selectedRoadId === road.id;
        const isHovered = hoveredRoadId === road.id;
        const color = getRoadColor(calc, colorMode);
        const roadWidth = Math.max(3, road.lanes * 2.8);

        // Under-glow for bottlenecks or selected road
        if (isSelected || isHovered || calc?.isBreakdown) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = calc?.isBreakdown
            ? 'rgba(225, 29, 72, 0.4)'
            : 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = roadWidth + (isSelected ? 10 : 6);
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Road asphalt base
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = roadWidth + 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Road colored flow layer
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = roadWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Lane divider dashed line for highways
        if (road.lanes >= 3) {
          ctx.beginPath();
          ctx.setLineDash([4, 6]);
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Road Name Tag if selected or bottleneck
        if (isSelected || calc?.isBottleneck) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          const text = `${road.routeNumber} (${calc?.speedMph || 0} mph)`;
          const textWidth = ctx.measureText(text).width;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = calc?.isBreakdown ? '#f43f5e' : '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(midX - textWidth / 2 - 6, midY - 14, textWidth + 12, 20, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.fillText(text, midX, midY);
        }
      });

      // 4. Update and render animated Traffic Flow Particles
      if (showParticles) {
        particlesRef.current.forEach((p) => {
          const road = metro.roads.find((r) => r.id === p.roadId);
          if (!road) return;
          const source = nodeMap.get(road.sourceNodeId);
          const target = nodeMap.get(road.targetNodeId);
          if (!source || !target) return;

          const calc = roadsCalculated[road.id];
          const speedRatio = Math.max(0.12, (calc?.speedMph || 45) / (road.freeFlowSpeedMph || 60));

          // Step particle along road
          const speedFactor = 0.22 * speedRatio * p.speedMultiplier;
          p.progress += (speedFactor * dt) / Math.max(1, road.lengthMiles);
          if (p.progress >= 1.0) {
            p.progress = 0.0;
          }

          // Compute interpolated position with lateral offset
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const normX = -dy / (len || 1);
          const normY = dx / (len || 1);

          const px = source.x + dx * p.progress + normX * p.offsetLat;
          const py = source.y + dy * p.progress + normY * p.offsetLat;

          // Render vehicle particle
          ctx.beginPath();
          ctx.arc(px, py, calc?.isBreakdown ? 2.8 : 2.0, 0, Math.PI * 2);
          ctx.fillStyle =
            calc?.isBreakdown
              ? '#fda4af'
              : calc?.vcRatio && calc.vcRatio > 0.85
              ? '#fde047'
              : '#67e8f9';
          ctx.fill();
        });
      }

      // 5. Draw Nodes (Intersections & Interchanges)
      metro.nodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.type === 'interchange' ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Node center pip
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
      });

      // 6. Draw Public Sensor Stations (Pulsing Beacons)
      if (showSensors) {
        metro.sensors.forEach((sensor) => {
          const isSelected = selectedSensorId === sensor.id;
          const isHovered = hoveredSensorId === sensor.id;

          // Pulsing halo wave
          const pulse = (time / 1000) % 2;
          ctx.beginPath();
          ctx.arc(sensor.x, sensor.y, 7 + pulse * 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, 0.6 - pulse * 0.3)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Sensor Icon Core
          ctx.beginPath();
          ctx.arc(sensor.x, sensor.y, isSelected ? 8 : 6, 0, Math.PI * 2);
          ctx.fillStyle = sensor.health === 'operational' ? '#0284c7' : '#ea580c';
          ctx.strokeStyle = isSelected ? '#ffffff' : '#38bdf8';
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.fill();
          ctx.stroke();

          // Sensor badge label
          if (isSelected || isHovered) {
            ctx.font = 'bold 10px system-ui, sans-serif';
            ctx.textAlign = 'left';
            const badge = `${sensor.id} (${sensor.currentReading.speedMph} mph | ${sensor.currentReading.occupancyPct}%)`;
            const width = ctx.measureText(badge).width;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(sensor.x + 12, sensor.y - 12, width + 14, 22, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.fillText(badge, sensor.x + 18, sensor.y + 3);
          }
        });
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    metro,
    roadsCalculated,
    selectedRoadId,
    selectedSensorId,
    hoveredRoadId,
    hoveredSensorId,
    zoom,
    pan,
    colorMode,
    showParticles,
    showSensors,
    nodeMap,
  ]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse pan & zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.6, Math.min(3.2, prev * zoomDelta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Convert mouse screen coordinates to virtual canvas (1000x700) coordinates
  const screenToCanvas = (screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    const x = (relX - (width / 2 + pan.x)) / zoom + 500;
    const y = (relY - (height / 2 + pan.y)) / zoom + 350;
    return { x, y };
  };

  // Find road segment nearest to point (distance to line segment)
  const findRoadAtPoint = (cx: number, cy: number): string | null => {
    let closestRoadId: string | null = null;
    let minDistance = 14; // pick radius in canvas units

    metro.roads.forEach((road) => {
      const source = nodeMap.get(road.sourceNodeId);
      const target = nodeMap.get(road.targetNodeId);
      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return;

      let t = ((cx - source.x) * dx + (cy - source.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = source.x + t * dx;
      const projY = source.y + t * dy;

      const dist = Math.hypot(cx - projX, cy - projY);
      if (dist < minDistance) {
        minDistance = dist;
        closestRoadId = road.id;
      }
    });

    return closestRoadId;
  };

  // Find sensor nearest to point
  const findSensorAtPoint = (cx: number, cy: number): string | null => {
    for (const sensor of metro.sensors) {
      const dist = Math.hypot(cx - sensor.x, cy - sensor.y);
      if (dist <= 16) {
        return sensor.id;
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const sensorId = findSensorAtPoint(x, y);
    if (sensorId) {
      setHoveredSensorId(sensorId);
      setHoveredRoadId(null);
      return;
    } else {
      setHoveredSensorId(null);
    }

    const roadId = findRoadAtPoint(x, y);
    setHoveredRoadId(roadId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const sensorId = findSensorAtPoint(x, y);
    if (sensorId) {
      onSelectSensor(sensorId);
      const sensor = metro.sensors.find((s) => s.id === sensorId);
      if (sensor) {
        onSelectRoad(sensor.roadId);
      }
      return;
    }

    const roadId = findRoadAtPoint(x, y);
    onSelectRoad(roadId);
    if (roadId) {
      const road = metro.roads.find((r) => r.id === roadId);
      if (road?.sensorId) {
        onSelectSensor(road.sensorId);
      } else {
        onSelectSensor(null);
      }
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-slate-950"
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
      />

      {/* Top Left: Metro Agency & Coordinates Badge */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg shadow-xl">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold text-cyan-200 tracking-wide">
            {metro.agencyLabel}
          </span>
          <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">
            {metro.centerCoordinates}
          </span>
        </div>
      </div>

      {/* Top Right: Color Mode & Display Toggles */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-1 shadow-xl">
          <button
            onClick={() => onChangeColorMode('los')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              colorMode === 'los'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Highway Capacity Manual Level of Service (A to F)"
          >
            LOS Grade
          </button>
          <button
            onClick={() => onChangeColorMode('speed_deficit')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              colorMode === 'speed_deficit'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Speed Deficit (Free Flow vs Actual mph)"
          >
            Speed Deficit
          </button>
          <button
            onClick={() => onChangeColorMode('vc_ratio')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              colorMode === 'vc_ratio'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Volume to Capacity Ratio"
          >
            V/C Ratio
          </button>
          <button
            onClick={() => onChangeColorMode('emissions')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              colorMode === 'emissions'
                ? 'bg-rose-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="CO2 Emissions Intensity"
          >
            CO₂ Heatmap
          </button>
        </div>

        <button
          onClick={onToggleSensors}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg backdrop-blur-md border transition-all ${
            showSensors
              ? 'bg-sky-950/80 border-sky-500 text-sky-200'
              : 'bg-slate-900/80 border-slate-700 text-slate-400'
          }`}
          title="Toggle ITS Probe Telemetry Stations"
        >
          <Radio className="w-3.5 h-3.5 text-sky-400" />
          <span>Sensors</span>
        </button>

        <button
          onClick={onToggleParticles}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg backdrop-blur-md border transition-all ${
            showParticles
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
              : 'bg-slate-900/80 border-slate-700 text-slate-400'
          }`}
          title="Toggle Dynamic Traffic Particle Flow"
        >
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Flow</span>
        </button>
      </div>

      {/* Bottom Right: Map Zoom Controls */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-1 shadow-2xl">
        <button
          onClick={() => setZoom((z) => Math.min(3.2, z * 1.25))}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.6, z * 0.8))}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Reset Camera"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left: Map Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl p-3 shadow-2xl flex flex-col gap-2 max-w-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Network Legend</span>
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
            {colorMode.toUpperCase()}
          </span>
        </div>

        {colorMode === 'los' && (
          <div className="grid grid-cols-6 gap-1 text-[10px] text-center font-mono font-bold">
            <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded py-1">
              A
            </div>
            <div className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 rounded py-1">
              B
            </div>
            <div className="bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 rounded py-1">
              C
            </div>
            <div className="bg-orange-400/20 text-orange-300 border border-orange-400/40 rounded py-1">
              D
            </div>
            <div className="bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded py-1">
              E
            </div>
            <div className="bg-crimson-600/30 text-rose-300 border border-rose-600 rounded py-1 animate-pulse">
              F
            </div>
          </div>
        )}

        {colorMode === 'speed_deficit' && (
          <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Free-Flow
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> -15 mph
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Severe (-30+ mph)
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
          <span>Click road or sensor to inspect</span>
          <span className="text-slate-500 font-mono">Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
};
