"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Code, GitBranch, Package, Network, FileCode } from 'lucide-react';
import type { Component } from '@/lib/types';
import CodeViewer from './code-viewer';

interface ComponentDetailsProps {
  component: Component;
  showDetails: (title: string, content: React.ReactNode) => void;
  inferLayer: (componentId: string, component?: Component) => string;
}

const ComponentDetails: React.FC<ComponentDetailsProps> = ({ component, showDetails, inferLayer }) => {
  const DetailSection: React.FC<{title: string; icon: React.ReactNode; children: React.ReactNode;}> = ({ title, icon, children }) => (
    <div>
      <h4 className="font-semibold mb-2 flex items-center text-primary/90">
        {icon}
        {title}
      </h4>
      <div className="space-y-2 text-sm text-muted-foreground pl-6">{children}</div>
    </div>
  );

  const ListDisplay = ({ title, items }: { title: string, items?: string[] | null }) => {
    if (!items || items.length === 0) return <div><strong>{title}:</strong> Ninguno</div>;
    return (
      <div>
        <strong>{title}:</strong>
        <ul className="list-disc list-inside ml-4 mt-1">
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-sm py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div><strong>Capa:</strong> <Badge variant="secondary">{inferLayer(component.id, component)}</Badge></div>
        <div><strong>Líneas de Código (LOC):</strong> {component.loc || 'N/A'}</div>
        <div><strong>Interfaz:</strong> {component.interface ? 'Sí' : 'No'}</div>
        <div><strong>Tipo EJB:</strong> {component.ejb_type || 'N/A'}</div>
        <div><strong>Datos Sensibles:</strong> {component.sensitive_data ? <span className="font-bold text-destructive">Sí</span> : 'No'}</div>
        {component.files && component.files.length > 0 && (
          <div className="md:col-span-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => showDetails(`Código Fuente: ${component.id}`, <CodeViewer filePath={component.files![0]} />)}
            >
              <FileCode className="mr-2 h-4 w-4" />
              Ver Código Fuente
            </Button>
          </div>
        )}
      </div>
      <Separator />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <DetailSection title="Métricas de Código" icon={<Code className="h-4 w-4 mr-2"/>}>
          <div><strong>CBO (Coupling Between Objects):</strong> {component.cbo ?? 'N/A'}</div>
          <div><strong>LCOM (Lack of Cohesion in Methods):</strong> {component.lcom ?? 'N/A'}</div>
          <ListDisplay title="Anotaciones" items={component.annotations} />
        </DetailSection>
        <DetailSection title="Jerarquía" icon={<GitBranch className="h-4 w-4 mr-2"/>}>
          <div><strong>Extiende:</strong> {component.extends || 'Ninguno'}</div>
          <ListDisplay title="Implementa" items={component.implements} />
        </DetailSection>
        <DetailSection title="Dependencias" icon={<Package className="h-4 w-4 mr-2"/>}>
          <ListDisplay title="Tablas de BD" items={component.tables_used} />
          <ListDisplay title="Dependencias Externas" items={component.external_dependencies} />
          <ListDisplay title="Referencias a Secretos" items={component.secrets_references} />
        </DetailSection>
        <DetailSection title="Integraciones" icon={<Network className="h-4 w-4 mr-2"/>}>
          <div><strong>Tipo de Mensajería:</strong> {component.messaging_type || 'N/A'}</div>
          <div><strong>Rol de Mensajería:</strong> {component.messaging_role || 'N/A'}</div>
          <div><strong>Tipo Web:</strong> {component.web_type || 'N/A'}</div>
          <div><strong>Rol Web:</strong> {component.web_role || 'N/A'}</div>
        </DetailSection>
      </div>
    </div>
  );
};

export default ComponentDetails;
