import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { DecisionNode, TraceNode, LeafNode, ConditionNode } from '@/types/decisionTree';
import type { JurisdictionCode } from '@/types/common';
import { isLeafNode, isGroupNode } from '@/types/decisionTree';
import { calculateLayout, getPathFromTrace, DEFAULT_LAYOUT_CONFIG } from '../lib/treeLayout';
import { TreeNode } from './TreeNode';
import { TreeEdge } from './TreeEdge';
import { Card, CardHeader, CardTitle, CardContent } from '@shared/ui';

export type HighlightSource = 'jurisdiction' | 'pathway' | 'conflict' | 'decoder' | 'search';
export type ViewMode = 'baseline' | 'whatif-diff' | 'conflict-overlay';

interface ScenarioDiffOverlay {
  baselineLeafId?: string;
  whatIfLeafId?: string;
  changedNodeIds?: string[];
}

interface DecisionTreeViewerProps {
  tree: DecisionNode;
  trace?: TraceNode[];
  finalNode?: LeafNode;
  title?: string;
  onNodeSelect?: (node: DecisionNode) => void;

  // Highlighting
  highlightedNodeIds?: Set<string>;
  highlightSource?: HighlightSource;

  // Filtering
  jurisdictionFilter?: JurisdictionCode | null;

  // View modes
  viewMode?: ViewMode;
  diffOverlay?: ScenarioDiffOverlay;

  // Events
  onNodeHover?: (nodeId: string | null) => void;
  onGroupToggle?: (groupId: string, expanded: boolean) => void;

  // Collapsed groups state
  collapsedGroups?: Set<string>;

  // External zoom/pan control
  externalZoom?: number;
  externalPan?: { x: number; y: number };
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;

