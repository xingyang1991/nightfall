import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { A2UIAction, A2UIMessage, SurfaceComponentEntry } from './messages';
import { valueToPlain } from './bindings';

export interface SurfaceState {
  surfaceId: string;
  components: Record<string, any>;
  rootId?: string;
  dataModel: Record<string, any>;
  lastUpdatedTs: number;
}

export interface A2UIRuntime {
  surfaces: Record<string, SurfaceState>;
  applyMessages: (messages: A2UIMessage[]) => void;
  dispatchAction: (action: A2UIAction) => void;
}

/** Hook points for the host app to receive userAction events. */
const A2UIRuntimeContext = createContext<A2UIRuntime | null>(null);

export function useA2UIRuntime(): A2UIRuntime {
  const ctx = useContext(A2UIRuntimeContext);
  if (!ctx) throw new Error('useA2UIRuntime must be used within <A2UIRuntimeProvider>');
  return ctx;
}

export interface A2UIRuntimeProviderProps {
  onAction: (action: A2UIAction) => void;
  children: React.ReactNode;
}

function reduceSurfaceUpdate(prev: Record<string, SurfaceState>, surfaceId: string, entries: SurfaceComponentEntry[]): Record<string, SurfaceState> {
  const next = { ...prev };
  const cur = next[surfaceId] ?? { surfaceId, components: {}, dataModel: {}, lastUpdatedTs: Date.now() };
  const compMap: Record<string, any> = {};
  for (const e of entries) compMap[e.id] = e.component;
  next[surfaceId] = {
    ...cur,
    components: compMap,
    lastUpdatedTs: Date.now()
  };
  return next;
}

function reduceBeginRendering(prev: Record<string, SurfaceState>, surfaceId: string, root: string): Record<string, SurfaceState> {
  const next = { ...prev };
  const cur = next[surfaceId] ?? { surfaceId, components: {}, dataModel: {}, lastUpdatedTs: Date.now() };
  next[surfaceId] = { ...cur, rootId: root, lastUpdatedTs: Date.now() };
  return next;
}

function reduceDataModelUpdate(prev: Record<string, SurfaceState>, surfaceId: string, contents: Array<{ key: string; value: any }>): Record<string, SurfaceState> {
  const next = { ...prev };
  const cur = next[surfaceId] ?? { surfaceId, components: {}, dataModel: {}, lastUpdatedTs: Date.now() };

  const modelNext: Record<string, any> = { ...cur.dataModel };
  for (const item of contents) {
    modelNext[item.key] = valueToPlain(item.value);
  }

  next[surfaceId] = { ...cur, dataModel: modelNext, lastUpdatedTs: Date.now() };
  return next;
}

function reduceDeleteSurface(prev: Record<string, SurfaceState>, surfaceId: string): Record<string, SurfaceState> {
  const next = { ...prev };
  delete next[surfaceId];
  return next;
}

export const A2UIRuntimeProvider: React.FC<A2UIRuntimeProviderProps> = ({ onAction, children }) => {
  const [surfaces, setSurfaces] = useState<Record<string, SurfaceState>>({});

  const applyMessages = useCallback((messages: A2UIMessage[]) => {
    setSurfaces(prev => {
      let next = prev;
      for (const msg of messages) {
        if ('surfaceUpdate' in msg) {
          next = reduceSurfaceUpdate(next, msg.surfaceUpdate.surfaceId, msg.surfaceUpdate.components);
        } else if ('beginRendering' in msg) {
          next = reduceBeginRendering(next, msg.beginRendering.surfaceId, msg.beginRendering.root);
        } else if ('dataModelUpdate' in msg) {
          next = reduceDataModelUpdate(next, msg.dataModelUpdate.surfaceId, msg.dataModelUpdate.contents);
        } else if ('deleteSurface' in msg) {
          next = reduceDeleteSurface(next, msg.deleteSurface.surfaceId);
        }
      }
      return next;
    });
  }, []);

  const dispatchAction = useCallback((action: A2UIAction) => onAction(action), [onAction]);

  const runtime = useMemo<A2UIRuntime>(() => ({ surfaces, applyMessages, dispatchAction }), [surfaces, applyMessages, dispatchAction]);

  return (
    <A2UIRuntimeContext.Provider value={runtime}>
      {children}
    </A2UIRuntimeContext.Provider>
  );
};
