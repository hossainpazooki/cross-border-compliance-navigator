/**
 * Canvas Context
 * Provides canvas state and actions to all Decision Canvas components
 */

import {
  createContext,
  useReducer,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useResultsStore } from '@features/navigation/model';
import {
  panelsReducer,
  initialPanelsState,
  treeReducer,
  initialTreeState,
  canvasReducer,
  initialCanvasState,
} from '@app/reducers';
import type {
  PanelsState,
  TreeState,
  CanvasState,
  CanvasUIState,
  CanvasError,
  PanelId,
  HighlightSource,
} from '@/types/canvas';
import type { NavigateResponse } from '@/types/navigate';

// Context value interface
export interface CanvasContextValue {
  // Panel state
  panels: PanelsState;
  togglePanel: (id: PanelId) => void;
  expandPanel: (id: PanelId) => void;
  collapsePanel: (id: PanelId) => void;
  focusExpandPanel: (id: PanelId) => void;
  resetPanels: () => void;

  // Tree interaction state
  tree: TreeState;
  selectNode: (nodeId: string | null) => void;
  highlightNodes: (nodeIds: string[], source: HighlightSource) => void;
  clearHighlight: () => void;
  toggleGroup: (groupId: string) => void;
  expandGroup: (groupId: string) => void;
  collapseGroup: (groupId: string) => void;
  resetTree: () => void;

  // Global canvas state
  canvas: CanvasState;
  setCanvasState: (state: CanvasUIState) => void;
  setCanvasError: (error: CanvasError) => void;
  clearCanvasError: () => void;
  markInputsChanged: () => void;
  markInputsSynced: () => void;
  resetCanvas: () => void;

  // From results store
  navigationResult: NavigateResponse | null;
  analysisComplete: boolean;
}

// Create context with undefined default (must be used within provider)
export const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

// Provider props
interface CanvasProviderProps {
  children: ReactNode;
}

export function CanvasProvider({ children }: CanvasProviderProps) {
  // Reducers for local state
  const [panels, panelsDispatch] = useReducer(panelsReducer, initialPanelsState);
  const [tree, treeDispatch] = useReducer(treeReducer, initialTreeState);
  const [canvas, canvasDispatch] = useReducer(canvasReducer, initialCanvasState);

  // Pull from results store
  const { navigationResult, analysisComplete } = useResultsStore();

  // Panel actions
  const togglePanel = useCallback((id: PanelId) => {
    panelsDispatch({ type: 'TOGGLE', id });
  }, []);

  const expandPanel = useCallback((id: PanelId) => {
    panelsDispatch({ type: 'EXPAND', id });
  }, []);

  const collapsePanel = useCallback((id: PanelId) => {
    panelsDispatch({ type: 'COLLAPSE', id });
  }, []);

  const focusExpandPanel = useCallback((id: PanelId) => {
    panelsDispatch({ type: 'FOCUS_EXPAND', panelId: id });
  }, []);

  const resetPanels = useCallback(() => {
    panelsDispatch({ type: 'RESET' });
  }, []);

  // Tree actions
  const selectNode = useCallback((nodeId: string | null) => {
    treeDispatch({ type: 'SELECT', nodeId });
  }, []);

  const highlightNodes = useCallback((nodeIds: string[], source: HighlightSource) => {
    treeDispatch({ type: 'HIGHLIGHT', nodeIds, source });
  }, []);

  const clearHighlight = useCallback(() => {
    treeDispatch({ type: 'CLEAR_HIGHLIGHT' });
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    treeDispatch({ type: 'TOGGLE_GROUP', groupId });
  }, []);

  const expandGroup = useCallback((groupId: string) => {
    treeDispatch({ type: 'EXPAND_GROUP', groupId });
  }, []);

  const collapseGroup = useCallback((groupId: string) => {
    treeDispatch({ type: 'COLLAPSE_GROUP', groupId });
  }, []);

  const resetTree = useCallback(() => {
    treeDispatch({ type: 'RESET' });
  }, []);

  // Canvas actions
  const setCanvasState = useCallback((state: CanvasUIState) => {
    canvasDispatch({ type: 'SET_STATE', state });
  }, []);

  const setCanvasError = useCallback((error: CanvasError) => {
    canvasDispatch({ type: 'SET_ERROR', error });
  }, []);

  const clearCanvasError = useCallback(() => {
    canvasDispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const markInputsChanged = useCallback(() => {
    canvasDispatch({ type: 'MARK_INPUTS_CHANGED' });
  }, []);

  const markInputsSynced = useCallback(() => {
    canvasDispatch({ type: 'MARK_INPUTS_SYNCED' });
  }, []);

  const resetCanvas = useCallback(() => {
    canvasDispatch({ type: 'RESET' });
  }, []);

  // Memoize context value
  const value = useMemo<CanvasContextValue>(
    () => ({
      // Panels
      panels,
      togglePanel,
      expandPanel,
      collapsePanel,
      focusExpandPanel,
      resetPanels,
      // Tree
      tree,
      selectNode,
      highlightNodes,
      clearHighlight,
      toggleGroup,
      expandGroup,
      collapseGroup,
      resetTree,
      // Canvas
      canvas,
      setCanvasState,
      setCanvasError,
      clearCanvasError,
      markInputsChanged,
      markInputsSynced,
      resetCanvas,
      // From store
      navigationResult,
      analysisComplete,
    }),
    [
      panels,
      togglePanel,
      expandPanel,
      collapsePanel,
      focusExpandPanel,
      resetPanels,
      tree,
      selectNode,
      highlightNodes,
      clearHighlight,
      toggleGroup,
      expandGroup,
      collapseGroup,
      resetTree,
      canvas,
      setCanvasState,
      setCanvasError,
      clearCanvasError,
      markInputsChanged,
      markInputsSynced,
      resetCanvas,
      navigationResult,
      analysisComplete,
    ]
  );

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
}
