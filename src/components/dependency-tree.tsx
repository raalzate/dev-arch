
"use client";

import React, { useMemo, useState } from 'react';
import type { PackageDependencyDetails } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight, GitBranch, Component } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface DependencyTreeProps {
  dependencies: Record<string, PackageDependencyDetails>;
}

interface TreeNode {
  name: string;
  fullName: string;
  details?: PackageDependencyDetails;
  children: Record<string, TreeNode>;
}

const buildTree = (dependencies: Record<string, PackageDependencyDetails>): TreeNode => {
  const root: TreeNode = { name: 'root', fullName: 'root', children: {} };

  Object.entries(dependencies).forEach(([pkgName, details]) => {
    const parts = pkgName.split('.');
    let currentNode = root;
    parts.forEach((part, index) => {
      const currentFullName = parts.slice(0, index + 1).join('.');
      if (!currentNode.children[part]) {
        currentNode.children[part] = {
          name: part,
          fullName: currentFullName,
          children: {},
        };
      }
      currentNode = currentNode.children[part];
    });
    currentNode.details = details;
  });

  return root;
};

const DependencyNode: React.FC<{ node: TreeNode, level: number }> = ({ node, level }) => {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = Object.keys(node.children).length > 0;

  const content = (
    <div className="flex items-center gap-2 flex-grow min-w-0">
        <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate font-mono text-sm" title={node.fullName}>
          {level > 0 && <span className="text-muted-foreground">{node.fullName.split('.').slice(0, -1).join('.')}.</span>}
          <strong>{node.name}</strong>
        </span>
        {node.details && (
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <Badge variant="secondary" className="flex items-center gap-1">
                    <Component className="h-3 w-3"/> {node.details.components_count}
                </Badge>
                 <Badge variant="outline" className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3"/> {node.details.total_dependencies_out}
                </Badge>
            </div>
        )}
    </div>
  );

  if (!hasChildren) {
    return (
      <div style={{ paddingLeft: `${level * 1.5}rem` }} className="flex flex-col py-2">
        <div className='flex items-center'>{content}</div>
         {node.details && node.details.depends_on_packages.length > 0 && (
            <div className="text-xs text-muted-foreground pl-6 pt-1">
                <p>Depende de:</p>
                <ul className="list-disc list-inside">
                    {node.details.depends_on_packages.map(dep => <li key={dep}>{dep}</li>)}
                </ul>
            </div>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} style={{ paddingLeft: `${level * 1.5}rem` }} className="py-1">
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
           <Button variant="ghost" size="sm" className="p-1 h-auto mr-1">
                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </Button>
        </CollapsibleTrigger>
        {content}
      </div>
      <CollapsibleContent>
        <div className="border-l-2 border-dashed ml-3 mt-1">
          {Object.values(node.children)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => <DependencyNode key={child.fullName} node={child} level={level + 1} />)
          }
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};


export const DependencyTree: React.FC<DependencyTreeProps> = ({ dependencies }) => {
  const tree = useMemo(() => buildTree(dependencies), [dependencies]);

  return (
    <ScrollArea className="h-[600px] border rounded-lg p-2 bg-muted/20">
      {Object.values(tree.children)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(node => <DependencyNode key={node.fullName} node={node} level={0} />)}
    </ScrollArea>
  );
};
