import fs from 'node:fs';
import path from 'node:path';

type Fixture = { id?: string; text: string };

const baseUrl = process.env.NF_API_BASE ?? 'http://localhost:4000';
const fixturesPath = process.env.NF_FIXTURES_PATH ?? path.join('tests', 'fixtures', 'requests.json');
const outDir = process.env.NF_ARTIFACTS_DIR ?? 'artifacts';

function defaultContext() {
  const now = new Date();
  return {
    time: {
      now_ts: now.toISOString(),
      time_band: 'prime',
      weekday: now.getDay() || 7,
      local_holiday_flag: false
    },
    location: {
      grid_id: 'sh_cn_881',
      city_id: 'Shanghai',
      place_context: 'unknown',
      location_quality: 'ok'
    },
    mobility: {
      motion_state: 'still',
      transport_mode: 'walk',
      eta_min: 0
    },
    user_state: {
      mode: 'immersion',
      energy_band: 'mid',
      social_temp: 1,
      stealth: false
    }
  };
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const raw = fs.readFileSync(fixturesPath, 'utf-8');
  const fixtures: Fixture[] = JSON.parse(raw);
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error(`No fixtures found in ${fixturesPath}`);
  }

  const context = defaultContext();
  const boot = await postJson(`${baseUrl}/api/bootstrap`, { context });
  const sessionId = boot.sessionId;

  const outputs: any[] = [];
  for (const f of fixtures) {
    const action = { name: 'TONIGHT_SUBMIT_ORDER', payload: { text: f.text } };
    const out = await postJson(`${baseUrl}/api/action`, { sessionId, context, action });
    outputs.push({ id: f.id ?? f.text.slice(0, 24), input: f.text, output: out });
  }

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `fixtures-run-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ baseUrl, sessionId, outputs }, null, 2));

  // eslint-disable-next-line no-console
  console.log(`fixtures complete: ${outputs.length} cases -> ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
