import * as projectJson from './project-json.js';

const adapters = [projectJson];

// 첫 번째로 detect가 참인 어댑터를 돌려준다. 없으면 null.
export async function pickAdapter(doc, opts) {
  for (const adapter of adapters) {
    if (await adapter.detect(doc, opts)) return adapter;
  }
  return null;
}
