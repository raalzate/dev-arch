
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { ArchitectureData, ComponentsData, ProjectMetadata, SupportLibrary, Component, Proposal } from '@/lib/types';
import ProposalCard from '@/components/proposal-card';
import ComponentGraph from '@/components/component-graph';
import { Loader2, UploadCloud, FileJson, PieChart, Database, ShieldCheck, Cable, BookOpen, Blocks, Users, FileText, ExternalLink, Code, Trash2, Package, Bot, AlertTriangle, Library, Eye, Download, GitBranch, Network, Info, FileCode } from 'lucide-react';
import { DependencyTree } from '@/components/dependency-tree';
import CodeIssues from '@/components/code-issues';
import CodeViewer from '@/components/code-viewer';
import ComponentDetails from '@/components/component-details';
import { Badge } from './ui/badge';
import { getArchitectureDocumentation } from '@/app/actions';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from './ui/separator';


const SoftwareArchitectureAnalyzer = () => {
  const [componentsData, setComponentsData] = useState<ComponentsData | null>(null);
  const [archData, setArchData] = useState<ArchitectureData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGraphTabActive, setIsGraphTabActive] = useState(false);
  const [documentation, setDocumentation] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [isDocLoading, setIsDocLoading] = useState(false);

  // State for the details modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);


  const fileZipRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const cachedComponentsData = localStorage.getItem('componentsData');
      const cachedArchData = localStorage.getItem('archData');

      if (cachedComponentsData && cachedArchData) {
        setComponentsData(JSON.parse(cachedComponentsData));
        setArchData(JSON.parse(cachedArchData));
        toast({
          title: "Datos cargados desde caché",
          description: "Se han cargado los datos analizados previamente.",
        });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      localStorage.removeItem('componentsData');
      localStorage.removeItem('archData');
    }
  }, [toast]);


  const handleAnalyze = async () => {
    const file = fileZipRef.current?.files?.[0];

    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor, selecciona el archivo .zip del proyecto.",
      });
      return;
    }

    setIsLoading(true);
    setComponentsData(null);
    setArchData(null);
    setDocumentation(null); 
    setDocError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze project');
      }

      setComponentsData(result.componentsData);
      setArchData(result.archData);
      localStorage.setItem('componentsData', JSON.stringify(result.componentsData));
      localStorage.setItem('archData', JSON.stringify(result.archData));

      toast({
        title: "Análisis completado",
        description: "El proyecto ha sido analizado con éxito.",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        variant: "destructive",
        title: "Error en el Análisis",
        description: <pre className="whitespace-pre-wrap">{errorMessage}</pre>,
        duration: 9000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDocumentation = async () => {
    if (!archData || !componentsData) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Por favor, analiza los datos antes de generar la documentación.",
        });
        return;
    }
    setIsDocLoading(true);
    setDocumentation(null);
    setDocError(null);
    try {
        const { documentation: doc, error } = await getArchitectureDocumentation({ archData, componentsData });
        if (error) {
            toast({ variant: "destructive", title: "Falló la Generación de la Documentación" });
            setDocError(error);
        } else {
            setDocumentation(doc);
            toast({ title: "Documentación Generada", description: "La documentación de la arquitectura está lista." });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
        setDocError(errorMessage);
    } finally {
        setIsDocLoading(false);
    }
  };

  const handleClearCache = () => {
    localStorage.removeItem('componentsData');
    localStorage.removeItem('archData');
    setComponentsData(null);
    setArchData(null);
    setDocumentation(null);
    setDocError(null);
    if(fileZipRef.current) fileZipRef.current.value = "";
    toast({
      title: "Caché Limpiado",
      description: "Los datos de análisis almacenados han sido eliminados.",
    });
  };

  const showDetails = (title: string, content: React.ReactNode) => {
    setModalContent({ title, content });
    setIsModalOpen(true);
  };
  
  const handleProposalUpdate = (updatedProposal: Proposal) => {
    if (!archData) return;

    const updatedProposals = archData.proposals?.map(p =>
      p.id === updatedProposal.id ? updatedProposal : p
    );
    
    const newArchData = { ...archData, proposals: updatedProposals };
    setArchData(newArchData);
    localStorage.setItem('archData', JSON.stringify(newArchData));

    toast({
      title: "Propuesta Actualizada",
      description: `Se han guardado los cambios para "${updatedProposal.name}".`,
    });
  };

  const handleComponentUpdate = (updatedComponent: Component, newClusterId: number) => {
    if (!archData?.proposals) return;

    const newProposals = archData.proposals.map(p => {
      // Remove component from its old cluster
      const filteredComponents = p.components?.filter(cId => cId !== updatedComponent.id) ?? [];
      
      // Add component to its new cluster
      if (p.id === newClusterId) {
        return { ...p, components: [...filteredComponents, updatedComponent.id] };
      }
      
      return { ...p, components: filteredComponents };
    });

    const newArchData = { ...archData, proposals: newProposals };
    setArchData(newArchData);
    localStorage.setItem('archData', JSON.stringify(newArchData));

    toast({
      title: "Componente Actualizado",
      description: `El componente ha sido movido al cluster ${newClusterId}.`,
    });
  };


  const handleExportArchJson = () => {
    if (!archData) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay datos de arquitectura para exportar.",
      });
      return;
    }

    const dataStr = JSON.stringify(archData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'architecture_updated.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

 const dbComponentsCount = React.useMemo(() => {
    if (!archData?.proposals) return 0;
    const tables = new Set(archData.proposals.flatMap(p => p.metrics.tables || []));
    return tables.size;
  }, [archData]);

  const sensitiveComponentsCount = React.useMemo(() => {
    if (!archData?.proposals) return 0;
    return archData.proposals.filter(p => p.metrics.sensitive).length;
  }, [archData]);

  const allCodeIssues = React.useMemo(() => {
    if (!componentsData?.components) return [];
    return componentsData.components.flatMap(comp => 
      (comp.code_issues || []).map(issue => ({ ...issue, componentId: comp.id }))
    );
  }, [componentsData]);

  const inferLayer = useCallback((componentId: string, component?: Component): string => {
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
  }, []);

  const handleShowComponentDetails = useCallback((componentId: string) => {
    const component = componentsData?.components?.find(c => c.id === componentId);
    if (component) {
      showDetails(`Detalles del Componente: ${component.id}`, 
        <ComponentDetails 
          component={component} 
          showDetails={showDetails} 
          inferLayer={inferLayer} 
        />
      );
    }
  }, [componentsData, inferLayer]);

  const MetricCard = ({ title, icon, children, onDetailClick }: { title: string, icon: React.ReactNode, children: React.ReactNode, onDetailClick?: () => void }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {children}
        {onDetailClick && (
          <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs" onClick={onDetailClick}>
             <Eye className="mr-1 h-3 w-3" />
             Ver detalles
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const SupportLibraryCard = ({ library }: { library: SupportLibrary }) => (
    <Card className="bg-muted/50">
        <CardHeader>
            <CardTitle className="text-lg flex items-center text-muted-foreground"><Library className="mr-2 h-5 w-5" />{library.name}</CardTitle>
            <CardDescription>ID de Librería: {library.id}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm font-semibold mb-2">Componentes ({library.components.length}):</p>
            <ScrollArea className="h-32 p-2 border rounded-md bg-background">
              <ul className="text-xs space-y-1 font-mono">
                  {library.components.map(comp => <li key={comp}>{comp}</li>)}
              </ul>
            </ScrollArea>
        </CardContent>
    </Card>
  );

  const renderTable = (headers: string[], data: (string|number|null|undefined)[][]) => (
      <Table>
          <TableHeader>
              <TableRow>
                  {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
              </TableRow>
          </TableHeader>
          <TableBody>
              {data.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => {
                        const isComponentId = typeof cell === 'string' && componentsData?.components?.some(c => c.id === cell);
                        return (
                          <TableCell key={cellIndex} className="font-mono text-xs">
                            {isComponentId ? (
                              <Button 
                                variant="link" 
                                className="p-0 h-auto text-xs font-mono" 
                                onClick={() => handleShowComponentDetails(cell as string)}
                              >
                                {cell}
                              </Button>
                            ) : (
                              cell ?? 'N/A'
                            )}
                          </TableCell>
                        );
                      })}
                  </TableRow>
              ))}
          </TableBody>
      </Table>
  );
  
  return (
    <div className="space-y-6">
      <header className="bg-card shadow-sm rounded-lg p-6">
        <h1 className="text-3xl font-bold text-primary">Analizador de Arquitectura de Software</h1>
        <p className="text-muted-foreground mt-1">Sube el archivo .zip de tu proyecto para visualizar la arquitectura y sus métricas.</p>
      </header>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 items-end">
            <div>
              <label htmlFor="file-zip" className="flex items-center text-sm font-medium text-foreground mb-2">
                <Package className="mr-2 h-4 w-4" />
                Archivo .zip del Proyecto
              </label>
              <Input id="file-zip" type="file" accept=".zip" ref={fileZipRef} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </div>
          </div>
          <div className="mt-6 flex flex-col md:flex-row gap-4">
             <Button onClick={handleAnalyze} disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Analizar Proyecto (.zip)
            </Button>
            <Button onClick={handleExportArchJson} variant="outline" className="w-full md:w-auto" disabled={!archData}>
                <Download className="mr-2 h-4 w-4" />
                Exportar JSON de Arquitectura
            </Button>
            <Button onClick={handleClearCache} variant="destructive" className="w-full md:w-auto ml-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar Datos
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="analysis" onValueChange={(value) => setIsGraphTabActive(value === 'graph')}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analysis">Análisis General</TabsTrigger>
          <TabsTrigger value="code_issues">Problemas de Código</TabsTrigger>
          <TabsTrigger value="graph">Grafo de Componentes</TabsTrigger>
          <TabsTrigger value="playbook">Documentación IA</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-6">
          {archData && componentsData ? (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <MetricCard title="Métricas Clave" icon={<PieChart className="h-4 w-4 text-muted-foreground" />}>
                <div className="text-2xl font-bold">{archData.project_metadata?.total_components || componentsData.components?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Componentes Totales</p>
                <div className="text-2xl font-bold mt-2">{(archData.project_metadata?.total_loc || componentsData.components?.reduce((acc, c) => acc + (c.loc || 0), 0) || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Líneas de Código Totales (LOC)</p>
              </MetricCard>
              <MetricCard 
                title="Análisis de Datos" 
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
                onDetailClick={() => {
                  const dbProposals = archData.proposals?.filter(p => p.metrics.tables && p.metrics.tables.length > 0) || [];
                  const sensitiveProposals = archData.proposals?.filter(p => p.metrics.sensitive) || [];
                  showDetails("Detalles de Análisis de Datos", (
                    <div className='space-y-4'>
                      <div>
                        <h3 className='font-semibold mb-2'>Propuestas con Acceso a BD ({dbProposals.length})</h3>
                        {renderTable(['Propuesta', 'Tablas Usadas'], dbProposals.map(p => [p.name, p.metrics.tables!.join(', ')]))}
                      </div>
                      <div>
                        <h3 className='font-semibold mb-2'>Propuestas con Datos Sensibles ({sensitiveProposals.length})</h3>
                         {renderTable(['Propuesta'], sensitiveProposals.map(p => [p.name]))}
                      </div>
                    </div>
                  ));
                }}
              >
                <div className="text-2xl font-bold">{dbComponentsCount}</div>
                <p className="text-xs text-muted-foreground">Tablas de BD Únicas</p>
                <div className="text-2xl font-bold mt-2">{sensitiveComponentsCount}</div>
                <p className="text-xs text-muted-foreground">Propuestas con Datos Sensibles</p>
              </MetricCard>
              <MetricCard title="Info del Proyecto" icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}>
                 <div className="text-sm font-semibold truncate" title={archData.project_metadata?.shared_domain}>{archData.project_metadata?.shared_domain || 'N/A'}</div>
                 <p className="text-xs text-muted-foreground">Dominio Compartido</p>
                 <div className="text-2xl font-bold mt-2">{archData.project_metadata?.components_with_secrets || 0}</div>
                 <p className="text-xs text-muted-foreground">Componentes con Secretos</p>
              </MetricCard>

              <MetricCard 
                title="Tipos de Componentes" 
                icon={<Code className="h-4 w-4 text-muted-foreground" />}
                onDetailClick={() => {
                  const deprecated = componentsData.components?.filter(c => c.annotations?.includes("Deprecated")) || [];
                  const ejb = componentsData.components?.filter(c => c.ejb_type) || [];
                  const interfaces = componentsData.components?.filter(c => c.interface) || [];
                  const withSecrets = componentsData.components?.filter(c => c.secrets_references && c.secrets_references.length > 0) || [];
                  const withExternalDeps = componentsData.components?.filter(c => c.external_dependencies && c.external_dependencies.length > 0) || [];
                   showDetails("Detalles de Tipos de Componentes", (
                    <div className='space-y-4'>
                       <div>
                        <h3 className='font-semibold mb-2'>Componentes Obsoletos (@Deprecated) ({deprecated.length})</h3>
                        {renderTable(['Componente'], deprecated.map(c => [c.id]))}
                      </div>
                      <div>
                        <h3 className='font-semibold mb-2'>Componentes EJB ({ejb.length})</h3>
                        {renderTable(['Componente', 'Tipo EJB'], ejb.map(c => [c.id, c.ejb_type!]))}
                      </div>
                      <div>
                        <h3 className='font-semibold mb-2'>Interfaces ({interfaces.length})</h3>
                        {renderTable(['Componente'], interfaces.map(c => [c.id]))}
                      </div>
                       <div>
                        <h3 className='font-semibold mb-2'>Componentes con Secretos ({withSecrets.length})</h3>
                        {renderTable(['Componente', 'Secretos'], withSecrets.map(c => [c.id, c.secrets_references!.join(', ')]))}
                      </div>
                      <div>
                        <h3 className='font-semibold mb-2'>Componentes con Dependencias Externas ({withExternalDeps.length})</h3>
                        {renderTable(['Componente', 'Dependencias'], withExternalDeps.map(c => [c.id, c.external_dependencies!.join(', ')]))}
                      </div>
                    </div>
                  ));
                }}
              >
                 <ScrollArea className="h-24">
                    <div className="space-y-1 text-sm">
                      <p>Obsoletos: {componentsData?.components?.filter(c => c.annotations?.includes("Deprecated"))?.length || 0}</p>
                      <p>EJB: {componentsData?.components?.filter(c => c.ejb_type)?.length || 0}</p>
                      <p>Interfaces: {componentsData?.components?.filter(c => c.interface)?.length || 0}</p>
                      <p>Con Secretos: {componentsData?.components?.filter(c => c.secrets_references && c.secrets_references.length > 0)?.length || 0}</p>
                      <p>Con Dep. Externas: {componentsData?.components?.filter(c => c.external_dependencies && c.external_dependencies.length > 0)?.length || 0}</p>
                    </div>
                 </ScrollArea>
              </MetricCard>
              
              <MetricCard 
                title="Componentes por Capa" 
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                onDetailClick={() => {
                   const layers = (componentsData.components || []).reduce((acc, c) => {
                      const layer = inferLayer(c.id, c);
                      if (!acc[layer]) acc[layer] = [];
                      acc[layer].push(c);
                      return acc;
                    }, {} as Record<string, Component[]>);
                    showDetails("Detalles de Componentes por Capa", (
                      <div className="space-y-4">
                        {Object.entries(layers).map(([layerName, components]) => (
                           <div key={layerName}>
                              <h3 className='font-semibold mb-2'>{layerName} ({components.length})</h3>
                              {renderTable(['Componente'], components.map(c => [c.id]))}
                           </div>
                        ))}
                      </div>
                    ));
                }}
                >
                 <ScrollArea className="h-24">
                  <div className="space-y-1 text-sm">
                    {Object.entries((componentsData?.components || []).reduce((acc, c) => {
                      const layer = inferLayer(c.id, c);
                      acc[layer] = (acc[layer] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>))
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, total]) => <p key={name}><strong>{name}:</strong> {total}</p>)}
                  </div>
                 </ScrollArea>
              </MetricCard>
              
              <MetricCard 
                title="Dependencias Externas" 
                icon={<ExternalLink className="h-4 w-4 text-muted-foreground" />}
                onDetailClick={() => {
                  const deps = archData.project_metadata?.external_dependencies || {};
                  showDetails("Dependencias Externas", renderTable(
                    ['Dependencia', 'Versión'],
                     Object.entries(deps).map(([key, value]) => [key, value])
                  ));
                }}
                >
                <div className="text-2xl font-bold">{archData.project_metadata?.external_dependencies ? Object.keys(archData.project_metadata.external_dependencies).length : 0}</div>
                <p className="text-xs text-muted-foreground">Total de dependencias externas</p>
              </MetricCard>

              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5"/>Resumen del Proyecto</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">{archData.summary || "No hay resumen disponible."}</p>
                </CardContent>
              </Card>
              
              {archData.project_metadata?.package_dependencies && Object.keys(archData.project_metadata.package_dependencies).length > 0 && (
                <Card className="md:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                        <Package className="mr-2 h-5 w-5" />Dependencias de Paquetes ({Object.keys(archData.project_metadata.package_dependencies).length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DependencyTree dependencies={archData.project_metadata.package_dependencies} />
                    </CardContent>
                </Card>
              )}
              
              <div className="md:col-span-3 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-4 flex items-center"><Blocks className="mr-2 h-6 w-6"/>Propuestas de Microservicios (Clusters)</h2>
                  <div className="space-y-6">
                    {archData.proposals?.map(proposal => <ProposalCard key={proposal.id} proposal={proposal} onUpdate={handleProposalUpdate}/>)}
                  </div>
                </div>

                {archData.support_libraries && archData.support_libraries.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-4 flex items-center"><Library className="mr-2 h-6 w-6" />Librerías de Soporte</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {archData.support_libraries.map(lib => <SupportLibraryCard key={lib.id} library={lib} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-muted rounded-lg">
              <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold">Esperando análisis de proyecto</h3>
              <p className="text-muted-foreground mt-2">Sube el archivo .zip de tu proyecto para comenzar.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code_issues" className="mt-6">
          <Card>
            <CardContent className="p-6">
              {allCodeIssues.length > 0 ? (
                <CodeIssues 
                  issues={allCodeIssues} 
                  onShowComponentDetails={handleShowComponentDetails} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 bg-muted rounded-lg">
                  <Info className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">No hay problemas de código</h3>
                  <p className="text-muted-foreground mt-2">No se detectaron problemas de código en el último análisis.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className="mt-6">
          <Card>
            <CardContent className="p-6">
              {componentsData && archData ? (
                  <ComponentGraph 
                    componentsData={componentsData} 
                    archData={archData} 
                    isGraphTabActive={isGraphTabActive} 
                    onComponentUpdate={handleComponentUpdate}
                    showDetails={showDetails}
                  />
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-[800px] bg-muted rounded-lg">
                  <Cable className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">Grafo No Disponible</h3>
                  <p className="text-muted-foreground mt-2">Sube y analiza tu proyecto para renderizar el grafo de dependencias.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="playbook" className="mt-6">
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Bot className="mr-2 h-5 w-5" />Documentación de Arquitectura (IA)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Genera automáticamente un documento técnico detallado sobre la arquitectura de tu proyecto, analizando sus componentes, dependencias y propuestas de microservicios.
                </p>
                <Button onClick={handleGenerateDocumentation} disabled={isDocLoading || !archData}>
                    {isDocLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                    Generar Documentación
                </Button>
                
                {isDocLoading && (
                  <div className="space-y-2">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                )}
                
                {docError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Falló la Generación de la Documentación</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap font-mono text-xs max-h-96 overflow-auto">
                      {docError}
                    </AlertDescription>
                  </Alert>
                )}

                {documentation && (
                    <Textarea
                        readOnly
                        className="h-[600px] font-mono text-xs bg-muted/50 border-dashed"
                        value={documentation}
                    />
                )}

                {!documentation && !isDocLoading && !docError && (
                   <div className="flex flex-col items-center justify-center text-center py-20 bg-muted rounded-lg">
                      <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold">Generar Documentación de Arquitectura</h3>
                      <p className="text-muted-foreground mt-2">Haz clic en el botón para que la IA genere la documentación de tu proyecto.</p>
                   </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{modalContent?.title}</DialogTitle>
          </DialogHeader>
           <ScrollArea className="max-h-[60vh] pr-6">
                {modalContent?.content}
           </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SoftwareArchitectureAnalyzer;
