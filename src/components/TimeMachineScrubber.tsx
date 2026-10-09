import React, { useEffect, useState } from 'react';
import { GrowthPreset, ScenarioConfig } from '../types/traffic';
import {
  Calendar,
  Clock,
  CloudRain,
  Flame,
  Pause,
  Play,
  Sun,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react';

interface TimeMachineScrubberProps {
  scenario: ScenarioConfig;
  onChangeScenario: (updater: (prev: ScenarioConfig) => ScenarioConfig) => void;
}

export const TimeMachineScrubber: React.FC<TimeMachineScrubberProps> = ({
  scenario,
  onChangeScenario,
}) => {
  const [isPlayingYear, setIsPlayingYear] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 4x

  // Animation interval for year playback
  useEffect(() => {
    if (!isPlayingYear) return;

    const intervalMs = Math.round(1800 / playSpeed);
    const timer = setInterval(() => {
      onChangeScenario((prev) => {
        if (prev.year >= 2035) {
          setIsPlayingYear(false);
          return prev;
        }
        return { ...prev, year: prev.year + 1 };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlayingYear, playSpeed, onChangeScenario]);

  // Format hours float into 12-hour AM/PM string
  const formatTime = (hoursFloat: number): string => {
    const totalMinutes = Math.round(hoursFloat * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const displayMin = m < 10 ? `0${m}` : m;
    return `${displayHour}:${displayMin} ${ampm}`;
  };

  const handleYearChange = (year: number) => {
    onChangeScenario((prev) => ({ ...prev, year }));
  };

  const handleTimeChange = (timeOfDayHours: number) => {
    onChangeScenario((prev) => ({ ...prev, timeOfDayHours }));
  };

  const handlePresetScenario = (preset: GrowthPreset) => {
    onChangeScenario((prev) => ({ ...prev, growthPreset: preset }));
  };

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 px-6 py-4 shadow-2xl backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left: Year Scrubber & Horizon Time-Lapse */}
        <div className="flex-1 w-full lg:w-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Planning Horizon
              </span>
              <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-500/50 text-cyan-300 rounded font-mono font-bold text-sm">
                {scenario.year}
              </span>
              {scenario.year > 2026 && (
                <span className="text-[11px] text-cyan-400/80 font-mono">
                  (+{scenario.year - 2026} yr forecast)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsPlayingYear(!isPlayingYear)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                  isPlayingYear
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                }`}
                title="Play Multi-Year Time-Lapse Forecast"
              >
                {isPlayingYear ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Time-Lapse
                  </>
                )}
              </button>

              <button
                onClick={() => setPlaySpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono"
                title="Simulation Speed"
              >
                {playSpeed}x
              </button>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-mono">2026</span>
            <input
              type="range"
              min={2026}
              max={2035}
              step={1}
              value={scenario.year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[11px] text-slate-400 font-mono">2035</span>
          </div>

          {/* Year Tick Marks */}
          <div className="flex justify-between px-6 text-[10px] text-slate-500 font-mono">
            <span>'26</span>
            <span>'27</span>
            <span>'28</span>
            <span>'29</span>
            <span>'30</span>
            <span>'31</span>
            <span>'32</span>
            <span>'33</span>
            <span>'34</span>
            <span>'35</span>
          </div>
        </div>

        {/* Center: Time-of-Day Diurnal Slider */}
        <div className="w-full lg:w-80 flex flex-col gap-2 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Diurnal Period
              </span>
              <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-500/50 text-amber-300 rounded font-mono font-bold text-xs">
                {formatTime(scenario.timeOfDayHours)}
              </span>
            </div>

            {/* Quick Diurnal Presets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleTimeChange(7.75)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                  Math.abs(scenario.timeOfDayHours - 7.75) < 0.25
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="AM Peak Rush (07:45 AM)"
              >
                AM Peak
              </button>
              <button
                onClick={() => handleTimeChange(12.5)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                  Math.abs(scenario.timeOfDayHours - 12.5) < 0.25
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Midday Traffic (12:30 PM)"
              >
                Midday
              </button>
              <button
                onClick={() => handleTimeChange(17.5)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                  Math.abs(scenario.timeOfDayHours - 17.5) < 0.25
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="PM Peak Rush (05:30 PM)"
              >
                PM Peak
              </button>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={23.75}
            step={0.25}
            value={scenario.timeOfDayHours}
            onChange={(e) => handleTimeChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:45</span>
          </div>
        </div>

        {/* Right: Macro Scenario & Weather Impact */}
        <div className="w-full lg:w-auto flex flex-col gap-2 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Growth Driver
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handlePresetScenario('baseline')}
              className={`px-2.5 py-1 text-xs text-left rounded border transition-all ${
                scenario.growthPreset === 'baseline'
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px]">Baseline</div>
              <div className="text-[10px] text-slate-400">+2.1% / yr</div>
            </button>
            <button
              onClick={() => handlePresetScenario('high_densification')}
              className={`px-2.5 py-1 text-xs text-left rounded border transition-all ${
                scenario.growthPreset === 'high_densification'
                  ? 'bg-rose-950 border-rose-500 text-rose-200'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px]">High Density</div>
              <div className="text-[10px] text-slate-400">+3.8% / yr</div>
            </button>
            <button
              onClick={() => handlePresetScenario('transit_shift')}
              className={`px-2.5 py-1 text-xs text-left rounded border transition-all ${
                scenario.growthPreset === 'transit_shift'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px]">Transit Shift</div>
              <div className="text-[10px] text-slate-400">-0.9% / yr</div>
            </button>
            <button
              onClick={() => handlePresetScenario('ev_autonomous')}
              className={`px-2.5 py-1 text-xs text-left rounded border transition-all ${
                scenario.growthPreset === 'ev_autonomous'
                  ? 'bg-indigo-950 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-semibold text-[11px]">Autonomous AV</div>
              <div className="text-[10px] text-slate-400">+2.7% / yr</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
