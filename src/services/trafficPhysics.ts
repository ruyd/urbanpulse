import {
  CalculatedRoadState,
  Intervention,
  LevelOfService,
  NetworkSimulationState,
  RoadSegment,
  ScenarioConfig,
  SensorStation,
} from '../types/traffic';

/**
 * Standard USDOT Value of Travel Time Savings (VTTS) in dollars per vehicle-hour
 */
export const USDOT_VTTS_DOLLARS_PER_HOUR = 33.50;

/**
 * Average CO2 emissions per vehicle mile at free-flow speed (~400 g/mile),
 * scaling up exponentially during stop-and-go idling congestion.
 */
export const BASE_CO2_GRAMS_PER_MILE = 404;

/**
 * Diurnal time-of-day multiplier curve.
 * Peak AM rush around 07:45 - 08:30 (peaks at ~1.38x base)
 * Midday lull around 12:00 - 13:30 (peaks at ~0.95x)
 * Peak PM rush around 17:15 - 18:15 (peaks at ~1.46x base)
 * Late night valley around 02:00 - 04:00 (~0.12x base)
 */
export function getDiurnalFactor(timeOfDayHours: number): number {
  const t = timeOfDayHours;

  // AM peak Gaussian centered at 7.75 hrs with width sigma=1.35
  const amPeak = 0.85 * Math.exp(-Math.pow(t - 7.75, 2) / (2 * Math.pow(1.35, 2)));

  // PM peak Gaussian centered at 17.5 hrs with width sigma=1.55
  const pmPeak = 0.95 * Math.exp(-Math.pow(t - 17.5, 2) / (2 * Math.pow(1.55, 2)));

  // Midday plateau centered at 12.5 hrs
  const midday = 0.50 * Math.exp(-Math.pow(t - 12.5, 2) / (2 * Math.pow(3.0, 2)));

  // Base background flow (off-peak minimum)
  const base = 0.14;

  return base + amPeak + pmPeak + midday;
}

/**
 * Bureau of Public Roads (BPR) Link Performance Function:
 * Travel Time = t_0 * [ 1 + alpha * (V / C)^beta ]
 * 
 * Free-flow travel time t_0 = (Length / FreeFlowSpeed) * 60 minutes
 */
export function calculateBPRTravelTime(
  volumeVph: number,
  capacityVph: number,
  freeFlowSpeedMph: number,
  lengthMiles: number,
  alpha = 0.15,
  beta = 4.0
): { travelTimeMinutes: number; speedMph: number; vcRatio: number } {
  const freeFlowMinutes = (lengthMiles / freeFlowSpeedMph) * 60;
  const safeCapacity = Math.max(capacityVph, 100);
  const vcRatio = volumeVph / safeCapacity;

  // BPR equation
  // Note: Cap VC exponential to avoid numerical explosion above 2.0
  const effectiveVc = Math.min(vcRatio, 2.4);
  const travelTimeMinutes = freeFlowMinutes * (1 + alpha * Math.pow(effectiveVc, beta));

  // Resulting average operating speed
  const speedMph = (lengthMiles / (travelTimeMinutes / 60));

  // Physically clamp speed: cannot exceed free-flow speed, cannot drop below 3.5 mph (crawling gridlock)
  const clampedSpeed = Math.max(3.5, Math.min(freeFlowSpeedMph, speedMph));

  return {
    travelTimeMinutes,
    speedMph: clampedSpeed,
    vcRatio,
  };
}

/**
 * Determine Highway Capacity Manual (HCM) Level of Service (LOS)
 */
export function getLevelOfService(vcRatio: number): LevelOfService {
  if (vcRatio <= 0.35) return 'A';
  if (vcRatio <= 0.55) return 'B';
  if (vcRatio <= 0.75) return 'C';
  if (vcRatio <= 0.90) return 'D';
  if (vcRatio <= 1.00) return 'E';
  return 'F'; // Breakdown / severe gridlock
}

/**
 * Calculate multi-year compound growth factor from base year 2026 to target year.
 */
