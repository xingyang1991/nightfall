/**
 * A2UI-lite message model.
 * - We follow the core A2UI idea: a UI is updated by a stream of messages, each targeting a surfaceId.
 * - This implementation supports the minimum set to build the Nightfall demo:
 *   surfaceUpdate / dataModelUpdate / beginRendering / deleteSurface
 *
 * NOTE: This is intentionally strict and allowlist-based: the renderer only supports a known catalog.
 */

export type A2UIMessage =
  | { surfaceUpdate: SurfaceUpdate }
  | { dataModelUpdate: DataModelUpdate }
  | { beginRendering: BeginRendering }
  | { deleteSurface: DeleteSurface };

export interface DeleteSurface {
  surfaceId: string;
}

export interface BeginRendering {
  surfaceId: string;
  root: string;
}

/** A2UI component adjacency list entry. */
export interface SurfaceComponentEntry {
  id: string;
  component: A2UIComponent;
}

/**
 * A2UIComponent is a discriminated union encoded as:
 * { "<ComponentTypeName>": { ...props } }
 * Only one key is allowed.
 */
export type A2UIComponent = Record<string, unknown>;

export interface SurfaceUpdate {
  surfaceId: string;
  components: SurfaceComponentEntry[];
}

/** Data model update: typed values that are converted to plain JS. */
export interface DataModelUpdate {
  surfaceId: string;
  contents: Array<{ key: string; value: A2UIValue }>;
}

export type A2UIValue =
  | { valueString: string }
  | { valueNumber: number }
  | { valueBoolean: boolean }
  | { valueNull: null }
  | { valueList: A2UIValue[] }
  | { valueMap: Array<{ key: string; value: A2UIValue }> };

/** User actions bubble up from UI to the orchestrator. */
export interface A2UIAction {
  name: string;
  payload?: unknown;
  /**
   * Optional: a semantic channel/surface the action originated from.
   * Helpful for routing + analytics.
   */
  surfaceId?: string;
}

/** Parse either JSON array of messages or JSONL string into messages. */
export function parseA2UIMessages(input: string): A2UIMessage[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // If it looks like a JSON array, parse directly.
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed);
    if (!Array.isArray(arr)) throw new Error('A2UI parse: expected an array');
    return arr as A2UIMessage[];
  }

  // Otherwise treat as JSONL.
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    try {
      return JSON.parse(line) as A2UIMessage;
    } catch (e) {
      throw new Error(`A2UI parse: invalid JSON on line ${idx + 1}: ${line}`);
    }
  });
}
