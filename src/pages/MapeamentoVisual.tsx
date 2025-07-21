import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Controls,
  Background,
  Panel,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";

interface FieldMapping {
  id: string;
  source_field: string;
  target_field: string;
  template_name: string;
  file_type: string;
  target_table: string;
  field_type: string;
  is_required: boolean;
}

const customNodeStyle = {
  background: '#fff',
  border: '2px solid #ddd',
  borderRadius: '8px',
  padding: '10px',
  minWidth: '150px',
  fontSize: '12px',
};

const sourceNodeStyle = {
  ...customNodeStyle,
  borderColor: '#3b82f6',
  background: '#eff6ff',
};

const targetNodeStyle = {
  ...customNodeStyle,
  borderColor: '#10b981',
  background: '#ecfdf5',
};

export default function MapeamentoVisual() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Carregar templates disponíveis
  useEffect(() => {
    loadTemplates();
  }, []);

  // Carregar mapeamentos quando template selecionado
  useEffect(() => {
    if (selectedTemplate) {
      loadMappings();
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('field_mappings')
        .select('template_name')
        .eq('active', true);

      if (error) throw error;

      const uniqueTemplates = [...new Set(data?.map(item => item.template_name) || [])];
      setTemplates(uniqueTemplates);
      if (uniqueTemplates.length > 0) {
        setSelectedTemplate(uniqueTemplates[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates');
    }
  };

  const loadMappings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('field_mappings')
        .select('*')
        .eq('template_name', selectedTemplate)
        .eq('active', true)
        .order('order_index');

      if (error) throw error;

      setMappings(data || []);
      createNodesAndEdges(data || []);
    } catch (error) {
      console.error('Erro ao carregar mapeamentos:', error);
      toast.error('Erro ao carregar mapeamentos');
    } finally {
      setLoading(false);
    }
  };

  const createNodesAndEdges = (mappingData: FieldMapping[]) => {
    const sourceFields = [...new Set(mappingData.map(m => m.source_field))];
    const targetFields = [...new Set(mappingData.map(m => m.target_field))];

    // Criar nós para campos source (esquerda)
    const sourceNodes: Node[] = sourceFields.map((field, index) => ({
      id: `source-${field}`,
      type: 'default',
      position: { x: 50, y: 50 + index * 80 },
      data: { 
        label: (
          <div className="text-center">
            <div className="font-medium text-blue-700">{field}</div>
            <Badge variant="outline" className="text-xs mt-1">Arquivo</Badge>
          </div>
        )
      },
      style: sourceNodeStyle,
      sourcePosition: Position.Right,
    }));

    // Criar nós para campos target (direita)
    const targetNodes: Node[] = targetFields.map((field, index) => {
      const mapping = mappingData.find(m => m.target_field === field);
      return {
        id: `target-${field}`,
        type: 'default',
        position: { x: 600, y: 50 + index * 80 },
        data: { 
          label: (
            <div className="text-center">
              <div className="font-medium text-green-700">{field}</div>
              <div className="text-xs text-gray-500">{mapping?.target_table}</div>
              <Badge variant="outline" className="text-xs mt-1">
                {mapping?.field_type}
                {mapping?.is_required && ' *'}
              </Badge>
            </div>
          )
        },
        style: targetNodeStyle,
        targetPosition: Position.Left,
      };
    });

    // Criar edges para conexões existentes
    const existingEdges: Edge[] = mappingData.map((mapping, index) => ({
      id: `edge-${index}`,
      source: `source-${mapping.source_field}`,
      target: `target-${mapping.target_field}`,
      type: 'smoothstep',
      style: { stroke: '#6366f1', strokeWidth: 2 },
      data: { mappingId: mapping.id },
    }));

    setNodes([...sourceNodes, ...targetNodes]);
    setEdges(existingEdges);
  };

  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;

      const sourceField = params.source.replace('source-', '');
      const targetField = params.target.replace('target-', '');

      try {
        // Verificar se já existe um mapeamento
        const existingMapping = mappings.find(
          m => m.source_field === sourceField && m.target_field === targetField
        );

        if (existingMapping) {
          toast.info('Conexão já existe!');
          return;
        }

        // Criar novo mapeamento
        const { data, error } = await supabase
          .from('field_mappings')
          .insert({
            source_field: sourceField,
            target_field: targetField,
            template_name: selectedTemplate,
            file_type: 'csv', // Assumindo CSV por padrão
            target_table: 'clientes', // Assumindo clientes por padrão
            field_type: 'text',
            is_required: false,
            order_index: mappings.length,
          })
          .select()
          .single();

        if (error) throw error;

        // Adicionar edge visual
        const newEdge: Edge = {
          id: `edge-${Date.now()}`,
          source: params.source,
          target: params.target,
          type: 'smoothstep',
          style: { stroke: '#6366f1', strokeWidth: 2 },
          data: { mappingId: data.id },
        };

        setEdges((eds) => addEdge(newEdge, eds));
        setMappings(prev => [...prev, data]);
        toast.success('Conexão criada!');

      } catch (error) {
        console.error('Erro ao criar conexão:', error);
        toast.error('Erro ao criar conexão');
      }
    },
    [mappings, selectedTemplate]
  );

  const onEdgeDelete = useCallback(
    async (edgesToRemove: Edge[]) => {
      for (const edge of edgesToRemove) {
        if (edge.data?.mappingId) {
          try {
            const { error } = await supabase
              .from('field_mappings')
              .delete()
              .eq('id', edge.data.mappingId as string);

            if (error) throw error;

            setMappings(prev => prev.filter(m => m.id !== (edge.data?.mappingId as string)));
            toast.success('Conexão removida!');
          } catch (error) {
            console.error('Erro ao remover conexão:', error);
            toast.error('Erro ao remover conexão');
          }
        }
      }
    },
    []
  );

  const handleSave = async () => {
    toast.success('Mapeamentos salvos com sucesso!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Mapeamento Visual de Campos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Arraste linhas dos campos do arquivo (azul) para os campos do banco (verde) para criar conexões.
            Delete conexões selecionando a linha e pressionando Delete.
          </p>
          
          <div className="flex gap-4 items-center mb-4">
            <div className="flex gap-2">
              {templates.map(template => (
                <Button
                  key={template}
                  variant={selectedTemplate === template ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTemplate(template)}
                >
                  {template}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={loadMappings}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div style={{ height: '600px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgeDelete}
          fitView
          nodesDraggable={false}
          nodesConnectable={true}
          elementsSelectable={true}
        >
          <Controls />
          <Background />
          <Panel position="top-right">
            <Card className="w-64">
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-100 border-2 border-blue-500 rounded"></div>
                    <span>Campos do Arquivo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-100 border-2 border-green-500 rounded"></div>
                    <span>Campos do Banco</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-indigo-500"></div>
                    <span>Conexão Ativa</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar Mapeamentos
        </Button>
      </div>
    </div>
  );
}