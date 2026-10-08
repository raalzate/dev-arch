

"use client";

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { ArchitectureData, Component, ComponentsData, Proposal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Cable, Layers, Filter, Blocks, Save, Package, GitBranch, Code, Network, Users } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from './ui/separator';
import ComponentDetails from './component-details';
import CodeViewer from './code-viewer';

const inferLayer = (componentId: string, component?: Component): string => {
    if (component?.layer) return component.layer;
    const id = componentId.toLowerCase();
    if (id.includes('controller')) return 'controller';
    if (id.includes('service') || id.includes('implementation')) return 'service';
    if (id.includes('repository') || id.includes('repo')) return 'repository';
    if (id.includes('model') || id.includes('entity')) return 'model';
    if (id.includes('dto')) return 'dto';
    if (id.includes('config')) return 'config';
    if (id.includes('exception')) return 'exception';
    if (id.includes('enumeration')) return 'enumeration';
    return 'N/A';
};


interface ComponentGraphProps {
  componentsData: ComponentsData;
  archData: ArchitectureData;
  isGraphTabActive: boolean;
  onComponentUpdate: (updatedComponent: Component, newClusterId: number) => void;
  showDetails: (title: string, content: React.ReactNode) => void;
}

const ComponentGraph: React.FC<ComponentGraphProps> = ({ componentsData, archData, isGraphTabActive, onComponentUpdate, showDetails }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Component | null>(null);
  const [clusterNameMap, setClusterNameMap] = useState<Map<number, string>>(new Map());

  const allLayers = React.useMemo(() => {
    if (!componentsData) return [];
    const layers = new Set(componentsData.components.map(c => inferLayer(c.id, c)));
    return Array.from(layers);
  }, [componentsData]);

  const allClusters = React.useMemo(() => {
    if (!archData?.proposals) return [];
    return archData.proposals.map(p => p.id);
  }, [archData]);

  const [selectedLayers, setSelectedLayers] = useState<string[]>(allLayers);
  const [selectedClusters, setSelectedClusters] = useState<number[]>(allClusters);


  useEffect(() => {
    const newClusterNameMap = new Map<number, string>();
    archData?.proposals?.forEach(p => {
        newClusterNameMap.set(p.id, p.name);
    });
    setClusterNameMap(newClusterNameMap);
  }, [archData]);

  useEffect(() => {
    setSelectedLayers(allLayers);
  }, [allLayers]);

  useEffect(() => {
    setSelectedClusters(allClusters);
  }, [allClusters]);

  useEffect(() => {
    if (!isGraphTabActive || !componentsData || !archData || !containerRef.current) return;
    
    const timer = setTimeout(() => {
      renderGraph();
    }, 100);

    return () => clearTimeout(timer);
  }, [isGraphTabActive, componentsData, archData, selectedLayers, selectedClusters, rendered]);

  const renderGraph = () => {
    if (!containerRef.current || !componentsData || !archData?.proposals) return;
    setRendered(true);

    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // --- 1. Data Prep ---
    const clusterMap = new Map<string, number>();
    archData.proposals.forEach(p => {
      p.components?.forEach(compId => clusterMap.set(compId, p.id));
    });

    const componentsWithLayers = componentsData.components.map(c => ({
        ...c,
        layer: inferLayer(c.id, c)
    }))

    const filteredComponents = componentsWithLayers.filter(c => {
        const clusterId = clusterMap.get(c.id);
        const inSelectedLayer = selectedLayers.includes(c.layer || 'N/A');
        // Include unclustered nodes if no specific cluster is being filtered, or handle them as a separate category if needed
        const inSelectedCluster = clusterId !== undefined ? selectedClusters.includes(clusterId) : true;
        return inSelectedLayer && inSelectedCluster;
    });

    const visibleNodeIds = new Set(filteredComponents.map(c => c.id));
    const locById = new Map(componentsData.components.map(c => [c.id, c.loc || 1]));

    const nodes = filteredComponents.map(c => ({
      ...c, // keep original component data
      id: c.id,
      layer: c.layer || 'N/A',
      loc: c.loc || 1,
      clusterId: clusterMap.get(c.id) ?? 'default',
      clusterName: clusterNameMap.get(clusterMap.get(c.id)!) || 'Sin cluster'
    }));

    const links = componentsData.edges
      .filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
      .map(e => ({ 
        source: e.from, 
        target: e.to,
        loc: (locById.get(e.from)! + locById.get(e.to)!) / 2
      }));
    
    const maxLinkLoc = Math.max(...links.map(l => l.loc), 1);
    const strokeWidthScale = d3.scaleSqrt().domain([1, maxLinkLoc]).range([1, 10]);

    const maxNodeLoc = Math.max(...nodes.map(n => n.loc), 1);
    const radiusScale = d3.scaleSqrt().domain([1, maxNodeLoc]).range([5, 40]);

    // --- Color Scale ---
    const clusterIds = Array.from(clusterNameMap.keys());
    const layerNames = allLayers;
    const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(clusterIds.map(String));
    const layerColorScale = d3.scaleOrdinal(d3.schemePaired).domain(layerNames);


    // --- 2. SVG and Simulation Setup ---
    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [-width / 2, -height / 2, width, height]);

    const g = svg.append("g");

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.05))
      .force("y", d3.forceY().strength(0.05))
      .force("collide", d3.forceCollide((d:any) => radiusScale(d.loc) + 5).strength(1));

    // --- 3. Render Elements ---
    const nodesByCluster = d3.group(nodes.filter(n => n.clusterId !== 'default'), d => d.clusterId);

    const hull = g.append("g")
      .selectAll("path")
      .data(Array.from(nodesByCluster.values()))
      .join("path")
      .attr("fill", d => clusterColorScale(String(d[0].clusterId)))
      .attr("stroke", d => clusterColorScale(String(d[0].clusterId)))
      .attr("stroke-width", 15)
      .attr("stroke-linejoin", "round")
      .style("opacity", 0.15);


    const link = g.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => strokeWidthScale(d.loc));

    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => radiusScale(d.loc))
      .attr("fill", d => layerColorScale(d.layer))
      .attr("stroke", d => {
        if (d.clusterId === 'default') {
          return '#fff';
        }
        return clusterColorScale(String(d.clusterId));
      })
      .attr("stroke-width", 4)
      .style("cursor", "pointer")
      .call(drag(simulation) as any);
      
    const tooltip = d3.select(tooltipRef.current);
    
    node.on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
          .html(`<strong>ID:</strong> ${d.id}<br><strong>Cluster:</strong> ${d.clusterName}<br><strong>Capa:</strong> ${d.layer}<br><strong>LOC:</strong> ${d.loc}`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 15) + "px")
               .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      })
      .on("click", (event, d) => {
        const fullComponentData = componentsWithLayers.find(c => c.id === d.id);
        if (fullComponentData) {
            setSelectedNode(fullComponentData);
        }
      });

    const hullPadding = 40;
    const polygonGenerator = (d: any[]) => {
      if (d.length < 3) return null; // Hull requires at least 3 points
      const points = d.map(i => [(i as any).x, (i as any).y]);
      const hullPoints = d3.polygonHull(points as [number, number][]);
      if (!hullPoints) return null;

      // Expand the hull
      const centroid = d3.polygonCentroid(hullPoints);
      return hullPoints.map(p => {
          const dx = p[0] - centroid[0];
          const dy = p[1] - centroid[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return p;
          const newX = p[0] + (dx / dist) * hullPadding;
          const newY = p[1] + (dy / dist) * hullPadding;
          return [newX, newY];
      }).join(" ");
    };

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node
        .attr("cx", d => (d as any).x)
        .attr("cy", d => (d as any).y);
        
      hull.attr("d", d => {
          const points = polygonGenerator(d);
          return points ? `M${points}Z` : '';
      });
    });

    // --- 4. Interactions ---
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 8])
      .on("zoom", ({ transform }) => {
        g.attr("transform", transform);
      }) as any);
      
    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
        function dragstarted(event: d3.D3DragEvent<any, any, any>, d: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event: d3.D3DragEvent<any, any, any>, d: any) {
            d.fx = event.x;
            d.fy = event.y;
        }
        function dragended(event: d3.D3DragEvent<any, any, any>, d: any) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }
  }

  const handleLayerSelection = (layer: string) => {
    setSelectedLayers(prev => 
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  const handleClusterSelection = (clusterId: number) => {
    setSelectedClusters(prev => 
      prev.includes(clusterId) ? prev.filter(id => id !== clusterId) : [...prev, clusterId]
    );
  };

  const Legend = () => {
    if (!archData?.proposals) return null;

    const clusterIds = Array.from(clusterNameMap.keys());
    const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(clusterIds.map(String));
    const clusterItems = Array.from(clusterNameMap.entries()).map(([id, name]) => ({
        key: `cluster-${id}`,
        color: clusterColorScale(String(id)),
        label: name,
        type: 'border'
    }));

    const layerColorScale = d3.scaleOrdinal(d3.schemePaired).domain(allLayers);
    const layerItems = allLayers.map(layer => ({
        key: `layer-${layer}`,
        color: layerColorScale(layer),
        label: layer,
        type: 'fill'
    }));
    
    return (
      <div className="mb-4 space-y-4">
        <div>
            <h3 className="text-md font-semibold mb-2">Leyenda de Capas (Color de Relleno)</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {layerItems.map(item => (
                    <div key={item.key} className="flex items-center">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
         <div>
            <h3 className="text-md font-semibold mb-2">Leyenda de Clusters (Color de Borde)</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {clusterItems.map(item => (
                    <div key={item.key} className="flex items-center">
                       <div className="w-4 h-4 rounded-full mr-2 border-4" style={{ borderColor: item.color }}></div>
                       <span className="text-sm">{item.label}</span>
                    </div>
                ))}
                 <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full mr-2 border-4" style={{ borderColor: '#fff' }}></div>
                    <span className="text-sm">Sin cluster</span>
                </div>
            </div>
        </div>
      </div>
    );
  };

  const DetailDialog = () => {
    if (!selectedNode || !archData?.proposals) return null;
    
    const originalClusterId = archData.proposals.find(p => p.components?.includes(selectedNode.id))?.id;
    const [newClusterId, setNewClusterId] = useState<number | undefined>(originalClusterId);
    
    const handleSave = () => {
      if (selectedNode && newClusterId !== undefined) {
        onComponentUpdate(selectedNode, newClusterId);
        setSelectedNode(null);
      }
    };
    
    const clusterName = originalClusterId !== undefined ? clusterNameMap.get(originalClusterId) : 'Sin cluster';
    

    return (
      <Dialog open={!!selectedNode} onOpenChange={(isOpen) => {
        if (!isOpen) setSelectedNode(null);
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-primary truncate">Detalles del Componente</DialogTitle>
            <DialogDescription className="truncate font-mono">{selectedNode.id}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-6">
                <ComponentDetails 
                    component={selectedNode} 
                    showDetails={showDetails} 
                    inferLayer={inferLayer} 
                />
          </ScrollArea>
          <Separator className="my-4" />
          <div className="space-y-2">
            <Label htmlFor="cluster-select" className="flex items-center"><Users className="h-4 w-4 mr-2" />Mover a otro Cluster</Label>
            <Select
              value={newClusterId?.toString()}
              onValueChange={(value) => setNewClusterId(Number(value))}
            >
              <SelectTrigger id="cluster-select">
                <SelectValue placeholder="Selecciona un nuevo cluster..." />
              </SelectTrigger>
              <SelectContent>
                {archData.proposals.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} (ID: {p.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
              <DialogClose asChild>
                  <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={newClusterId === originalClusterId || newClusterId === undefined}>
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  return (
    <div className="w-full relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center"><Cable className="mr-2 h-5 w-5"/>Grafo de Dependencias</h2>
        <div className="text-xs text-muted-foreground">Usa el scroll para hacer zoom y arrastra para mover el grafo/nodos.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center"><Filter className="mr-2 h-4 w-4"/>Filtrar por Capa</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-normal">
                    Mostrando {selectedLayers.length} de {allLayers.length} capas
                </Label>
                <div>
                    <Button variant="link" size="sm" className="p-0 h-auto mr-2" onClick={() => setSelectedLayers(allLayers)}>Todas</Button>
                    <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setSelectedLayers([])}>Ninguna</Button>
                </div>
            </div>
            <ScrollArea className="h-24 w-full pr-4">
              <div className="space-y-2">
              {allLayers.map(layer => (
                <div key={layer} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`check-layer-${layer}`}
                    checked={selectedLayers.includes(layer)} 
                    onCheckedChange={() => handleLayerSelection(layer)}
                  />
                  <Label htmlFor={`check-layer-${layer}`} className="font-normal text-sm">{layer}</Label>
                </div>
              ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center"><Blocks className="mr-2 h-4 w-4"/>Filtrar por Cluster</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-normal">
                    Mostrando {selectedClusters.length} de {allClusters.length} clusters
                </Label>
                <div>
                    <Button variant="link" size="sm" className="p-0 h-auto mr-2" onClick={() => setSelectedClusters(allClusters)}>Todos</Button>
                    <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setSelectedClusters([])}>Ninguno</Button>
                </div>
            </div>
            <ScrollArea className="h-24 w-full pr-4">
              <div className="space-y-2">
              {allClusters.map(clusterId => (
                <div key={clusterId} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`check-cluster-${clusterId}`}
                    checked={selectedClusters.includes(clusterId)} 
                    onCheckedChange={() => handleClusterSelection(clusterId)}
                  />
                  <Label htmlFor={`check-cluster-${clusterId}`} className="font-normal text-sm">{clusterNameMap.get(clusterId) || `Cluster ${clusterId}`}</Label>
                </div>
              ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Legend />

      <div ref={containerRef} className="w-full h-[800px] border rounded-lg overflow-hidden relative bg-muted/50">
        <svg ref={svgRef} className="w-full h-full"></svg>
      </div>
      <div ref={tooltipRef} className="absolute opacity-0 bg-popover text-popover-foreground border rounded-lg px-3 py-2 text-sm pointer-events-none shadow-lg transition-opacity duration-200"></div>
      <DetailDialog />
    </div>
  );
};

export default ComponentGraph;

    