  className?: string;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export function DecisionTreeViewer({
  tree,
  trace,
  finalNode,
  title = 'Decision Tree',
  onNodeSelect,
  highlightedNodeIds,
  highlightSource,
  jurisdictionFilter: _jurisdictionFilter,
  viewMode = 'baseline',
  diffOverlay: _diffOverlay,
  onNodeHover,
  onGroupToggle,
  collapsedGroups: externalCollapsedGroups,
  externalZoom,
  externalPan,
  onZoomChange,
  onPanChange,
  className,
}: DecisionTreeViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [internalTransform, setInternalTransform] = useState<Transform>({ x: 0, y: 0, scale: 0.65 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [internalCollapsedGroups, setInternalCollapsedGroups] = useState<Set<string>>(new Set());

  // Use external or internal state
  const transform = useMemo(
    () =>
      externalPan && externalZoom !== undefined
        ? { x: externalPan.x, y: externalPan.y, scale: externalZoom }
        : internalTransform,
    [externalPan, externalZoom, internalTransform],
  );

  const setTransform = useCallback((updater: Transform | ((prev: Transform) => Transform)) => {
    if (externalPan && externalZoom !== undefined) {
      const newTransform = typeof updater === 'function' ? updater(transform) : updater;
      onZoomChange?.(newTransform.scale);
      onPanChange?.({ x: newTransform.x, y: newTransform.y });
    } else {
      setInternalTransform(updater as Transform | ((prev: Transform) => Transform));
    }
  }, [externalPan, externalZoom, transform, onZoomChange, onPanChange]);

  const collapsedGroups = externalCollapsedGroups ?? internalCollapsedGroups;

  // Calculate path nodes from trace
  const pathNodeIds = useMemo(() => {
    if (!trace) return new Set<string>();
    const ids = getPathFromTrace(trace);
    if (finalNode) {
      ids.add(finalNode.nodeId);
    }
    return ids;
  }, [trace, finalNode]);

  // Combined highlight set (trace path + external highlights)
  const allHighlightedIds = useMemo(() => {
    const ids = new Set(pathNodeIds);
    if (highlightedNodeIds) {
      highlightedNodeIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [pathNodeIds, highlightedNodeIds]);

  // Calculate layout
  const layout = useMemo(() => {
    return calculateLayout(tree, DEFAULT_LAYOUT_CONFIG, allHighlightedIds);
  }, [tree, allHighlightedIds]);

  // Center tree at top on initial load
  useEffect(() => {
    if (hasInitialized || !svgRef.current || layout.nodes.length === 0) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const scale = 0.65;

    // Center the entire tree layout horizontally
    const treeCenterX = layout.width / 2;
    const x = (svgRect.width / 2) - (treeCenterX * scale);

    // Position tree near top with padding
    const y = 30;

    setInternalTransform({ x, y, scale });
    setHasInitialized(true);
  }, [layout, hasInitialized]);

  // Find node by ID (handles all node types including GroupNode)
  const findNodeById = useCallback((nodeId: string): DecisionNode | null => {
    function search(node: DecisionNode): DecisionNode | null {
      if (node.nodeId === nodeId) return node;
      if (isLeafNode(node)) return null;
      if (isGroupNode(node)) {
        for (const child of node.children) {
          const found = search(child);
          if (found) return found;
        }
        return null;
      }
      if (node.type === 'condition') {
        return search(node.children.true) || search(node.children.false);
      }
      return null;
    }
    return search(tree);
  }, [tree]);

  // Handle group toggle
  const handleGroupToggle = useCallback((groupId: string) => {
    const isCollapsed = collapsedGroups.has(groupId);
    if (onGroupToggle) {
      onGroupToggle(groupId, !isCollapsed);
    } else {
      setInternalCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (isCollapsed) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        return next;
      });
    }
  }, [collapsedGroups, onGroupToggle]);

  // Get hovered node details
  const hoveredNode = hoveredNodeId ? findNodeById(hoveredNodeId) : null;

  // Handle hover with external callback
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
    onNodeHover?.(nodeId);
  }, [onNodeHover]);

  // Get highlight color based on source
  const getHighlightColor = useCallback((nodeId: string): string | undefined => {
    if (!highlightedNodeIds?.has(nodeId)) return undefined;
    switch (highlightSource) {
      case 'jurisdiction':
        return '#22d3ee'; // cyan
      case 'pathway':
        return '#a855f7'; // purple
      case 'conflict':
        return '#ef4444'; // red
      case 'decoder':
        return '#f59e0b'; // amber
      case 'search':
        return '#10b981'; // emerald
      default:
        return '#22d3ee';
    }
  }, [highlightedNodeIds, highlightSource]);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = findNodeById(nodeId);
    if (node && onNodeSelect) {
      onNodeSelect(node);
    }
  }, [findNodeById, onNodeSelect]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  }, [isDragging, dragStart, setTransform]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * delta, 0.25), 2),
    }));
  }, [setTransform]);

  // Reset view to centered tree at 65%
  const handleReset = useCallback(() => {
    if (!svgRef.current || layout.nodes.length === 0) {
      setTransform({ x: 0, y: 0, scale: 0.65 });
      return;
    }

    const svgRect = svgRef.current.getBoundingClientRect();
    const scale = 0.65;

    const treeCenterX = layout.width / 2;
    const x = (svgRect.width / 2) - (treeCenterX * scale);
    const y = 30;

    setTransform({ x, y, scale });
  }, [layout, setTransform]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 2) }));
  }, [setTransform]);

  const handleZoomOut = useCallback(() => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.25) }));
  }, [setTransform]);

  return (
    <Card variant="bordered" className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span className="text-blue-400">🌳</span>
          {title}
          {viewMode !== 'baseline' && (
            <span className="ml-2 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              {viewMode === 'whatif-diff' ? 'What-If' : 'Conflicts'}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="rounded bg-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-600"
          >
            -
          </button>
          <span className="text-xs text-slate-400 w-12 text-center">
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="rounded bg-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-600"
          >
            +
          </button>
          <button
            onClick={handleReset}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          >
            Reset
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            width="100%"
            height="500"
            className="bg-slate-900 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <defs>
              {/* Grid pattern */}
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Transformed content */}
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
              {/* Edges (rendered first, below nodes) */}
              {layout.edges.map(edge => (
                <TreeEdge key={edge.id} edge={edge} />
              ))}

              {/* Nodes */}
              {layout.nodes.map(layoutNode => (
                <TreeNode
                  key={layoutNode.id}
                  layoutNode={layoutNode}
                  isSelected={selectedNodeId === layoutNode.id}
                  isHighlighted={highlightedNodeIds?.has(layoutNode.id)}
                  highlightColor={getHighlightColor(layoutNode.id)}
                  isCollapsed={collapsedGroups.has(layoutNode.id)}
                  viewMode={viewMode}
                  onSelect={handleNodeSelect}
                  onHover={handleNodeHover}
                  onGroupToggle={handleGroupToggle}
                />
              ))}
            </g>
          </svg>

          {/* Hover tooltip */}
          {hoveredNode && (
            <div className="absolute top-2 left-2 max-w-xs rounded-lg bg-slate-800 p-3 shadow-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">
                {isLeafNode(hoveredNode) ? 'Leaf Node' : 'Condition Node'}
              </p>
              {isLeafNode(hoveredNode) ? (
                <>
                  <p className="text-sm text-white font-medium">{hoveredNode.decision}</p>
                  {hoveredNode.obligations && hoveredNode.obligations.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400">Obligations:</p>
                      <ul className="text-xs text-slate-300 mt-1">
                        {hoveredNode.obligations.slice(0, 3).map((ob, i) => (
                          <li key={i}>• {ob}</li>
                        ))}
                        {hoveredNode.obligations.length > 3 && (
                          <li className="text-slate-500">+{hoveredNode.obligations.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-white font-medium">
                    {(hoveredNode as ConditionNode).annotation ||
                     `${(hoveredNode as ConditionNode).condition.fact} ${(hoveredNode as ConditionNode).condition.op}`}
                  </p>
                  {(hoveredNode as ConditionNode).sourceRef && (
                    <p className="text-xs text-blue-400 mt-1">
                      {(hoveredNode as ConditionNode).sourceRef?.document_id} Art. {(hoveredNode as ConditionNode).sourceRef?.article}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-2 right-2 rounded-lg bg-slate-800/90 p-2 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-cyan-500/50 border border-cyan-400" />
                <span className="text-slate-400">Evaluation Path</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-slate-400">Condition</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-400">Leaf</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
