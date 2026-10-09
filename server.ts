import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI with User-Agent header as required
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint 1: Analyze Bottleneck & Forecast Breakdown
app.post('/api/ai/analyze-bottleneck', async (req: Request, res: Response) => {
  try {
    const {
      roadName,
      city,
      sensorId,
      currentYear,
      forecastYear,
      volumePerHour,
      capacityPerHour,
      vcRatio,
      currentSpeedMph,
      freeFlowSpeedMph,
      growthScenario,
      activeInterventions,
    } = req.body;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in the server environment.',
      });
    }

    const prompt = `You are a Senior Civil Transportation Systems Engineer and Traffic Modeling Specialist.
Perform an analytical bottleneck diagnosis and multi-year congestion risk assessment for the following road corridor:

- Corridor: ${roadName} in ${city} (Sensor Station ID: ${sensorId || 'VDS-Auto'})
- Baseline Timeline: ${currentYear} -> Forecasted Horizon: ${forecastYear}
- Volume to Capacity (V/C) Ratio: ${vcRatio.toFixed(2)} (${volumePerHour.toLocaleString()} vph / ${capacityPerHour.toLocaleString()} vph cap)
- Speed Deficit: Current ${currentSpeedMph} mph vs Free-Flow ${freeFlowSpeedMph} mph
- Growth Scenario: ${growthScenario}
- Active Interventions: ${activeInterventions && activeInterventions.length > 0 ? JSON.stringify(activeInterventions) : 'None (No-Build baseline)'}

Please provide a structured, high-authority engineering analysis in JSON format adhering strictly to this schema:
{
  "summary": "Crisp 2-sentence executive summary of the bottleneck severity and horizon breakdown risk",
  "levelOfService": "LOS grade (A, B, C, D, E, or F)",
  "breakdownYear": number (year between 2026 and 2035 where hyper-critical failure occurs or already occurred),
  "primaryPhysicsCauses": ["string", "string", "string"],
  "economicImpactAnnual": "e.g. $14.2M in annual lost commuter productivity and excess fuel",
  "recommendedInterventions": [
    {
      "name": "string title",
      "category": "Operational | Structural | Demand Management | Smart ITS",
      "estimatedCost": "string e.g. $4.5M",
      "expectedDelayReduction": "string e.g. 28% reduction in peak queue length",
      "implementationTimeline": "string e.g. 8-12 months",
      "rationale": "string technical justification using BPR delay curves and shockwave physics"
    }
  ],
  "braessParadoxWarning": "string noting any risk of induced demand or diverted queues onto adjacent arterials"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: unknown) {
    console.error('Error in /api/ai/analyze-bottleneck:', err);
    const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint 2: Evaluate Specific Proposed Infrastructure Intervention
app.post('/api/ai/propose-interventions', async (req: Request, res: Response) => {
  try {
    const {
      city,
      corridorName,
      interventionType,
      targetMetric,
      budgetRange,
      yearHorizon,
    } = req.body;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in the server environment.',
      });
    }

    const prompt = `You are a Principal Transportation Planner for ${city}.
Evaluate a proposed infrastructure improvement on "${corridorName}":
- Intervention Candidate: ${interventionType}
- Target Metric: ${targetMetric || 'Reduce peak hour bottleneck delay'}
- Target Horizon: ${yearHorizon || 2030}
- Budget Parameter: ${budgetRange || 'Optimized CapEx'}

Return a JSON assessment with:
{
  "projectTitle": "Engineering title of the initiative",
  "feasibilityScore": number (1-100),
  "benefitCostRatio": number (e.g. 3.4),
  "projectedLosShift": "e.g. LOS F -> LOS C",
  "dailyHoursSaved": number (total vehicle-hours of delay reduced per workday),
  "annualCo2ReductionTons": number,
  "constructionDisruptionSeverity": "Low | Moderate | Severe",
  "constructionDurationMonths": number,
  "keyPhasingSteps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "downstreamNetworkEffects": "Detailed comment on how traffic shifts to neighboring streets",
  "fundingProgramsEligible": ["e.g. FHWA BUILD Grant", "State DOT Highway Safety Improvement Program"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: unknown) {
    console.error('Error in /api/ai/propose-interventions:', err);
    const errorMessage = err instanceof Error ? err.message : 'Intervention proposal failed';
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint 3: Synthesize Corridor Audit
app.post('/api/ai/generate-audit-report', async (req: Request, res: Response) => {
  try {
    const { networkName, year, totalVmt, averageLos, topBottlenecks, activeProjects } = req.body;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in the server environment.',
      });
    }

    const prompt = `Generate a Formal Executive Transportation Infrastructure & Sensor Audit for the ${networkName} Regional Network for Year ${year}.
Network Metrics:
- Total Daily Vehicle Miles Traveled (VMT): ${totalVmt}
- Average Regional LOS: ${averageLos}
- Top Bottlenecks: ${JSON.stringify(topBottlenecks)}
- Planned / Active Capital Projects: ${JSON.stringify(activeProjects)}

Format the response as JSON:
{
  "reportTitle": "Title of the audit",
  "executiveSummary": "Paragraph summary for the City Council and Regional Transportation Planning Agency (MPO)",
  "infrastructureVulnerabilityRating": "Low | Moderate | Severe | Critical",
  "sensorNetworkHealthNote": "Commentary on telemetry coverage, loop detector calibration, and radar probe density",
  "priorityRecommendations": [
    {
      "rank": 1,
      "corridor": "string",
      "action": "string",
      "urgency": "Immediate (0-12mo) | Near-Term (1-3yr) | Long-Range (3-10yr)",
      "estimatedCapEx": "string"
    }
  ],
  "longRangeOutlook": "Projections for 2035+ considering EV fleet transition, remote work equilibrium, and induced demand."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: unknown) {
    console.error('Error in /api/ai/generate-audit-report:', err);
    const errorMessage = err instanceof Error ? err.message : 'Audit generation failed';
    res.status(500).json({ error: errorMessage });
  }
});

// Dev vs Prod Vite mounting
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UrbanPulse Traffic Modeling Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
