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
  const [activeTab, setActiveTab] = useState("mindmap");

  // 1. MAPA MENTAL - Overview e Navegação
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

    // RAMO AUTENTICAÇÃO E SEGURANÇA (Topo)
    {
      id: 'auth-branch',
      type: 'default',
      position: { x: 400, y: 120 },
      data: { label: '🔐 AUTENTICAÇÃO\n& SEGURANÇA' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 140, height: 60 }
    },
    {
      id: 'auth-supabase',
      type: 'default',
      position: { x: 250, y: 50 },
      data: { label: 'Supabase Auth' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 110 }
    },
    {
      id: 'auth-context',
      type: 'default',
      position: { x: 400, y: 30 },
      data: { label: 'AuthContext' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 110 }
    },
    {
      id: 'roles-permissions',
      type: 'default',
      position: { x: 550, y: 50 },
      data: { label: 'Roles & RLS' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 110 }
    },

    // RAMO OPERACIONAL (Esquerda Superior)
    {
      id: 'operacional-branch',
      type: 'default',
      position: { x: 120, y: 200 },
      data: { label: '⚙️ OPERACIONAL' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140, height: 60 }
    },
    {
      id: 'escala-medica',
      type: 'default',
      position: { x: 20, y: 120 },
      data: { label: '📅 Escala Médica' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },
    {
      id: 'producao',
      type: 'default',
      position: { x: 20, y: 180 },
      data: { label: '📊 Produção' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },
    {
      id: 'qualidade',
      type: 'default',
      position: { x: 20, y: 240 },
      data: { label: '✅ Qualidade' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },
    {
      id: 'volumetria',
      type: 'default',
      position: { x: 20, y: 300 },
      data: { label: '📈 Volumetria' },
      style: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', width: 110 }
    },

    // RAMO FINANCEIRO (Direita Superior)
    {
      id: 'financeiro-branch',
      type: 'default',
      position: { x: 680, y: 200 },
      data: { label: '💰 FINANCEIRO' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 140, height: 60 }
    },
    {
      id: 'faturamento',
      type: 'default',
      position: { x: 780, y: 120 },
      data: { label: '🧾 Faturamento' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },
    {
      id: 'pagamentos',
      type: 'default',
      position: { x: 780, y: 180 },
      data: { label: '💳 Pagamentos' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },
    {
      id: 'cobranca',
      type: 'default',
      position: { x: 780, y: 240 },
      data: { label: '📬 Cobrança' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },
    {
      id: 'omie-integration',
      type: 'default',
      position: { x: 780, y: 300 },
      data: { label: '🔗 Integração Omie' },
      style: { backgroundColor: '#faf5ff', borderColor: '#9333ea', width: 110 }
    },

    // RAMO PEOPLE/RH (Esquerda Inferior)
    {
      id: 'people-branch',
      type: 'default',
      position: { x: 120, y: 450 },
      data: { label: '👥 PEOPLE / RH' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 140, height: 60 }
    },
    {
      id: 'colaboradores',
      type: 'default',
      position: { x: 20, y: 400 },
      data: { label: '👤 Colaboradores' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },
    {
      id: 'carreira',
      type: 'default',
      position: { x: 20, y: 460 },
      data: { label: '📈 P. Carreira' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },
    {
      id: 'treinamento',
      type: 'default',
      position: { x: 20, y: 520 },
      data: { label: '🎓 Treinamento' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },
    {
      id: 'medicos-gestao',
      type: 'default',
      position: { x: 20, y: 580 },
      data: { label: '👨‍⚕️ Gestão Médicos' },
      style: { backgroundColor: '#fffbeb', borderColor: '#d97706', width: 110 }
    },

    // RAMO GESTÃO/ADMIN (Direita Inferior)
    {
      id: 'gestao-branch',
      type: 'default',
      position: { x: 680, y: 450 },
      data: { label: '⚡ GESTÃO' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 140, height: 60 }
    },
    {
      id: 'usuarios',
      type: 'default',
      position: { x: 780, y: 380 },
      data: { label: '👨‍💼 Usuários' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },
    {
      id: 'listas',
      type: 'default',
      position: { x: 780, y: 440 },
      data: { label: '📋 Listas Mestras' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },
    {
      id: 'contratos',
      type: 'default',
      position: { x: 780, y: 500 },
      data: { label: '📄 Contratos' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },
    {
      id: 'configuracoes',
      type: 'default',
      position: { x: 780, y: 560 },
      data: { label: '⚙️ Configurações' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 110 }
    },

    // RAMO DADOS E UPLOADS (Inferior Central)
    {
      id: 'dados-branch',
      type: 'default',
      position: { x: 400, y: 550 },
      data: { label: '📊 DADOS & UPLOADS' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 140, height: 60 }
    },
    {
      id: 'upload-dados',
      type: 'default',
      position: { x: 300, y: 620 },
      data: { label: '📤 Upload Dados' },
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
    },
    {
      id: 'importacao-inteligente',
      type: 'default',
      position: { x: 300, y: 680 },
      data: { label: '🧠 Importação\nInteligente' },
      style: { backgroundColor: '#eff6ff', borderColor: '#2563eb', width: 110 }
    },
    {
      id: 'mapeamento-visual',
      type: 'default',
      position: { x: 500, y: 680 },
      data: { label: '🗺️ Mapeamento\nVisual' },
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

    // Ramificações da autenticação e segurança
    { id: 'e-auth1', source: 'auth-branch', target: 'auth-supabase', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-auth2', source: 'auth-branch', target: 'auth-context', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-auth3', source: 'auth-branch', target: 'roles-permissions', type: 'smoothstep', style: { stroke: '#f59e0b' } },

    // Ramificações operacional
    { id: 'e-op1', source: 'operacional-branch', target: 'escala-medica', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'e-op2', source: 'operacional-branch', target: 'producao', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'e-op3', source: 'operacional-branch', target: 'qualidade', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'e-op4', source: 'operacional-branch', target: 'volumetria', type: 'smoothstep', style: { stroke: '#22c55e' } },

    // Ramificações financeiro
    { id: 'e-fin1', source: 'financeiro-branch', target: 'faturamento', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'e-fin2', source: 'financeiro-branch', target: 'pagamentos', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'e-fin3', source: 'financeiro-branch', target: 'cobranca', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'e-fin4', source: 'financeiro-branch', target: 'omie-integration', type: 'smoothstep', style: { stroke: '#a855f7' } },

    // Ramificações people
    { id: 'e-people1', source: 'people-branch', target: 'colaboradores', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-people2', source: 'people-branch', target: 'carreira', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-people3', source: 'people-branch', target: 'treinamento', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e-people4', source: 'people-branch', target: 'medicos-gestao', type: 'smoothstep', style: { stroke: '#f59e0b' } },

    // Ramificações gestão
    { id: 'e-gestao1', source: 'gestao-branch', target: 'usuarios', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e-gestao2', source: 'gestao-branch', target: 'listas', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e-gestao3', source: 'gestao-branch', target: 'contratos', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e-gestao4', source: 'gestao-branch', target: 'configuracoes', type: 'smoothstep', style: { stroke: '#ef4444' } },

    // Ramificações dados e uploads
    { id: 'e-dados1', source: 'dados-branch', target: 'upload-dados', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e-dados2', source: 'dados-branch', target: 'dashboard', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e-dados3', source: 'dados-branch', target: 'relatorios', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e-dados4', source: 'dados-branch', target: 'importacao-inteligente', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e-dados5', source: 'dados-branch', target: 'mapeamento-visual', type: 'smoothstep', style: { stroke: '#3b82f6' } },
  ], []);

  // 2. ERD INTERATIVO - Relações Detalhadas do Banco
  const erdNodes: Node[] = useMemo(() => [
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

    // RAMO SISTEMA E AUDITORIA (Inferior Central)
    {
      id: 'system-branch',
      type: 'default',
      position: { x: 400, y: 550 },
      data: { label: '🔧 SISTEMA & AUDITORIA' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#6b7280', width: 140, height: 60 }
    },
    {
      id: 'upload-logs',
      type: 'default',
      position: { x: 250, y: 620 },
      data: { label: 'upload_logs' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'audit-logs',
      type: 'default',
      position: { x: 350, y: 620 },
      data: { label: 'audit_logs' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'security-alerts',
      type: 'default',
      position: { x: 450, y: 620 },
      data: { label: 'security_alerts' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'data-access-logs',
      type: 'default',
      position: { x: 550, y: 620 },
      data: { label: 'data_access_\nlogs' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'config-protecao',
      type: 'default',
      position: { x: 300, y: 680 },
      data: { label: 'configuracao_\nprotecao' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'prioridades',
      type: 'default',
      position: { x: 400, y: 680 },
      data: { label: 'prioridades' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },
    {
      id: 'field-mappings',
      type: 'default',
      position: { x: 500, y: 680 },
      data: { label: 'field_mappings' },
      style: { backgroundColor: '#f3f4f6', borderColor: '#4b5563', width: 90 }
    },

    // RAMO IMPORTS E TEMPLATES (Superior Central)
    {
      id: 'imports-branch',
      type: 'default',
      position: { x: 400, y: 400 },
      data: { label: '📥 IMPORTS' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 140, height: 60 }
    },
    {
      id: 'import-templates',
      type: 'default',
      position: { x: 300, y: 330 },
      data: { label: 'import_\ntemplates' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 90 }
    },
    {
      id: 'import-history',
      type: 'default',
      position: { x: 400, y: 330 },
      data: { label: 'import_history' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 90 }
    },
    {
      id: 'controle-origem',
      type: 'default',
      position: { x: 500, y: 330 },
      data: { label: 'controle_dados_\norigem' },
      style: { backgroundColor: '#fff7ed', borderColor: '#fb923c', width: 90 }
    }
  ], []);

  const erdEdges: Edge[] = useMemo(() => [
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

    // Ramificações sistema e auditoria
    { id: 's1', source: 'system-branch', target: 'upload-logs', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's2', source: 'system-branch', target: 'audit-logs', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's3', source: 'system-branch', target: 'security-alerts', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's4', source: 'system-branch', target: 'data-access-logs', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's5', source: 'system-branch', target: 'config-protecao', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's6', source: 'system-branch', target: 'prioridades', type: 'smoothstep', style: { stroke: '#6b7280' } },
    { id: 's7', source: 'system-branch', target: 'field-mappings', type: 'smoothstep', style: { stroke: '#6b7280' } },

    // Ramificações imports
    { id: 'imp1', source: 'imports-branch', target: 'import-templates', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'imp2', source: 'imports-branch', target: 'import-history', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'imp3', source: 'imports-branch', target: 'controle-origem', type: 'smoothstep', style: { stroke: '#f59e0b' } },

    // Conexão adicional para imports
    { id: 'db-imports', source: 'db-central', target: 'imports-branch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#374151' } },

    // Relacionamentos entre tabelas (Foreign Keys)
    { id: 'fk1', source: 'medicos', target: 'escalas', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'medico_id' },
    { id: 'fk2', source: 'medicos', target: 'exames', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'medico_id' },
    { id: 'fk3', source: 'clientes-table', target: 'exames', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'cliente_id' },
    { id: 'fk4', source: 'faturamento-table', target: 'regua-cobranca', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'fatura_id' },
    { id: 'fk5', source: 'medicos', target: 'valores-repasse', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'medico_id' },
    { id: 'fk6', source: 'medicos', target: 'pagamentos-med', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'medico_id' },
    { id: 'fk7', source: 'profiles', target: 'user-roles', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'user_id' },
    { id: 'fk8', source: 'profiles', target: 'menu-permissions', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, label: 'user_id' },
  ], []);

  // 3. DIAGRAMA DE ARQUITETURA TÉCNICA
  const architectureNodes: Node[] = useMemo(() => [
    // FRONTEND LAYER
    {
      id: 'frontend-layer',
      type: 'default',
      position: { x: 400, y: 50 },
      data: { label: '🌐 FRONTEND\nReact + TypeScript' },
      style: { 
        backgroundColor: '#1e40af', 
        color: 'white', 
        borderColor: '#1d4ed8', 
        width: 180, 
        height: 80,
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },
    
    // UI Components
    {
      id: 'ui-components',
      type: 'default',
      position: { x: 200, y: 150 },
      data: { label: '🎨 UI Components\n(Shadcn/ui)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 140 }
    },
    {
      id: 'pages',
      type: 'default',
      position: { x: 400, y: 150 },
      data: { label: '📄 Pages\n(React Router)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 140 }
    },
    {
      id: 'state-management',
      type: 'default',
      position: { x: 600, y: 150 },
      data: { label: '⚡ State\n(React Query)' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 140 }
    },

    // BACKEND LAYER
    {
      id: 'backend-layer',
      type: 'default',
      position: { x: 400, y: 300 },
      data: { label: '🚀 BACKEND\nSupabase' },
      style: { 
        backgroundColor: '#059669', 
        color: 'white', 
        borderColor: '#047857', 
        width: 180, 
        height: 80,
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    // Backend Services
    {
      id: 'auth-service',
      type: 'default',
      position: { x: 150, y: 400 },
      data: { label: '🔐 Authentication\n(Supabase Auth)' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140 }
    },
    {
      id: 'database-service',
      type: 'default',
      position: { x: 320, y: 400 },
      data: { label: '🗄️ Database\n(PostgreSQL)' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140 }
    },
    {
      id: 'storage-service',
      type: 'default',
      position: { x: 490, y: 400 },
      data: { label: '📁 Storage\n(Supabase Storage)' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140 }
    },
    {
      id: 'edge-functions',
      type: 'default',
      position: { x: 660, y: 400 },
      data: { label: '⚡ Edge Functions\n(Deno)' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 140 }
    },

    // EXTERNAL INTEGRATIONS
    {
      id: 'integrations',
      type: 'default',
      position: { x: 400, y: 550 },
      data: { label: '🔗 INTEGRAÇÕES\nExternas' },
      style: { 
        backgroundColor: '#7c3aed', 
        color: 'white', 
        borderColor: '#6d28d9', 
        width: 180, 
        height: 80,
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    // External Services
    {
      id: 'email-service',
      type: 'default',
      position: { x: 80, y: 650 },
      data: { label: '📧 Email\n(Resend)' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'pdf-service',
      type: 'default',
      position: { x: 220, y: 650 },
      data: { label: '📄 PDF\n(jsPDF/html2canvas)' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'clicksign',
      type: 'default',
      position: { x: 360, y: 650 },
      data: { label: '✍️ Assinatura\n(ClickSign)' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'omie',
      type: 'default',
      position: { x: 500, y: 650 },
      data: { label: '💼 ERP\n(Omie)' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'mobilemed',
      type: 'default',
      position: { x: 640, y: 650 },
      data: { label: '🏥 Sistema\n(Mobilemed)' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'maps-service',
      type: 'default',
      position: { x: 780, y: 650 },
      data: { label: '🗺️ Maps\n(Leaflet)' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },

    // PERFORMANCE & MONITORING
    {
      id: 'monitoring',
      type: 'default',
      position: { x: 80, y: 750 },
      data: { label: '📊 Performance\nMonitoring' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },
    {
      id: 'backup-service',
      type: 'default',
      position: { x: 220, y: 750 },
      data: { label: '💾 Backup\nManager' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },
    {
      id: 'security-monitor',
      type: 'default',
      position: { x: 360, y: 750 },
      data: { label: '🔒 Security\nMonitor' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },
    {
      id: 'lgpd-compliance',
      type: 'default',
      position: { x: 500, y: 750 },
      data: { label: '🛡️ LGPD\nCompliance' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    }
  ], []);

  const architectureEdges: Edge[] = useMemo(() => [
    // Frontend to Backend
    { id: 'fe-be', source: 'frontend-layer', target: 'backend-layer', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#374151' } },
    
    // Frontend components
    { id: 'fe-ui', source: 'frontend-layer', target: 'ui-components', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'fe-pages', source: 'frontend-layer', target: 'pages', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'fe-state', source: 'frontend-layer', target: 'state-management', type: 'smoothstep', style: { stroke: '#3b82f6' } },

    // Backend services
    { id: 'be-auth', source: 'backend-layer', target: 'auth-service', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'be-db', source: 'backend-layer', target: 'database-service', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'be-storage', source: 'backend-layer', target: 'storage-service', type: 'smoothstep', style: { stroke: '#22c55e' } },
    { id: 'be-edge', source: 'backend-layer', target: 'edge-functions', type: 'smoothstep', style: { stroke: '#22c55e' } },

    // Backend to Integrations
    { id: 'be-int', source: 'backend-layer', target: 'integrations', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#374151' } },
    
    // External integrations
    { id: 'int-email', source: 'integrations', target: 'email-service', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'int-pdf', source: 'integrations', target: 'pdf-service', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'int-click', source: 'integrations', target: 'clicksign', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'int-omie', source: 'integrations', target: 'omie', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'int-mobilemed', source: 'integrations', target: 'mobilemed', type: 'smoothstep', style: { stroke: '#a855f7' } },
    { id: 'int-maps', source: 'integrations', target: 'maps-service', type: 'smoothstep', style: { stroke: '#a855f7' } },

    // Performance & Monitoring connections
    { id: 'edge-monitoring', source: 'edge-functions', target: 'monitoring', type: 'smoothstep', style: { stroke: '#f97316', strokeDasharray: '5,5' } },
    { id: 'edge-backup', source: 'edge-functions', target: 'backup-service', type: 'smoothstep', style: { stroke: '#f97316', strokeDasharray: '5,5' } },
    { id: 'edge-security', source: 'edge-functions', target: 'security-monitor', type: 'smoothstep', style: { stroke: '#f97316', strokeDasharray: '5,5' } },
    { id: 'edge-lgpd', source: 'edge-functions', target: 'lgpd-compliance', type: 'smoothstep', style: { stroke: '#f97316', strokeDasharray: '5,5' } },

    // Direct connections
    { id: 'pages-auth', source: 'pages', target: 'auth-service', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'pages-db', source: 'pages', target: 'database-service', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'state-db', source: 'state-management', target: 'database-service', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'edge-email', source: 'edge-functions', target: 'email-service', type: 'smoothstep', style: { stroke: '#9ca3af', strokeDasharray: '5,5' } },
    { id: 'mobilemed-volumetria', source: 'mobilemed', target: 'database-service', type: 'smoothstep', style: { stroke: '#10b981', strokeDasharray: '10,5' }, label: 'Dados Volumetria' },
    { id: 'omie-faturamento', source: 'omie', target: 'database-service', type: 'smoothstep', style: { stroke: '#10b981', strokeDasharray: '10,5' }, label: 'Sincronização ERP' },
  ], []);

  // 4. FLUXOS DE PROCESSO PRINCIPAIS
  const processNodes: Node[] = useMemo(() => [
    // FLUXO DE UPLOAD E PROCESSAMENTO
    {
      id: 'start-upload',
      type: 'input',
      position: { x: 50, y: 50 },
      data: { label: '📤 Upload\nArquivos' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'validate-file',
      type: 'default',
      position: { x: 250, y: 50 },
      data: { label: '✅ Validar\nFormato' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'process-data',
      type: 'default',
      position: { x: 450, y: 50 },
      data: { label: '⚙️ Processar\nDados' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'save-db',
      type: 'default',
      position: { x: 650, y: 50 },
      data: { label: '💾 Salvar\nBanco' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },
    {
      id: 'log-result',
      type: 'output',
      position: { x: 850, y: 50 },
      data: { label: '📋 Log\nResultado' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },

    // FLUXO DE AUTENTICAÇÃO
    {
      id: 'login-start',
      type: 'input',
      position: { x: 50, y: 200 },
      data: { label: '🔐 Login\nUsuário' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'auth-validate',
      type: 'default',
      position: { x: 250, y: 200 },
      data: { label: '🔍 Validar\nCredenciais' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'check-roles',
      type: 'default',
      position: { x: 450, y: 200 },
      data: { label: '👤 Verificar\nPermissões' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'redirect-dashboard',
      type: 'output',
      position: { x: 650, y: 200 },
      data: { label: '🏠 Redirecionar\nDashboard' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },

    // FLUXO DE FATURAMENTO
    {
      id: 'generate-billing',
      type: 'input',
      position: { x: 50, y: 350 },
      data: { label: '💰 Gerar\nFaturamento' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'collect-exams',
      type: 'default',
      position: { x: 250, y: 350 },
      data: { label: '📊 Coletar\nExames' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'calculate-values',
      type: 'default',
      position: { x: 450, y: 350 },
      data: { label: '🧮 Calcular\nValores' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'create-invoice',
      type: 'default',
      position: { x: 650, y: 350 },
      data: { label: '🧾 Criar\nFatura' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },
    {
      id: 'send-email',
      type: 'output',
      position: { x: 850, y: 350 },
      data: { label: '📧 Enviar\nEmail' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },

    // FLUXO DE ESCALA MÉDICA
    {
      id: 'schedule-start',
      type: 'input',
      position: { x: 50, y: 500 },
      data: { label: '📅 Agendar\nEscala' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'check-availability',
      type: 'default',
      position: { x: 250, y: 500 },
      data: { label: '🔍 Verificar\nDisponibilidade' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'assign-doctor',
      type: 'default',
      position: { x: 450, y: 500 },
      data: { label: '👨‍⚕️ Designar\nMédico' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'confirm-schedule',
      type: 'default',
      position: { x: 650, y: 500 },
      data: { label: '✅ Confirmar\nEscala' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },
    {
      id: 'notify-team',
      type: 'output',
      position: { x: 850, y: 500 },
      data: { label: '📱 Notificar\nEquipe' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },

    // FLUXO DE IMPORTAÇÃO INTELIGENTE
    {
      id: 'import-start',
      type: 'input',
      position: { x: 50, y: 650 },
      data: { label: '📤 Importar\nArquivo' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'detect-format',
      type: 'default',
      position: { x: 250, y: 650 },
      data: { label: '🧠 Detectar\nFormato' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'apply-mapping',
      type: 'default',
      position: { x: 450, y: 650 },
      data: { label: '🗺️ Aplicar\nMapeamento' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'validate-data',
      type: 'default',
      position: { x: 650, y: 650 },
      data: { label: '✅ Validar\nDados' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },
    {
      id: 'import-complete',
      type: 'output',
      position: { x: 850, y: 650 },
      data: { label: '✨ Importação\nCompleta' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    },

    // FLUXO DE SEGURANÇA E AUDITORIA
    {
      id: 'security-event',
      type: 'input',
      position: { x: 50, y: 800 },
      data: { label: '🚨 Evento\nSegurança' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120 }
    },
    {
      id: 'analyze-threat',
      type: 'default',
      position: { x: 250, y: 800 },
      data: { label: '🔍 Analisar\nAmeaça' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120 }
    },
    {
      id: 'create-alert',
      type: 'default',
      position: { x: 450, y: 800 },
      data: { label: '⚠️ Criar\nAlerta' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 120 }
    },
    {
      id: 'log-audit',
      type: 'default',
      position: { x: 650, y: 800 },
      data: { label: '📝 Log\nAuditoria' },
      style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', width: 120 }
    },
    {
      id: 'notify-admin',
      type: 'output',
      position: { x: 850, y: 800 },
      data: { label: '📧 Notificar\nAdmin' },
      style: { backgroundColor: '#fed7c7', borderColor: '#f97316', width: 120 }
    }
  ], []);

  const processEdges: Edge[] = useMemo(() => [
    // Fluxo de Upload
    { id: 'up1', source: 'start-upload', target: 'validate-file', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'up2', source: 'validate-file', target: 'process-data', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'up3', source: 'process-data', target: 'save-db', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'up4', source: 'save-db', target: 'log-result', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Fluxo de Auth
    { id: 'auth1', source: 'login-start', target: 'auth-validate', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'auth2', source: 'auth-validate', target: 'check-roles', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'auth3', source: 'check-roles', target: 'redirect-dashboard', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Fluxo de Faturamento
    { id: 'bill1', source: 'generate-billing', target: 'collect-exams', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'bill2', source: 'collect-exams', target: 'calculate-values', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'bill3', source: 'calculate-values', target: 'create-invoice', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'bill4', source: 'create-invoice', target: 'send-email', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Fluxo de Escala
    { id: 'sched1', source: 'schedule-start', target: 'check-availability', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'sched2', source: 'check-availability', target: 'assign-doctor', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'sched3', source: 'assign-doctor', target: 'confirm-schedule', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'sched4', source: 'confirm-schedule', target: 'notify-team', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Fluxo de Importação Inteligente
    { id: 'imp1', source: 'import-start', target: 'detect-format', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'imp2', source: 'detect-format', target: 'apply-mapping', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'imp3', source: 'apply-mapping', target: 'validate-data', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'imp4', source: 'validate-data', target: 'import-complete', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },

    // Fluxo de Segurança
    { id: 'sec1', source: 'security-event', target: 'analyze-threat', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'sec2', source: 'analyze-threat', target: 'create-alert', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'sec3', source: 'create-alert', target: 'log-audit', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'sec4', source: 'log-audit', target: 'notify-admin', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
  ], []);

  // Estados dos flows
  const [mindMapNodesState, setMindMapNodes, onMindMapNodesChange] = useNodesState(mindMapNodes);
  const [mindMapEdgesState, setMindMapEdges, onMindMapEdgesChange] = useEdgesState(mindMapEdges);
  
  const [erdNodesState, setErdNodes, onErdNodesChange] = useNodesState(erdNodes);
  const [erdEdgesState, setErdEdges, onErdEdgesChange] = useEdgesState(erdEdges);

  const [archNodesState, setArchNodes, onArchNodesChange] = useNodesState(architectureNodes);
  const [archEdgesState, setArchEdges, onArchEdgesChange] = useEdgesState(architectureEdges);

  const [processNodesState, setProcessNodes, onProcessNodesChange] = useNodesState(processNodes);
  const [processEdgesState, setProcessEdges, onProcessEdgesChange] = useEdgesState(processEdges);

  const onConnectMindMap = useCallback((params: any) => setMindMapEdges((eds) => addEdge(params, eds)), [setMindMapEdges]);
  const onConnectErd = useCallback((params: any) => setErdEdges((eds) => addEdge(params, eds)), [setErdEdges]);
  const onConnectArch = useCallback((params: any) => setArchEdges((eds) => addEdge(params, eds)), [setArchEdges]);
  const onConnectProcess = useCallback((params: any) => setProcessEdges((eds) => addEdge(params, eds)), [setProcessEdges]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-6 border-b">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🏗️</span>
              Arquitetura do Projeto - 4 Visualizações Complementares
            </CardTitle>
            <CardDescription>
              Explore o sistema através de diferentes perspectivas: conceitual, técnica, dados e processos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
        <div className="px-6 border-b">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="mindmap">🧠 Mapa Mental</TabsTrigger>
            <TabsTrigger value="erd">🗄️ ERD</TabsTrigger>
            <TabsTrigger value="architecture">🏗️ Arquitetura</TabsTrigger>
            <TabsTrigger value="process">⚡ Processos</TabsTrigger>
          </TabsList>
        </div>

        {/* 1. MAPA MENTAL - Overview e Navegação */}
        <TabsContent value="mindmap" className="flex-1 relative m-0">
          <div className="absolute top-4 left-4 right-4 z-10 p-3 bg-white/95 backdrop-blur border rounded-lg shadow-sm">
            <p className="text-sm text-muted-foreground">
              <strong>🧠 Mapa Mental:</strong> Overview conceitual com núcleo central e ramificações por área (Operacional, Financeiro, People, Gestão, Dados)
            </p>
          </div>
          <ReactFlow
            nodes={mindMapNodesState}
            edges={mindMapEdgesState}
            onNodesChange={onMindMapNodesChange}
            onEdgesChange={onMindMapEdgesChange}
            onConnect={onConnectMindMap}
            fitView
            attributionPosition="top-right"
            nodeTypes={nodeTypes}
            style={{ backgroundColor: "#fefefe" }}
            defaultEdgeOptions={{ style: { strokeWidth: 2 }, type: 'smoothstep' }}
          >
            <MiniMap zoomable pannable style={{ backgroundColor: '#f9fafb' }} className="border rounded-lg" />
            <Controls className="border rounded-lg bg-background" />
            <Background color="#f1f5f9" gap={20} size={2} />
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
            </div>
          </div>
        </TabsContent>

        {/* 2. ERD INTERATIVO - Relações Detalhadas do Banco */}
        <TabsContent value="erd" className="flex-1 relative m-0">
          <div className="absolute top-4 left-4 right-4 z-10 p-3 bg-white/95 backdrop-blur border rounded-lg shadow-sm">
            <p className="text-sm text-muted-foreground">
              <strong>🗄️ ERD Interativo:</strong> Diagrama entidade-relacionamento do banco com todas as tabelas Supabase, foreign keys em vermelho e agrupamento por contexto
            </p>
          </div>
          <ReactFlow
            nodes={erdNodesState}
            edges={erdEdgesState}
            onNodesChange={onErdNodesChange}
            onEdgesChange={onErdEdgesChange}
            onConnect={onConnectErd}
            fitView
            attributionPosition="top-right"
            nodeTypes={nodeTypes}
            style={{ backgroundColor: "#fefefe" }}
            defaultEdgeOptions={{ style: { strokeWidth: 2 }, type: 'smoothstep' }}
          >
            <MiniMap zoomable pannable style={{ backgroundColor: '#f9fafb' }} className="border rounded-lg" />
            <Controls className="border rounded-lg bg-background" />
            <Background color="#f1f5f9" gap={20} size={2} />
          </ReactFlow>
          
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-800 rounded"></div>
                <span>Database Central</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-500 rounded"></div>
                <span>Usuários & Auth</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-500 rounded"></div>
                <span>Médicos & Escalas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded"></div>
                <span>Foreign Keys</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. DIAGRAMA DE ARQUITETURA TÉCNICA */}
        <TabsContent value="architecture" className="flex-1 relative m-0">
          <div className="absolute top-4 left-4 right-4 z-10 p-3 bg-white/95 backdrop-blur border rounded-lg shadow-sm">
            <p className="text-sm text-muted-foreground">
              <strong>🏗️ Arquitetura Técnica:</strong> Camadas Frontend (React), Backend (Supabase), e Integrações Externas (Email, PDF, ClickSign, Omie, Mobilemed) com conexões diretas
            </p>
          </div>
          <ReactFlow
            nodes={archNodesState}
            edges={archEdgesState}
            onNodesChange={onArchNodesChange}
            onEdgesChange={onArchEdgesChange}
            onConnect={onConnectArch}
            fitView
            attributionPosition="top-right"
            nodeTypes={nodeTypes}
            style={{ backgroundColor: "#fefefe" }}
            defaultEdgeOptions={{ style: { strokeWidth: 2 }, type: 'smoothstep' }}
          >
            <MiniMap zoomable pannable style={{ backgroundColor: '#f9fafb' }} className="border rounded-lg" />
            <Controls className="border rounded-lg bg-background" />
            <Background color="#f1f5f9" gap={20} size={2} />
          </ReactFlow>
          
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span>Frontend (React)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-600 rounded"></div>
                <span>Backend (Supabase)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-600 rounded"></div>
                <span>Integrações Externas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded border-dashed border-2"></div>
                <span>Conexões Diretas</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. FLUXOS DE PROCESSO PRINCIPAIS */}
        <TabsContent value="process" className="flex-1 relative m-0">
          <div className="absolute top-4 left-4 right-4 z-10 p-3 bg-white/95 backdrop-blur border rounded-lg shadow-sm">
            <p className="text-sm text-muted-foreground">
              <strong>⚡ Fluxos de Processo:</strong> Workflows principais: Upload/Processamento, Autenticação, Faturamento e Escala Médica com steps sequenciais
            </p>
          </div>
          <ReactFlow
            nodes={processNodesState}
            edges={processEdgesState}
            onNodesChange={onProcessNodesChange}
            onEdgesChange={onProcessEdgesChange}
            onConnect={onConnectProcess}
            fitView
            attributionPosition="top-right"
            nodeTypes={nodeTypes}
            style={{ backgroundColor: "#fefefe" }}
            defaultEdgeOptions={{ style: { strokeWidth: 2 }, type: 'smoothstep' }}
          >
            <MiniMap zoomable pannable style={{ backgroundColor: '#f9fafb' }} className="border rounded-lg" />
            <Controls className="border rounded-lg bg-background" />
            <Background color="#f1f5f9" gap={20} size={2} />
          </ReactFlow>
          
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur border rounded-lg shadow-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-500 rounded"></div>
                <span>Início do Processo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 border border-blue-500 rounded"></div>
                <span>Validação</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-200 border border-purple-500 rounded"></div>
                <span>Processamento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-500 rounded"></div>
                <span>Confirmação</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-200 border border-orange-500 rounded"></div>
                <span>Finalização</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArquiteturaProjeto;