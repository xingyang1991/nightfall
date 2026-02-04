import path from 'node:path';
import { ToolBus } from '../runtime/toolbus/toolBus';

async function main() {
  process.env.NF_TOOL_MODE = 'record';
  process.env.NF_TOOL_RECORD_SOURCE = process.env.NF_TOOL_RECORD_SOURCE || 'stub';
  process.env.NF_TOOL_RECORD_PATH =
    process.env.NF_TOOL_RECORD_PATH || path.join('tests', 'fixtures', 'tool-record.json');

  const bus = new ToolBus({
    allowedTools: ['places.search', 'maps.link', 'weather.forecast'],
    mode: 'record'
  });

  await bus.placesSearch({ query: 'quiet cafe shanghai' });
  await bus.placesSearch({ query: 'bookstore xuhui' });
  await bus.weatherForecast({ grid_id: 'sh_cn_881', days: 1 });

  // eslint-disable-next-line no-console
  console.log(`tool recording complete -> ${process.env.NF_TOOL_RECORD_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
