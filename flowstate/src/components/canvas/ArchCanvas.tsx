"use client";

import { useCallback, useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, ReactFlow, type NodeChange } from "@xyflow/react";
import type { EdgeDef, NodeDef, Projection } from "@/engine/types";
import { ArchNode, type ArchNodeType } from "./ArchNode";
import { FlowEdge, type FlowEdgeType } from "./FlowEdge";

const nodeTypes = { arch: ArchNode };
const edgeTypes = { flow: FlowEdge };

interface Props {
  nodeDefs: NodeDef[];
  edgeDefs: EdgeDef[];
  projection: Projection;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ArchCanvas({ nodeDefs, edgeDefs, projection, selectedId, onSelect }: Props) {
  const built = useMemo<ArchNodeType[]>(
    () =>
      nodeDefs.map((def) => {
        const isBoundary = def.kind === "boundary";
        return {
          id: def.id,
          type: "arch",
          position: def.position,
          width: def.size.w,
          height: def.size.h,
          zIndex: isBoundary ? -1 : 1,
          selectable: !isBoundary,
          draggable: !isBoundary,
          focusable: !isBoundary,
          selected: selectedId === def.id,
          ariaLabel: `${def.label}. Press Enter for details.`,
          data: { def, view: projection.nodes[def.id] ?? { tone: "idle" } },
        };
      }),
    [nodeDefs, projection.nodes, selectedId],
  );

  // Keep user-dragged positions while live data updates.
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const nodes = useMemo(() => built.map((n) => (offsets[n.id] ? { ...n, position: offsets[n.id] } : n)), [built, offsets]);

  const onNodesChange = useCallback((changes: NodeChange<ArchNodeType>[]) => {
    setOffsets((o) => {
      let next = o;
      for (const c of changes) {
        if (c.type === "position" && c.position) next = { ...next, [c.id]: c.position };
      }
      return next;
    });
  }, []);

  const edges = useMemo<FlowEdgeType[]>(
    () =>
      edgeDefs.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "flow",
        selectable: false,
        focusable: false,
        data: { view: projection.edges[e.id] ?? { tone: "idle" as const, dots: 0, hidden: true } },
      })),
    [edgeDefs, projection.edges],
  );

  return (
    <div className="flow-canvas h-full w-full">
      <ReactFlow<ArchNodeType, FlowEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#232b2f" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
