"use client";

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { CodeIssue } from '@/lib/types';

interface CodeIssuesProps {
  issues: CodeIssue[];
  onShowComponentDetails: (componentId: string) => void;
}

const CodeIssues: React.FC<CodeIssuesProps> = ({ issues, onShowComponentDetails }) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'ERROR':
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      case 'WARNING':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warning</Badge>;
      case 'INFO':
      default:
        return <Badge variant="secondary" className="flex items-center gap-1"><Info className="h-3 w-3" /> Info</Badge>;
    }
  };

  if (!issues || issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Info className="h-10 w-10 mb-2 opacity-20" />
        <p>No se encontraron problemas de código.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Problemas Detectados ({issues.length})</h3>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severidad</TableHead>
              <TableHead className="w-[150px]">Tipo</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Componente</TableHead>
              <TableHead className="w-[80px] text-right">Línea</TableHead>
              <TableHead className="w-[200px]">Patrón</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue, index) => (
              <TableRow key={index}>
                <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                <TableCell className="font-medium">{issue.type}</TableCell>
                <TableCell className="text-sm">{issue.message}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[200px]" title={issue.componentId}>
                  {issue.componentId ? (
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-xs font-mono text-muted-foreground" 
                      onClick={() => onShowComponentDetails(issue.componentId!)}
                    >
                      {issue.componentId.split('.').pop()}
                    </Button>
                  ) : 'N/A'}
                </TableCell>
                <TableCell className="text-right font-mono">{issue.line}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{issue.pattern}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CodeIssues;
