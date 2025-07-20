import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const nodeTypes = {};

const ArquiteturaProjeto = () => {
  // Definir nodes da arquitetura
  const initialNodes: Node[] = useMemo(() => [
    // AUTENTICAÇÃO E CONTEXTOS
    {
      id: 'auth',
      type: 'default',
      position: { x: 50, y: 50 },
      data: { label: 'AuthContext\n(Autenticação)' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'supabase',
      type: 'default',
      position: { x: 200, y: 50 },
      data: { label: 'Supabase\n(Backend)' },
      style: { backgroundColor: '#ddd6fe', borderColor: '#8b5cf6', width: 120 }
    },

    // LAYOUT E NAVEGAÇÃO
    {
      id: 'app',
      type: 'default',
      position: { x: 400, y: 50 },
      data: { label: 'App.tsx\n(Root)' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 120 }
    },
    {
      id: 'layout',
      type: 'default',
      position: { x: 400, y: 200 },
      data: { label: 'Layout\n(Estrutura)' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },
    {
      id: 'sidebar',
      type: 'default',
      position: { x: 250, y: 350 },
      data: { label: 'AppSidebar\n(Navegação)' },
      style: { backgroundColor: '#bbf7d0', borderColor: '#10b981', width: 120 }
    },
    {
      id: 'header',
      type: 'default',
      position: { x: 550, y: 350 },
      data: { label: 'Header\n(Cabeçalho)' },
      style: { backgroundColor: '#bbf7d0', borderColor: '#10b981', width: 120 }
    },

    // PÁGINAS PRINCIPAIS
    {
      id: 'dashboard',
      type: 'default',
      position: { x: 100, y: 500 },
      data: { label: 'Dashboard\n(Início)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'volumetria',
      type: 'default',
      position: { x: 250, y: 500 },
      data: { label: 'Volumetria\n(Dados)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'operacional',
      type: 'default',
      position: { x: 400, y: 500 },
      data: { label: 'Operacional\n(Gestão)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'financeiro',
      type: 'default',
      position: { x: 550, y: 500 },
      data: { label: 'Financeiro\n(Finanças)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'people',
      type: 'default',
      position: { x: 700, y: 500 },
      data: { label: 'People\n(RH)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },

    // SUBMÓDULOS OPERACIONAL
    {
      id: 'escala',
      type: 'default',
      position: { x: 300, y: 650 },
      data: { label: 'Escala\n(Médicos)' },
      style: { backgroundColor: '#e0e7ff', borderColor: '#6366f1', width: 100 }
    },
    {
      id: 'producao',
      type: 'default',
      position: { x: 420, y: 650 },
      data: { label: 'Produção\n(Exames)' },
      style: { backgroundColor: '#e0e7ff', borderColor: '#6366f1', width: 100 }
    },
    {
      id: 'qualidade',
      type: 'default',
      position: { x: 540, y: 650 },
      data: { label: 'Qualidade\n(Controle)' },
      style: { backgroundColor: '#e0e7ff', borderColor: '#6366f1', width: 100 }
    },

    // SUBMÓDULOS FINANCEIRO
    {
      id: 'faturamento',
      type: 'default',
      position: { x: 450, y: 800 },
      data: { label: 'Gerar\nFaturamento' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 100 }
    },
    {
      id: 'pagamentos',
      type: 'default',
      position: { x: 570, y: 800 },
      data: { label: 'Pagamentos\nMédicos' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 100 }
    },
    {
      id: 'cobranca',
      type: 'default',
      position: { x: 690, y: 800 },
      data: { label: 'Régua\nCobrança' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 100 }
    },

    // SUBMÓDULOS PEOPLE
    {
      id: 'colaboradores',
      type: 'default',
      position: { x: 600, y: 650 },
      data: { label: 'Colaboradores\n(Gestão)' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 100 }
    },
    {
      id: 'carreira',
      type: 'default',
      position: { x: 720, y: 650 },
      data: { label: 'Plano\nCarreira' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 100 }
    },
    {
      id: 'desenvolvimento',
      type: 'default',
      position: { x: 840, y: 650 },
      data: { label: 'Desenvolvimento\n(Equipe)' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 100 }
    },

    // CONFIGURAÇÕES
    {
      id: 'config',
      type: 'default',
      position: { x: 850, y: 500 },
      data: { label: 'Configuração\n(Admin)' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 120 }
    },
    {
      id: 'usuarios',
      type: 'default',
      position: { x: 750, y: 800 },
      data: { label: 'Gerenciar\nUsuários' },
      style: { backgroundColor: '#fee2e2', borderColor: '#f87171', width: 100 }
    },
    {
      id: 'listas',
      type: 'default',
      position: { x: 870, y: 800 },
      data: { label: 'Listas\nSistema' },
      style: { backgroundColor: '#fee2e2', borderColor: '#f87171', width: 100 }
    },

    // CONTRATOS
    {
      id: 'contratos',
      type: 'default',
      position: { x: 100, y: 650 },
      data: { label: 'Contratos\n(Docs)' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },
    {
      id: 'contratos-clientes',
      type: 'default',
      position: { x: 50, y: 800 },
      data: { label: 'Contratos\nClientes' },
      style: { backgroundColor: '#ecfdf5', borderColor: '#16a34a', width: 100 }
    },
    {
      id: 'contratos-fornecedores',
      type: 'default',
      position: { x: 170, y: 800 },
      data: { label: 'Contratos\nFornecedores' },
      style: { backgroundColor: '#ecfdf5', borderColor: '#16a34a', width: 100 }
    },

    // EDGE FUNCTIONS
    {
      id: 'edge-functions',
      type: 'default',
      position: { x: 50, y: 200 },
      data: { label: 'Edge Functions\n(Processamento)' },
      style: { backgroundColor: '#f0f0f0', borderColor: '#6b7280', width: 140 }
    },

    // DATABASE
    {
      id: 'database',
      type: 'default',
      position: { x: 200, y: 200 },
      data: { label: 'Database\n(Postgres)' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#4b5563', width: 120 }
    },
  ], []);

  // Definir edges (conexões)
  const initialEdges: Edge[] = useMemo(() => [
    // Conexões principais
    { id: 'e1', source: 'app', target: 'auth', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e2', source: 'app', target: 'layout', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e3', source: 'layout', target: 'sidebar', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e4', source: 'layout', target: 'header', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Páginas principais conectadas ao layout
    { id: 'e5', source: 'layout', target: 'dashboard', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e6', source: 'layout', target: 'volumetria', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e7', source: 'layout', target: 'operacional', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e8', source: 'layout', target: 'financeiro', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e9', source: 'layout', target: 'people', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e10', source: 'layout', target: 'config', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e11', source: 'layout', target: 'contratos', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Submódulos operacional
    { id: 'e12', source: 'operacional', target: 'escala', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e13', source: 'operacional', target: 'producao', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e14', source: 'operacional', target: 'qualidade', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Submódulos financeiro
    { id: 'e15', source: 'financeiro', target: 'faturamento', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e16', source: 'financeiro', target: 'pagamentos', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e17', source: 'financeiro', target: 'cobranca', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Submódulos people
    { id: 'e18', source: 'people', target: 'colaboradores', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e19', source: 'people', target: 'carreira', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e20', source: 'people', target: 'desenvolvimento', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Submódulos configuração
    { id: 'e21', source: 'config', target: 'usuarios', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e22', source: 'config', target: 'listas', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Submódulos contratos
    { id: 'e23', source: 'contratos', target: 'contratos-clientes', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e24', source: 'contratos', target: 'contratos-fornecedores', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Backend connections
    { id: 'e25', source: 'auth', target: 'supabase', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e26', source: 'supabase', target: 'edge-functions', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e27', source: 'supabase', target: 'database', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Todas as páginas se conectam ao banco via Supabase
    { id: 'e28', source: 'dashboard', target: 'supabase', type: 'smoothstep', style: { stroke: '#9ca3af' } },
    { id: 'e29', source: 'volumetria', target: 'supabase', type: 'smoothstep', style: { stroke: '#9ca3af' } },
    { id: 'e30', source: 'faturamento', target: 'supabase', type: 'smoothstep', style: { stroke: '#9ca3af' } },
    { id: 'e31', source: 'escala', target: 'supabase', type: 'smoothstep', style: { stroke: '#9ca3af' } },
  ], []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-6 border-b">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🏗️</span>
              Arquitetura do Projeto - Visualização Interativa
            </CardTitle>
            <CardDescription>
              Mapa visual da estrutura do sistema, componentes e suas conexões. 
              Arraste, amplie e explore a arquitetura do projeto em tempo real.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="top-right"
          nodeTypes={nodeTypes}
          style={{ backgroundColor: "#f8fafc" }}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: '#64748b' },
            type: 'smoothstep',
          }}
        >
          <MiniMap 
            zoomable 
            pannable 
            style={{ backgroundColor: '#f1f5f9' }}
            className="border rounded-lg"
          />
          <Controls className="border rounded-lg bg-background" />
          <Background 
            color="#e2e8f0" 
            gap={16} 
            size={1}
          />
        </ReactFlow>
      </div>

      <div className="p-4 border-t bg-muted/30">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-200 border border-blue-500 rounded"></div>
            <span>Páginas Principais</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-200 border border-indigo-500 rounded"></div>
            <span>Módulos Operacionais</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-200 border border-purple-500 rounded"></div>
            <span>Módulos Financeiros</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 border border-green-500 rounded"></div>
            <span>Navegação & Layout</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-500 rounded"></div>
            <span>Backend & Database</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArquiteturaProjeto;