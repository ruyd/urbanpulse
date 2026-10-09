export type RoadType = 'freeway' | 'arterial' | 'bridge' | 'tunnel' | 'collector' | 'toll_plaza';

export type LevelOfService = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type SensorType = 'dual_loop' | 'radar_probe' | 'bluetooth_reader' | 'wim_scale' | 'camera_ai';

export type SensorHealth = 'operational' | 'calibrating' | 'degraded' | 'offline';

export type GrowthPreset = 'baseline' | 'high_densification' | 'transit_shift' | 'ev_autonomous';

export type InterventionType =
  | 'ramp_metering'
  | 'adaptive_signals'
  | 'brt_lane'
  | 'flyover_overpass'
  | 'auxiliary_lane'
  | 'congestion_pricing'
  | 'shoulder_running';

export interface NodePoint {
  id: string;
  name: string;
  x: number; // 0 to 1000 canvas space
  y: number; // 0 to 700 canvas space
  type: 'intersection' | 'interchange' | 'ramp' | 'bridge_portal' | 'toll_plaza';
}

export interface RoadSegment {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  routeNumber: string; // e.g. "I-80", "US-101", "SR-520"
  type: RoadType;
  lanes: number;
  lengthMiles: number;
  freeFlowSpeedMph: number;
  capacityPerLaneVph: number;
  baseVolumeVph: number; // Base 2026 peak volume
  sensorId?: string;
  bprAlpha: number; // standard 0.15 for highways, 0.20 for arterials
  bprBeta: number;  // standard 4.0
  curveOffset?: number; // for curved SVG paths
}

export interface SensorHourlyData {
  hour: number; // 0-23
  volume: number;
  speed: number;
  occupancy: number; // 0-100%
}

export interface SensorYearlyTrend {
  year: number;
  avgDailyVolume: number;
  peakDelayMins: number;
}

export interface SensorStation {
  id: string; // e.g. "VDS-400129"
  roadId: string;
  name: string;
  agencySource: string; // "Caltrans PeMS", "WSDOT Loop Probes", "TxDOT ITS"
  type: SensorType;
  milepost: string;
  direction: 'NB' | 'SB' | 'EB' | 'WB' | 'Both';
  health: SensorHealth;
  x: number;
  y: number;
  currentReading: {
    volume5m: number;
    volumeHourlyEquivalent: number;
    speedMph: number;
    occupancyPct: number;
    truckPct: number;
    timestamp: string;
  };
  hourlyProfile: SensorHourlyData[];
  historicalTrajectory: SensorYearlyTrend[];
}

export interface Intervention {
  id: string;
  roadId: string; // specific road or 'network-wide'
  type: InterventionType;
  name: string;
  description: string;
  enabled: boolean;
  capExMillions: number;
  annualOpExThousands: number;
  capacityMultiplier: number; // e.g. 1.25 for +25% capacity
  delayReductionFactor: number; // e.g. 0.70 for -30% delay
  freeFlowSpeedDeltaMph?: number;
  inducedDemandRate: number; // fraction of added capacity that attracts new trips after 2 yrs
  targetYearAvailable: number; // year when construction finishes
}

export interface ScenarioConfig {
  year: number; // 2026 to 2035
  timeOfDayHours: number; // 0.0 to 24.0 (e.g. 7.75 for 07:45 AM)
  growthPreset: GrowthPreset;
  customAnnualGrowthRate: number; // e.g. 0.022 for 2.2%
  weatherFactor: 'clear' | 'rain' | 'fog' | 'incident';
}

export interface CalculatedRoadState {
  road: RoadSegment;
  volumeVph: number;
  practicalCapacityVph: number;
  vcRatio: number;
  speedMph: number;
  travelTimeMinutes: number;
  freeFlowTravelTimeMinutes: number;
  delayHours: number;
  levelOfService: LevelOfService;
  isBottleneck: boolean;
  isBreakdown: boolean; // vcRatio >= 1.05
  co2EmissionsKgPerHour: number;
  activeInterventionsCount: number;
}

export interface NetworkSimulationState {
  roads: Record<string, CalculatedRoadState>;
  totalVMT: number;
  totalDailyDelayHours: number;
  averageSpeedMph: number;
  totalCo2TonsPerDay: number;
  losCounts: Record<LevelOfService, number>;
  economicCostOfDelayAnnualM: number; // based on $33.50/hr USDOT value of time
  topBottlenecks: CalculatedRoadState[];
}

export interface MetroPreset {
  id: string;
  name: string;
  subtitle: string;
  agencyLabel: string;
  centerCoordinates: string;
  nodes: NodePoint[];
  roads: RoadSegment[];
  sensors: SensorStation[];
  defaultInterventions: Intervention[];
  backgroundFeatures?: {
    waterPolygons?: string[]; // SVG polygon points
    shorelines?: string[];    // SVG path data
    bridgeLabels?: Array<{ text: string, x: number, y: number }>;
    districts?: Array<{ name: string, x: number, y: number }>;
  };
}
