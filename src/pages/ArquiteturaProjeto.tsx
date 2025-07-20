import { useCallback, useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const nodeTypes = {};

const ArquiteturaProjeto = () => {
  const [activeTab, setActiveTab] = useState("arquitetura");

  // MAPA MENTAL - ARQUITETURA DO PROJETO
  const mindMapNodes: Node[] = useMemo(() => [
    // NÚCLEO CENTRAL
    {
      id: 'sistema-central',
      type: 'default',
      position: { x: 400, y: 300 },
      data: { label: '🏗️ TELEIMAGEM\nSISTEMA' },
      style: { 
        backgroundColor: '#1e40af', 
        color: 'white', 
        borderColor: '#1d4ed8', 
        width: 150, 
        height: 80,
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    // RAMO AUTENTICAÇÃO (Topo)
    {
      id: 'auth-branch',
      type: 'default',
      position: { x: 400, y: 120 },
      data: { label: '🔐 AUTENTICAÇÃO' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 140, height: 60 }
    },
    {
      id: 'auth-supabase',
      type: 'default',
      position: { x: 300, y: 50 },
      data: { label: 'Supabase Auth' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 110 }
    },
    {
      id: 'auth-context',
      type: 'default',
      position: { x: 500, y: 50 },
      data: { label: 'AuthContext' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 110 }
    },

    // RAMO OPERACIONAL (Esquerda Superior)
    {
      id: 'operacional-branch',
      type: 'default',
      position: { x: 150, y: 200 },
      data: { label: '⚙️ OPERACIONAL' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140, height: 60 }
    },
    {
      id: 'escala-medica',
      type: 'default',
      position: { x: 50, y: 120 },
      data: { label: '📅 Escala Médica' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },
    {
      id: 'producao',
      type: 'default',
      position: { x: 50, y: 180 },
      data: { label: '📊 Produção' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },
    {
      id: 'qualidade',
      type: 'default',
      position: { x: 50, y: 240 },
      data: { label: '✅ Qualidade' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },

    // RAMO FINANCEIRO (Direita Superior)
    {
      id: 'financeiro-branch',
      type: 'default',
      position: { x: 650, y: 200 },
      data: { label: '💰 FINANCEIRO' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 140, height: 60 }
    },
    {
      id: 'faturamento',
      type: 'default',
      position: { x: 750, y: 120 },
      data: { label: '🧾 Faturamento' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },
    {
      id: 'pagamentos',
      type: 'default',
      position: { x: 750, y: 180 },
      data: { label: '💳 Pagamentos' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },
    {
      id: 'cobranca',
      type: 'default',
      position: { x: 750, y: 240 },
      data: { label: '📬 Cobrança' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },

    // RAMO PEOPLE/RH (Esquerda Inferior)
    {
      id: 'people-branch',
      type: 'default',
      position: { x: 150, y: 450 },
      data: { label: '👥 PEOPLE / RH' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 140, height: 60 }
    },
    {
      id: 'colaboradores',
      type: 'default',
      position: { x: 50, y: 400 },
      data: { label: '👤 Colaboradores' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },
    {
      id: 'carreira',
      type: 'default',
      position: { x: 50, y: 460 },
      data: { label: '📈 P. Carreira' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },
    {
      id: 'treinamento',
      type: 'default',
      position: { x: 50, y: 520 },
      data: { label: '🎓 Treinamento' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },

    // RAMO GESTÃO/ADMIN (Direita Inferior)
    {
      id: 'gestao-branch',
      type: 'default',
      position: { x: 650, y: 450 },
      data: { label: '⚡ GESTÃO' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 140, height: 60 }
    },
    {
      id: 'usuarios',
      type: 'default',
      position: { x: 750, y: 400 },
      data: { label: '👨‍💼 Usuários' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },
    {
      id: 'listas',
      type: 'default',
      position: { x: 750, y: 460 },
      data: { label: '📋 Listas' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },
    {
      id: 'contratos',
      type: 'default',
      position: { x: 750, y: 520 },
      data: { label: '📄 Contratos' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },

    // RAMO DADOS (Inferior Central)
    {
      id: 'dados-branch',
      type: 'default',
      position: { x: 400, y: 550 },
      data: { label: '📊 DADOS' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 140, height: 60 }
    },
    {
      id: 'volumetria',
      type: 'default',
      position: { x: 300, y: 620 },
      data: { label: '📈 Volumetria' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 110 }
    },
    {
      id: 'dashboard',
      type: 'default',
      position: { x: 400, y: 650 },
      data: { label: '🏠 Dashboard' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 110 }
    },
    {
      id: 'relatorios',
      type: 'default',
      position: { x: 500, y: 620 },
      data: { label: '📊 Relatórios' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 110 }
    }
  ], []);

  const mindMapEdges: Edge[] = useMemo(() => [
    // Conexões do núcleo central para os ramos principais
    { id: 'e-auth', source: 'sistema-central', target: 'auth-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'e-op', source: 'sistema-central', target: 'operacional-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'e-fin', source: 'sistema-central', target: 'financeiro-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'e-people', source: 'sistema-central', target: 'people-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'e-gestao', source: 'sistema-central', target: 'gestao-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'e-dados', source: 'sistema-central', target: 'dados-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },

    // Ramificações da autenticação
    { id: 'e-auth1', source: 'auth-branch', target: 'auth-supabase', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-auth2', source: 'auth-branch', target: 'auth-context', type: 'smoothstep', style: { stroke: '#f59e0b' } },

    // Ramificações operacional
    { id: 'e-op1', source: 'operacional-branch', target: 'escala-medica', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'e-op2', source: 'operacional-branch', target: 'producao', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'e-op3', source: 'operacional-branch', target: 'qualidade', type: 'smoothstep', style: { stroke: '#22c55e' } },

    // Ramificações financeiro
    { id: 'e-fin1', source: 'financeiro-branch', target: 'faturamento', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'e-fin2', source: 'financeiro-branch', target: 'pagamentos', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'e-fin3', source: 'financeiro-branch', target: 'cobranca', type: 'smoothstep', style: { stroke: '#a855f7' } },

    // Ramificações people
    { id: 'e-people1', source: 'people-branch', target: 'colaboradores', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-people2', source: 'people-branch', target: 'carreira', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-people3', source: 'people-branch', target: 'treinamento', type: 'smoothstep', style: { stroke: '#f59e0b' } },

    // Ramificações gestão
    { id: 'e-gestao1', source: 'gestao-branch', target: 'usuarios', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e-gestao2', source: 'gestao-branch', target: 'listas', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e-gestao3', source: 'gestao-branch', target: 'contratos', type: 'smoothstep', style: { stroke: '#ef4444' } },

    // Ramificações dados
    { id: 'e-dados1', source: 'dados-branch', target: 'volumetria', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e-dados2', source: 'dados-branch', target: 'dashboard', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e-dados3', source: 'dados-branch', target: 'relatorios', type: 'smoothstep', style: { stroke: '#3b82f6' } },
  ], []);

  // MAPA MENTAL - BANCO DE DADOS
  const databaseNodes: Node[] = useMemo(() => [
    // NÚCLEO CENTRAL DATABASE
    {
      id: 'db-central',
      type: 'default',
      position: { x: 400, y: 300 },
      data: { label: '🗄️ SUPABASE\nDATABASE' },
      style: { 
        backgroundColor: '#1e3a8a', 
        color: 'white', 
        borderColor: '#1d4ed8', 
        width: 150, 
        height: 80,
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    // RAMO USUÁRIOS E PERMISSÕES (Topo)
    {
      id: 'users-branch',
      type: 'default',
      position: { x: 400, y: 120 },
      data: { label: '👥 USUÁRIOS' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 140, height: 60 }
    },
    {
      id: 'profiles',
      type: 'default',
      position: { x: 280, y: 50 },
      data: { label: 'profiles' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 90 }
    },
    {
      id: 'user-roles',
      type: 'default',
      position: { x: 380, y: 30 },
      data: { label: 'user_roles' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 90 }
    },
    {
      id: 'menu-permissions',
      type: 'default',
      position: { x: 480, y: 50 },
      data: { label: 'user_menu_\npermissions' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 90 }
    },

    // RAMO MÉDICOS E ESCALAS (Esquerda Superior)
    {
      id: 'medicos-branch',
      type: 'default',
      position: { x: 150, y: 200 },
      data: { label: '👨‍⚕️ MÉDICOS' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140, height: 60 }
    },
    {
      id: 'medicos',
      type: 'default',
      position: { x: 50, y: 120 },
      data: { label: 'medicos' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 90 }
    },
    {
      id: 'escalas',
      type: 'default',
      position: { x: 50, y: 180 },
      data: { label: 'escalas_medicas' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 90 }
    },
    {
      id: 'valores-repasse',
      type: 'default',
      position: { x: 50, y: 240 },
      data: { label: 'medicos_valores_\nrepasse' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 90 }
    },
    {
      id: 'pagamentos-med',
      type: 'default',
      position: { x: 50, y: 300 },
      data: { label: 'pagamentos_\nmedicos' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 90 }
    },

    // RAMO FATURAMENTO (Direita Superior)
    {
      id: 'billing-branch',
      type: 'default',
      position: { x: 650, y: 200 },
      data: { label: '💰 FATURAMENTO' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 140, height: 60 }
    },
    {
      id: 'faturamento-table',
      type: 'default',
      position: { x: 750, y: 120 },
      data: { label: 'faturamento' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 90 }
    },
    {
      id: 'regua-cobranca',
      type: 'default',
      position: { x: 750, y: 180 },
      data: { label: 'regua_cobranca' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 90 }
    },
    {
      id: 'emails-cobranca',
      type: 'default',
      position: { x: 750, y: 240 },
      data: { label: 'emails_cobranca' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 90 }
    },

    // RAMO CLIENTES E EXAMES (Esquerda Inferior)
    {
      id: 'clients-branch',
      type: 'default',
      position: { x: 150, y: 450 },
      data: { label: '🏥 CLIENTES' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 140, height: 60 }
    },
    {
      id: 'clientes-table',
      type: 'default',
      position: { x: 50, y: 400 },
      data: { label: 'clientes' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 90 }
    },
    {
      id: 'exames',
      type: 'default',
      position: { x: 50, y: 460 },
      data: { label: 'exames' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 90 }
    },
    {
      id: 'documentos',
      type: 'default',
      position: { x: 50, y: 520 },
      data: { label: 'documentos_\nclientes' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 90 }
    },

    // RAMO CONFIGURAÇÕES (Direita Inferior)
    {
      id: 'config-branch',
      type: 'default',
      position: { x: 650, y: 450 },
      data: { label: '⚙️ CONFIGURAÇÕES' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 140, height: 60 }
    },
    {
      id: 'especialidades',
      type: 'default',
      position: { x: 750, y: 380 },
      data: { label: 'especialidades' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 90 }
    },
    {
      id: 'modalidades',
      type: 'default',
      position: { x: 750, y: 430 },
      data: { label: 'modalidades' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 90 }
    },
    {
      id: 'categorias-exame',
      type: 'default',
      position: { x: 750, y: 480 },
      data: { label: 'categorias_exame' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 90 }
    },
    {
      id: 'categorias-medico',
      type: 'default',
      position: { x: 750, y: 530 },
      data: { label: 'categorias_medico' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 90 }
    },

    // RAMO SISTEMA (Inferior Central)
    {
      id: 'system-branch',
      type: 'default',
      position: { x: 400, y: 550 },
      data: { label: '🔧 SISTEMA' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#6b7280', width: 140, height: 60 }
    },
    {
      id: 'upload-logs',
      type: 'default',
      position: { x: 320, y: 620 },
      data: { label: 'upload_logs' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'config-protecao',
      type: 'default',
      position: { x: 420, y: 650 },
      data: { label: 'configuracao_\nprotecao' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'prioridades',
      type: 'default',
      position: { x: 520, y: 620 },
      data: { label: 'prioridades' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    }
  ], []);

  const databaseEdges: Edge[] = useMemo(() => [
    // Conexões do núcleo central para os ramos principais
    { id: 'db-users', source: 'db-central', target: 'users-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'db-medicos', source: 'db-central', target: 'medicos-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'db-billing', source: 'db-central', target: 'billing-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'db-clients', source: 'db-central', target: 'clients-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'db-config', source: 'db-central', target: 'config-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },
    { id: 'db-system', source: 'db-central', target: 'system-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },

    // Ramificações usuários
    { id: 'u1', source: 'users-branch', target: 'profiles', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'u2', source: 'users-branch', target: 'user-roles', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'u3', source: 'users-branch', target: 'menu-permissions', type: 'smoothstep', style: { stroke: '#f59e0b' } },

    // Ramificações médicos
    { id: 'm1', source: 'medicos-branch', target: 'medicos', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'm2', source: 'medicos-branch', target: 'escalas', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'm3', source: 'medicos-branch', target: 'valores-repasse', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'm4', source: 'medicos-branch', target: 'pagamentos-med', type: 'smoothstep', style: { stroke: '#22c55e' } },

    // Ramificações faturamento
    { id: 'b1', source: 'billing-branch', target: 'faturamento-table', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'b2', source: 'billing-branch', target: 'regua-cobranca', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'b3', source: 'billing-branch', target: 'emails-cobranca', type: 'smoothstep', style: { stroke: '#a855f7' } },

    // Ramificações clientes
    { id: 'c1', source: 'clients-branch', target: 'clientes-table', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'c2', source: 'clients-branch', target: 'exames', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'c3', source: 'clients-branch', target: 'documentos', type: 'smoothstep', style: { stroke: '#3b82f6' } },

    // Ramificações configurações
    { id: 'cfg1', source: 'config-branch', target: 'especialidades', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'cfg2', source: 'config-branch', target: 'modalidades', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'cfg3', source: 'config-branch', target: 'categorias-exame', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'cfg4', source: 'config-branch', target: 'categorias-medico', type: 'smoothstep', style: { stroke: '#ef4444' } },

    // Ramificações sistema
    { id: 's1', source: 'system-branch', target: 'upload-logs', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's2', source: 'system-branch', target: 'config-protecao', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's3', source: 'system-branch', target: 'prioridades', type: 'smoothstep', style: { stroke: '#6b7280' } },

    // Relacionamentos entre tabelas (conexões cruzadas importantes)
    { id: 'rel1', source: 'medicos', target: 'escalas', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'rel2', source: 'medicos', target: 'exames', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'rel3', source: 'clientes-table', target: 'exames', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'rel4', source: 'faturamento-table', target: 'regua-cobranca', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
  ], []);

  // Estados dos flows
  const [mindMapNodesState, setMindMapNodes, onMindMapNodesChange] = useNodesState(mindMapNodes);
  const [mindMapEdgesState, setMindMapEdges, onMindMapEdgesChange] = useEdgesState(mindMapEdges);
  
  const [dbNodesState, setDbNodes, onDbNodesChange] = useNodesState(databaseNodes);
  const [dbEdgesState, setDbEdges, onDbEdgesChange] = useEdgesState(databaseEdges);

  // Para compatibilidade, mantemos os nodes antigos também
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
              <span>🧠</span>
              Mapa Mental - Arquitetura do Projeto
            </CardTitle>
            <CardDescription>
              Visualização em formato de mapa mental da estrutura do sistema e banco de dados. 
              Explore as conexões e ramificações de forma orgânica e intuitiva.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
        <div className="px-6 border-b">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="arquitetura">🏗️ Arquitetura</TabsTrigger>
            <TabsTrigger value="database">🗄️ Banco de Dados</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="arquitetura" className="flex-1 relative m-0">
          <ReactFlow
            nodes={mindMapNodesState}
            edges={mindMapEdgesState}
            onNodesChange={onMindMapNodesChange}
            onEdgesChange={onMindMapEdgesChange}
            onConnect={useCallback((params: any) => setMindMapEdges((eds) => addEdge(params, eds)), [setMindMapEdges])}
            fitView
            attributionPosition="top-right"
            nodeTypes={nodeTypes}
            style={{ backgroundColor: "#fefefe" }}
            defaultEdgeOptions={{
              style: { strokeWidth: 2 },
              type: 'smoothstep',
            }}
          >
            <MiniMap 
              zoomable 
              pannable 
              style={{ backgroundColor: '#f9fafb' }}
              className="border rounded-lg"
            />
            <Controls className="border rounded-lg bg-background" />
            <Background 
              color="#f1f5f9" 
              gap={20} 
              size={2}
            />
          </ReactFlow>
          
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span>Sistema Central</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-500 rounded"></div>
                <span>Operacional</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-200 border border-purple-500 rounded"></div>
                <span>Financeiro</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-500 rounded"></div>
                <span>Autenticação & People</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-200 border border-red-500 rounded"></div>
                <span>Gestão & Admin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 border border-blue-500 rounded"></div>
                <span>Dados & Relatórios</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="database" className="flex-1 relative m-0">
          <ReactFlow
            nodes={dbNodesState}
            edges={dbEdgesState}
            onNodesChange={onDbNodesChange}
            onEdgesChange={onDbEdgesChange}
            onConnect={useCallback((params: any) => setDbEdges((eds) => addEdge(params, eds)), [setDbEdges])}
            fitView
            attributionPosition="top-right"
            nodeTypes={nodeTypes}
            style={{ backgroundColor: "#fefefe" }}
            defaultEdgeOptions={{
              style: { strokeWidth: 2 },
              type: 'smoothstep',
            }}
          >
            <MiniMap 
              zoomable 
              pannable 
              style={{ backgroundColor: '#f9fafb' }}
              className="border rounded-lg"
            />
            <Controls className="border rounded-lg bg-background" />
            <Background 
              color="#f1f5f9" 
              gap={20} 
              size={2}
            />
          </ReactFlow>
          
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-800 rounded"></div>
                <span>Database Central</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-500 rounded"></div>
                <span>Usuários & Permissões</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-500 rounded"></div>
                <span>Médicos & Escalas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-200 border border-purple-500 rounded"></div>
                <span>Faturamento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 border border-blue-500 rounded"></div>
                <span>Clientes & Exames</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-200 border border-red-500 rounded"></div>
                <span>Configurações</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 border border-gray-500 rounded"></div>
                <span>Sistema</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded border-dashed border-2"></div>
                <span>Relacionamentos</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArquiteturaProjeto;