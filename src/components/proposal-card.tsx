
"use client";

import React, { useState } from 'react';
import type { Proposal } from '@/lib/types';
import { getAISuggestions } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from '@/components/ui/button';
import { Bot, CheckCircle, Package, AlertTriangle, Database, GitCommitHorizontal, ListTodo, Loader2, Edit, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ProposalCardProps {
  proposal: Proposal;
  onUpdate: (updatedProposal: Proposal) => void;
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onUpdate }) => {
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleGetSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    setAiSuggestions(null);
    const { suggestions, error: apiError } = await getAISuggestions({
      proposalName: proposal.name,
      proposalRationale: proposal.rationale || [],
      proposalMetrics: proposal.metrics,
    });

    if (apiError) {
      setError("No se pudieron cargar las sugerencias de la IA.");
    } else {
      setAiSuggestions(suggestions);
    }
    setIsLoading(false);
  };
  
  const viabilityVariant = proposal.viability === 'High' ? 'default' : proposal.viability === 'Medium' ? 'secondary' : 'destructive';
  const formatList = (list: string[] | undefined, icon: React.ReactNode) => {
    if (!list || list.length === 0) return <li>N/A</li>;
    return list.map((item, index) => {
      const cleanItem = item.replace(/^[✅⚠️❌•]\s*/, '');
      return <li key={index} className="flex items-start"><span className="mr-2 mt-1">{icon}</span><span>{cleanItem}</span></li>;
    });
  };

  const handleSaveChanges = (formData: FormData) => {
    const updatedProposal: Proposal = {
      ...proposal,
      name: formData.get('name') as string,
      rationale: (formData.get('rationale') as string).split('\n'),
      recommended_actions: (formData.get('recommended_actions') as string).split('\n'),
    };
    onUpdate(updatedProposal);
    setIsEditModalOpen(false);
  };

  const EditModal = () => (
    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Editar Propuesta: {proposal.name}</DialogTitle>
            </DialogHeader>
            <form action={handleSaveChanges} className="space-y-4">
                <div>
                    <Label htmlFor="name">Nombre de la Propuesta</Label>
                    <Input id="name" name="name" defaultValue={proposal.name} />
                </div>
                <div>
                    <Label htmlFor="rationale">Justificación (una por línea)</Label>
                    <Textarea id="rationale" name="rationale" defaultValue={proposal.rationale?.join('\n')} rows={5} />
                </div>
                <div>
                    <Label htmlFor="recommended_actions">Acciones Recomendadas (una por línea)</Label>
                    <Textarea id="recommended_actions" name="recommended_actions" defaultValue={proposal.recommended_actions?.join('\n')} rows={5} />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit"><Save className="mr-2 h-4 w-4" /> Guardar Cambios</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
);


  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl text-primary">{proposal.name} (Cluster {proposal.id})</CardTitle>
          <div className='flex items-center gap-2'>
            <Badge variant={viabilityVariant} className="text-sm">{proposal.viability} Viabilidad</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditModalOpen(true)}>
                <Edit className="h-4 w-4" />
                <span className="sr-only">Editar propuesta</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><Package className="h-4 w-4 mr-2" />Métricas</h4>
            <div className="space-y-1 text-muted-foreground">
              <p><strong>Tamaño:</strong> {proposal.metrics.size} componentes</p>
              <p><strong>Cohesión:</strong> {(proposal.metrics.cohesion_avg * 100).toFixed(0)}%</p>
              <p><strong>Acoplamiento Externo:</strong> {(proposal.metrics.external_coupling * 100).toFixed(0)}%</p>
              <p><strong>Tablas:</strong> {proposal.metrics.tables.length}</p>
              <p><strong>Datos Sensibles:</strong> {proposal.metrics.sensitive ? <span className="font-bold text-destructive">Sí</span> : 'No'}</p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><GitCommitHorizontal className="h-4 w-4 mr-2" />Justificación</h4>
            <ul className="space-y-1 text-muted-foreground">{formatList(proposal.rationale, <CheckCircle className="h-4 w-4 text-green-500"/>)}</ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><ListTodo className="h-4 w-4 mr-2" />Acciones Recomendadas</h4>
            <ul className="space-y-1 text-muted-foreground">{formatList(proposal.recommended_actions, <AlertTriangle className="h-4 w-4 text-amber-500" />)}</ul>
          </div>
        </div>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
             <CardTitle className="text-base flex items-center"><Bot className="mr-2 h-5 w-5"/>Sugerencias Impulsadas por IA</CardTitle>
             <CardDescription>Análisis automatizado y próximos pasos.</CardDescription>
          </CardHeader>
          <CardContent>
            {!aiSuggestions && !isLoading && !error && (
              <Button onClick={handleGetSuggestions} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                Obtener Sugerencias
              </Button>
            )}
            {isLoading && (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary"/>
                <span className="text-sm text-muted-foreground">Generando sugerencias...</span>
              </div>
            )}
            {error && !isLoading && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            {aiSuggestions && !isLoading && (
              <p className="text-sm text-foreground">{aiSuggestions}</p>
            )}
          </CardContent>
        </Card>
      </CardContent>
      <EditModal />
    </Card>
  );
};

export default ProposalCard;