export function getGrowthRateMultiplier(
  baseYear = 2026,
  targetYear: number,
  scenario: ScenarioConfig
): number {
  const yearsElapsed = Math.max(0, targetYear - baseYear);
  let annualRate = scenario.customAnnualGrowthRate;

  switch (scenario.growthPreset) {
    case 'baseline':
      annualRate = 0.021; // 2.1% annual growth
      break;
    case 'high_densification':
      annualRate = 0.038; // 3.8% rapid urban/commercial densification
      break;
    case 'transit_shift':
      annualRate = -0.009; // -0.9% mode shift to rail & remote work
      break;
    case 'ev_autonomous':
      annualRate = 0.027; // +2.7% VMT growth from autonomous empty deadheading
      break;
  }

  return Math.pow(1 + annualRate, yearsElapsed);
}

/**
 * Simulate the entire road network for a given scenario and set of interventions.
 */
export function simulateNetwork(
  roads: RoadSegment[],
  scenario: ScenarioConfig,
  interventions: Intervention[]
): NetworkSimulationState {
  const calculatedRoads: Record<string, CalculatedRoadState> = {};
  const growthMultiplier = getGrowthRateMultiplier(2026, scenario.year, scenario);
  const diurnalFactor = getDiurnalFactor(scenario.timeOfDayHours);

  // Weather impact multiplier
  let weatherSpeedFactor = 1.0;
  let weatherCapacityFactor = 1.0;
  if (scenario.weatherFactor === 'rain') {
    weatherSpeedFactor = 0.88;
    weatherCapacityFactor = 0.86;
  } else if (scenario.weatherFactor === 'fog') {
    weatherSpeedFactor = 0.92;
    weatherCapacityFactor = 0.94;
  } else if (scenario.weatherFactor === 'incident') {
    weatherCapacityFactor = 0.78;
  }

  let totalVMT = 0;
  let totalDailyDelayHours = 0;
  let weightedSpeedSum = 0;
  let totalVolumeSum = 0;
  let totalCo2KgPerHour = 0;

  const losCounts: Record<LevelOfService, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
  };

  const bottleneckList: CalculatedRoadState[] = [];

  for (const road of roads) {
    // Interventions applicable to this specific road or network-wide
    const activeRoadInterventions = interventions.filter(
      (inv) =>
        inv.enabled &&
        inv.targetYearAvailable <= scenario.year &&
        (inv.roadId === road.id || inv.roadId === 'network-wide')
    );

    // Baseline capacity
    let practicalCapacity = road.lanes * road.capacityPerLaneVph * weatherCapacityFactor;
    let freeFlowSpeed = road.freeFlowSpeedMph * weatherSpeedFactor;
    let delayFactor = 1.0;
    let inducedDemandVolumeBonus = 0;

    // Apply interventions
    for (const inv of activeRoadInterventions) {
      practicalCapacity *= inv.capacityMultiplier;
      delayFactor *= inv.delayReductionFactor;
      if (inv.freeFlowSpeedDeltaMph) {
        freeFlowSpeed += inv.freeFlowSpeedDeltaMph;
      }

      // Induced demand: if intervention has been active for more than 2 years,
      // it induces additional traffic volume (fundamental law of highway congestion)
      const yearsActive = scenario.year - inv.targetYearAvailable;
      if (yearsActive >= 2 && inv.inducedDemandRate > 0) {
        const addedCapacity = (inv.capacityMultiplier - 1.0) * (road.lanes * road.capacityPerLaneVph);
        if (addedCapacity > 0) {
          const inducedFraction = Math.min(1.0, 0.35 + (yearsActive - 2) * 0.15);
          inducedDemandVolumeBonus += addedCapacity * inv.inducedDemandRate * inducedFraction;
        }
      }
    }

    // Projected Volume for this hour
    const baselineVolume = (road.baseVolumeVph * growthMultiplier + inducedDemandVolumeBonus) * diurnalFactor;
    const volumeVph = Math.max(50, Math.round(baselineVolume));

    // Calculate BPR Travel Time
    const { travelTimeMinutes, speedMph, vcRatio } = calculateBPRTravelTime(
      volumeVph,
      practicalCapacity,
      freeFlowSpeed,
      road.lengthMiles,
      road.bprAlpha,
      road.bprBeta
    );

    const freeFlowMinutes = (road.lengthMiles / freeFlowSpeed) * 60;
    
    // Additional delay factor applied from smart ITS (e.g. ramp metering dampening shockwaves)
    const effectiveTravelTimeMinutes = freeFlowMinutes + (travelTimeMinutes - freeFlowMinutes) * delayFactor;
    const effectiveSpeedMph = Math.max(3.5, (road.lengthMiles / (effectiveTravelTimeMinutes / 60)));

    // Vehicle Hours of Delay (VHD) on this link during this hour
    const linkDelayHours = Math.max(0, (volumeVph * (effectiveTravelTimeMinutes - freeFlowMinutes)) / 60);

    const los = getLevelOfService(vcRatio);
    losCounts[los]++;

    // Environmental emissions (kg CO2 per hour)
    // Congestion penalty: idling and stop-and-go speed < 25 mph triples emission rate
    const speedPenalty = effectiveSpeedMph < 20 ? 2.3 : effectiveSpeedMph < 35 ? 1.4 : 1.0;
    const linkVmt = volumeVph * road.lengthMiles;
    const co2Kg = (linkVmt * BASE_CO2_GRAMS_PER_MILE * speedPenalty) / 1000;

    const isBottleneck = vcRatio >= 0.90 || effectiveSpeedMph < freeFlowSpeed * 0.55;
    const isBreakdown = vcRatio >= 1.05;

    const calcState: CalculatedRoadState = {
      road,
      volumeVph,
      practicalCapacityVph: Math.round(practicalCapacity),
      vcRatio,
      speedMph: Math.round(effectiveSpeedMph * 10) / 10,
      travelTimeMinutes: Math.round(effectiveTravelTimeMinutes * 10) / 10,
      freeFlowTravelTimeMinutes: Math.round(freeFlowMinutes * 10) / 10,
      delayHours: Math.round(linkDelayHours * 10) / 10,
      levelOfService: los,
      isBottleneck,
      isBreakdown,
      co2EmissionsKgPerHour: Math.round(co2Kg),
      activeInterventionsCount: activeRoadInterventions.length,
    };

    calculatedRoads[road.id] = calcState;

    if (isBottleneck) {
      bottleneckList.push(calcState);
    }

    totalVMT += linkVmt;
    totalDailyDelayHours += linkDelayHours;
    weightedSpeedSum += effectiveSpeedMph * volumeVph;
    totalVolumeSum += volumeVph;
    totalCo2KgPerHour += co2Kg;
  }

  // Sort bottlenecks by delay severity (highest delay first)
  bottleneckList.sort((a, b) => b.delayHours - a.delayHours);

  const averageSpeedMph = totalVolumeSum > 0 ? Math.round((weightedSpeedSum / totalVolumeSum) * 10) / 10 : 45;
  const totalCo2TonsPerDay = Math.round((totalCo2KgPerHour * 16) / 1000); // 16 operational daytime hours
  const annualWorkdays = 255;
  const economicCostOfDelayAnnualM = Math.round(
    ((totalDailyDelayHours * 12 * annualWorkdays * USDOT_VTTS_DOLLARS_PER_HOUR) / 1000000) * 10
  ) / 10;

  return {
    roads: calculatedRoads,
    totalVMT: Math.round(totalVMT),
    totalDailyDelayHours: Math.round(totalDailyDelayHours * 10) / 10,
    averageSpeedMph,
    totalCo2TonsPerDay,
    losCounts,
    economicCostOfDelayAnnualM,
    topBottlenecks: bottleneckList.slice(0, 5),
  };
}

/**
 * Greenshields Model: Generate a Flow vs Density curve for visualization
 * Speed u = u_f * (1 - k / k_jam)
 * Flow q = u * k = u_f * (k - k^2 / k_jam)
 * Critical density k_c = k_jam / 2
 * Max capacity q_max = (u_f * k_jam) / 4
 */
export function generateFundamentalDiagramData(
  freeFlowSpeedMph: number,
  capacityVphPerLane: number,
  lanes: number
) {
  const kJam = 140 * lanes; // jam density vehicles/mile
  const maxFlow = capacityVphPerLane * lanes;

  const points: Array<{ density: number; flow: number; speed: number }> = [];

  for (let k = 0; k <= kJam; k += 8) {
    const speed = Math.max(0, freeFlowSpeedMph * (1 - k / kJam));
    const flow = Math.round(k * speed);
    points.push({
      density: k,
      flow: Math.min(flow, maxFlow * 1.08),
      speed: Math.round(speed),
    });
  }

  return points;
}
