"use client";

// System map (010 FR-017..FR-021): d3 force layout drawn with React. Edge color/width by type and weight, nodes
// grouped by layer or proposal, severity highlighting, a toggleable legend and pan/zoom. The textual alternative
// (dependency and component tables) lives in the map step.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Component, DependencyGraph } from '@static-inference/schema';
import { edgeKey, edgeTypes, strokeWidth, type GroupMode } from '@/lib/modernization/graph-model';

type GraphEdge = DependencyGraph['edges'][number];

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  r: number;
  group: string;
}

const PALETTE = ['#4E79A7', '#E15759', '#59A14F', '#B07AA1', '#F28E2B', '#76B7B2', '#9C755F', '#EDC948', '#FF9DA7', '#86BCB6', '#A0CBE8', '#8CD17D'];
export function groupColor(groups: string[], g: string): string {
  const i = groups.indexOf(g);
  return i < 0 ? '#9AA4B6' : PALETTE[i % PALETTE.length];
}

/** Dash pattern per dependency type family, so the type is readable without color. */
function dashFor(types: string[]): string | undefined {
  if (types.some((t) => t.startsWith('injection') || t === 'registration')) return '5 3';
  if (types.includes('inheritance') || types.includes('extends') || types.includes('implements')) return '2 3';
  return undefined;
}

export default function ComponentGraph({
  components, edges, layoutEdges, groups, groupOf, highlighted, selectedId, onSelect, mode,
}: {
  components: readonly Component[];
  /** Visible (drawn) dependencies. */
  edges: readonly GraphEdge[];
  /** Every dependency: the layout does not move when the type filter changes. */
  layoutEdges: readonly GraphEdge[];
  groups: string[];
  groupOf: Map<string, string>;
  highlighted: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: GroupMode;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [hover, setHover] = useState<string | null>(null);
  const width = 1000;
  const height = 620;

  // Layout depends on the components, all edges and the grouping, never on the type filter (stable positions).
  const allEdgesKey = useMemo(() => layoutEdges.map(edgeKey).join('|'), [layoutEdges]);
  const layout = useMemo(() => {
    const maxLoc = Math.max(1, ...components.map((c) => c.loc));
    const nodes: SimNode[] = components.map((c) => ({ id: c.id, r: 4 + 10 * Math.sqrt(c.loc / maxLoc), group: groupOf.get(c.id) ?? '' }));
    const cols = Math.ceil(Math.sqrt(groups.length || 1));
    const rows = Math.ceil((groups.length || 1) / cols);
    const center = new Map(groups.map((g, i) => [g, { x: ((i % cols) + 0.5) * (width / cols), y: (Math.floor(i / cols) + 0.5) * (height / rows) }]));
    const ids = new Set(nodes.map((n) => n.id));
    const links = layoutEdges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ source: e.from, target: e.to }));
    const sim = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(40).strength(0.05))
      .force('charge', d3.forceManyBody().strength(nodes.length > 200 ? -18 : -45))
      .force('x', d3.forceX<SimNode>((d) => center.get(d.group)?.x ?? width / 2).strength(0.12))
      .force('y', d3.forceY<SimNode>((d) => center.get(d.group)?.y ?? height / 2).strength(0.12))
      .force('collide', d3.forceCollide<SimNode>((d) => d.r + 2))
      .stop();
    const ticks = Math.min(300, Math.max(120, Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()))));
    for (let i = 0; i < ticks; i++) sim.tick();
    return new Map(nodes.map((n) => [n.id, n]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, allEdgesKey, groups.join('|'), mode]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 6]).on('zoom', (ev) => setTransform(ev.transform));
    const sel = d3.select(svg);
    sel.call(zoom);
    return () => {
      sel.on('.zoom', null);
    };
  }, []);

  const maxWeight = Math.max(1, ...edges.map((e) => e.weight));
  const focus = hover ?? selectedId;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const e of edges) {
      if (e.from === focus) s.add(e.to);
      if (e.to === focus) s.add(e.from);
    }
    return s;
  }, [focus, edges]);
  const showLabels = components.length <= 40;

  return (
    <svg
      ref={svgRef}
      data-testid="map-canvas"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Mapa de ${components.length} componentes y ${edges.length} dependencias visibles`}
      className="h-[560px] w-full cursor-grab touch-none select-none rounded-md border border-border bg-background active:cursor-grabbing"
    >
      <defs>
        <marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--map-edge)" />
        </marker>
      </defs>
      <g transform={transform.toString()}>
        <g>
          {edges.map((e, i) => {
            const a = layout.get(e.from);
            const b = layout.get(e.to);
            if (!a || !b) return null;
            const types = edgeTypes(e);
            const dim = neighbours && !(neighbours.has(e.from) && neighbours.has(e.to));
            const dx = (b.x ?? 0) - (a.x ?? 0);
            const dy = (b.y ?? 0) - (a.y ?? 0);
            const len = Math.hypot(dx, dy) || 1;
            return (
              <line
                key={`${edgeKey(e)}#${i}`}
                data-testid="map-edge"
                data-from={e.from}
                data-to={e.to}
                data-types={types.join(',')}
                data-weight={e.weight}
                x1={a.x}
                y1={a.y}
                x2={(b.x ?? 0) - (dx / len) * (b.r + 2)}
                y2={(b.y ?? 0) - (dy / len) * (b.r + 2)}
                stroke="var(--map-edge)"
                strokeWidth={strokeWidth(e.weight, maxWeight)}
                strokeDasharray={dashFor(types)}
                strokeOpacity={dim ? 0.12 : 0.7}
                markerEnd="url(#map-arrow)"
              >
                <title>{`${e.from} → ${e.to} (${types.join(', ')}; peso ${e.weight})`}</title>
              </line>
            );
          })}
        </g>
        <g>
          {components.map((c) => {
            const n = layout.get(c.id);
            if (!n) return null;
            const hl = highlighted.has(c.id);
            const selected = c.id === selectedId;
            const dim = neighbours && !neighbours.has(c.id);
            return (
              <g
                key={c.id}
                data-testid="map-node"
                data-component-id={c.id}
                data-highlighted={hl ? 'true' : 'false'}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.25 : 1}
                onClick={() => onSelect(c.id)}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                <circle
                  r={n.r}
                  fill={groupColor(groups, n.group)}
                  stroke={hl ? 'var(--sev-critical)' : selected ? 'hsl(var(--foreground))' : 'var(--map-node)'}
                  strokeWidth={hl || selected ? 3 : 1.5}
                />
                <title>{`${c.id}\n${n.group}${c.code_issues.length ? `\n${c.code_issues.length} problemas` : ''}`}</title>
                {(showLabels || selected || hover === c.id) && (
                  <text x={n.r + 3} y={4} className="fill-foreground font-mono" fontSize={11} paintOrder="stroke" stroke="hsl(var(--background))" strokeWidth={3}>
                    {c.id.split('.').pop()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
