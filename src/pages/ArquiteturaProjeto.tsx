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
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const nodeTypes = {};

const ArquiteturaProjeto = () => {
  const [activeTab, setActiveTab] = useState("sistema");

  // 1. SISTEMA COMPLETO - FLUXO DE PROCESSAMENTO
  const sistemaNodes: Node[] = useMemo(() => [
    // ENTRADA DE DADOS
    {
      id: 'upload-volumetria',
      type: 'default',
      position: { x: 50, y: 100 },
      data: { label: '📤 UPLOAD VOLUMETRIA\n(Arquivos 1,2,3,4)' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 160, height: 70 }
    },
    {
      id: 'mobilemed-futuro',
      type: 'default',
      position: { x: 250, y: 100 },
      data: { label: '🔮 MOBILEMED\n(FUTURO - Online)' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#6b7280', width: 160, height: 70 }
    },

    // PROCESSAMENTO
    {
      id: 'processamento-volumetria',
      type: 'default',
      position: { x: 150, y: 220 },
      data: { label: '⚙️ PROCESSAMENTO\nREGRAS & TRATAMENTOS' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 180, height: 70 }
    },
    {
      id: 'tipo-cliente-faturamento',
      type: 'default',
      position: { x: 150, y: 320 },
      data: { label: '🏷️ APLICAR TIPO CLIENTE\n(NC/CO) & FATURAMENTO\n(CO-FT/NC-FT/NC-NF)' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#b91c1c', width: 180, height: 80 }
    },
    {
      id: 'volumetria-periodo',
      type: 'default',
      position: { x: 150, y: 440 },
      data: { label: '📊 VOLUMETRIA\nDO PERÍODO' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 70 }
    },

    // CADASTROS
    {
      id: 'cadastros',
      type: 'default',
      position: { x: 450, y: 200 },
      data: { label: '📋 CADASTROS' },
      style: { backgroundColor: '#1e40af', color: 'white', borderColor: '#1d4ed8', width: 160, height: 60 }
    },
    {
      id: 'clientes',
      type: 'default',
      position: { x: 400, y: 300 },
      data: { label: '🏥 Clientes' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 100, height: 50 }
    },
    {
      id: 'contratos',
      type: 'default',
      position: { x: 520, y: 300 },
      data: { label: '📄 Contratos' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 100, height: 50 }
    },
    {
      id: 'precos',
      type: 'default',
      position: { x: 400, y: 370 },
      data: { label: '💰 Preços' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 100, height: 50 }
    },
    {
      id: 'medicos',
      type: 'default',
      position: { x: 520, y: 370 },
      data: { label: '👨‍⚕️ Médicos' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 100, height: 50 }
    },
    {
      id: 'parametros',
      type: 'default',
      position: { x: 460, y: 440 },
      data: { label: '⚙️ Parâmetros\nContratos' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 100, height: 50 }
    },

    // PROCESSAMENTO CENTRAL
    {
      id: 'geracao-faturamento',
      type: 'default',
      position: { x: 750, y: 350 },
      data: { label: '🧾 GERAÇÃO\nFATURAMENTO' },
      style: { backgroundColor: '#a855f7', color: 'white', borderColor: '#9333ea', width: 160, height: 70 }
    },
    {
      id: 'pagamento-medicos',
      type: 'default',
      position: { x: 750, y: 500 },
      data: { label: '💳 PAGAMENTO\nMÉDICOS' },
      style: { backgroundColor: '#16a34a', color: 'white', borderColor: '#15803d', width: 160, height: 70 }
    },
    {
      id: 'volumetria-onco',
      type: 'default',
      position: { x: 550, y: 500 },
      data: { label: '🎯 VOLUMETRIA\nONCO (Referência)' },
      style: { backgroundColor: '#f97316', color: 'white', borderColor: '#ea580c', width: 160, height: 70 }
    },

    // SAÍDAS
    {
      id: 'relatorios-email',
      type: 'default',
      position: { x: 1000, y: 250 },
      data: { label: '📧 RELATÓRIOS\nE-MAIL' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 140, height: 60 }
    },
    {
      id: 'emissao-nf',
      type: 'default',
      position: { x: 1000, y: 350 },
      data: { label: '🧾 EMISSÃO\nNOTA FISCAL' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 140, height: 60 }
    },
    {
      id: 'contas-pagar',
      type: 'default',
      position: { x: 1000, y: 500 },
      data: { label: '💰 CONTAS\nA PAGAR' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 140, height: 60 }
    },

    // INTEGRAÇÕES
    {
      id: 'omie-nf',
      type: 'default',
      position: { x: 1200, y: 350 },
      data: { label: '🔗 OMIE\n(NF)' },
      style: { backgroundColor: '#1f2937', color: 'white', borderColor: '#374151', width: 100, height: 60 }
    },
    {
      id: 'omie-pagamentos',
      type: 'default',
      position: { x: 1200, y: 500 },
      data: { label: '🔗 OMIE\n(Pagamentos)' },
      style: { backgroundColor: '#1f2937', color: 'white', borderColor: '#374151', width: 100, height: 60 }
    },
    {
      id: 'clicksign',
      type: 'default',
      position: { x: 1200, y: 250 },
      data: { label: '🔗 CLICKSIGN\n(Contratos)' },
      style: { backgroundColor: '#1f2937', color: 'white', borderColor: '#374151', width: 100, height: 60 }
    },

    // ÁREAS FUNCIONAIS
    {
      id: 'gestao-escalas',
      type: 'default',
      position: { x: 100, y: 600 },
      data: { label: '📅 GESTÃO\nESCALAS' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 120, height: 60 }
    },
    {
      id: 'area-people',
      type: 'default',
      position: { x: 250, y: 600 },
      data: { label: '👥 ÁREA\nPEOPLE' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 120, height: 60 }
    },
    {
      id: 'area-pcp',
      type: 'default',
      position: { x: 400, y: 600 },
      data: { label: '📊 ÁREA\nPCP' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 120, height: 60 }
    },
    {
      id: 'dashboards',
      type: 'default',
      position: { x: 550, y: 600 },
      data: { label: '📈 DASHBOARDS' },
      style: { backgroundColor: '#fecaca', borderColor: '#ef4444', width: 120, height: 60 }
    },
    {
      id: 'mysuite-futuro',
      type: 'default',
      position: { x: 700, y: 600 },
      data: { label: '🔮 MYSUITE\n(FUTURO)' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#6b7280', width: 120, height: 60 }
    },
    {
      id: 'gerador-contratos',
      type: 'default',
      position: { x: 850, y: 600 },
      data: { label: '📝 GERADOR\nCONTRATOS' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 120, height: 60 }
    },
  ], []);

  const sistemaEdges: Edge[] = useMemo(() => [
    // Fluxo principal de dados
    { id: 'e1', source: 'upload-volumetria', target: 'processamento-volumetria', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#f59e0b' } },
    { id: 'e2', source: 'mobilemed-futuro', target: 'processamento-volumetria', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#6b7280', strokeDasharray: '5,5' } },
    { id: 'e3', source: 'processamento-volumetria', target: 'tipo-cliente-faturamento', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#dc2626' } },
    { id: 'e4', source: 'tipo-cliente-faturamento', target: 'volumetria-periodo', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    
    // Conexões com cadastros
    { id: 'e5', source: 'cadastros', target: 'clientes', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e6', source: 'cadastros', target: 'contratos', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e7', source: 'cadastros', target: 'precos', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e8', source: 'cadastros', target: 'medicos', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e9', source: 'cadastros', target: 'parametros', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    
    // Processamento de faturamento
    { id: 'e10', source: 'volumetria-periodo', target: 'geracao-faturamento', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#a855f7' } },
    { id: 'e11', source: 'contratos', target: 'geracao-faturamento', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e12', source: 'precos', target: 'geracao-faturamento', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'e13', source: 'parametros', target: 'geracao-faturamento', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    
    // Processamento de pagamentos médicos
    { id: 'e14', source: 'volumetria-periodo', target: 'pagamento-medicos', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#16a34a' } },
    { id: 'e15', source: 'volumetria-onco', target: 'pagamento-medicos', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f97316' } },
    { id: 'e16', source: 'medicos', target: 'pagamento-medicos', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    
    // Saídas do faturamento
    { id: 'e17', source: 'geracao-faturamento', target: 'relatorios-email', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#a855f7' } },
    { id: 'e18', source: 'geracao-faturamento', target: 'emissao-nf', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#a855f7' } },
    { id: 'e19', source: 'pagamento-medicos', target: 'contas-pagar', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#16a34a' } },
    
    // Integrações
    { id: 'e20', source: 'emissao-nf', target: 'omie-nf', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    { id: 'e21', source: 'contas-pagar', target: 'omie-pagamentos', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    { id: 'e22', source: 'relatorios-email', target: 'clicksign', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    { id: 'e23', source: 'gerador-contratos', target: 'clicksign', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b' } },
    
    // Áreas funcionais
    { id: 'e24', source: 'medicos', target: 'gestao-escalas', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e25', source: 'medicos', target: 'area-people', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e26', source: 'volumetria-periodo', target: 'area-pcp', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e27', source: 'volumetria-periodo', target: 'dashboards', type: 'smoothstep', style: { stroke: '#ef4444' } },
    { id: 'e28', source: 'dashboards', target: 'mysuite-futuro', type: 'smoothstep', style: { stroke: '#6b7280', strokeDasharray: '5,5' } },
    { id: 'e29', source: 'contratos', target: 'gerador-contratos', type: 'smoothstep', style: { stroke: '#f59e0b' } },
  ], []);

  // 2. INTEGRAÇÕES - FUTURAS E ATUAIS
  const integracoesNodes: Node[] = useMemo(() => [
    // SISTEMA CENTRAL
    {
      id: 'sistema-teleimagem',
      type: 'default',
      position: { x: 500, y: 300 },
      data: { label: '🏗️ SISTEMA\nTELEIMAGEM' },
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

    // INTEGRAÇÕES IMPLEMENTADAS
    {
      id: 'supabase',
      type: 'default',
      position: { x: 200, y: 150 },
      data: { label: '✅ SUPABASE\nAuth + Database' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 160, height: 70 }
    },
    {
      id: 'omie',
      type: 'default',
      position: { x: 800, y: 150 },
      data: { label: '✅ OMIE ERP\nNF + Pagamentos' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 160, height: 70 }
    },
    {
      id: 'clicksign',
      type: 'default',
      position: { x: 200, y: 450 },
      data: { label: '✅ CLICKSIGN\nAssinatura Contratos' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 160, height: 70 }
    },
    {
      id: 'resend',
      type: 'default',
      position: { x: 800, y: 450 },
      data: { label: '✅ RESEND\nEnvio E-mails' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 160, height: 70 }
    },

    // INTEGRAÇÕES FUTURAS
    {
      id: 'mobilemed',
      type: 'default',
      position: { x: 350, y: 100 },
      data: { label: '🔮 MOBILEMED\nDados Online/Diários' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 160, height: 70 }
    },
    {
      id: 'mysuite',
      type: 'default',
      position: { x: 650, y: 100 },
      data: { label: '🔮 MYSUITE\nAnálise Qualidade' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 160, height: 70 }
    },

    // FUNCIONALIDADES ESPECÍFICAS
    {
      id: 'upload-manual',
      type: 'default',
      position: { x: 50, y: 300 },
      data: { label: '📤 UPLOAD MANUAL\nArquivos 1,2,3,4' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 140, height: 70 }
    },
    {
      id: 'gerador-pdf',
      type: 'default',
      position: { x: 950, y: 300 },
      data: { label: '📄 GERADOR PDF\nRelatórios + Contratos' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 140, height: 70 }
    },
    {
      id: 'seguranca',
      type: 'default',
      position: { x: 350, y: 500 },
      data: { label: '🔐 SEGURANÇA\nRLS + Audit + 2FA' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#b91c1c', width: 160, height: 70 }
    },
    {
      id: 'analytics',
      type: 'default',
      position: { x: 650, y: 500 },
      data: { label: '📊 ANALYTICS\nDashboards + Métricas' },
      style: { backgroundColor: '#a855f7', color: 'white', borderColor: '#9333ea', width: 160, height: 70 }
    },
  ], []);

  const integracoesEdges: Edge[] = useMemo(() => [
    // Integrações implementadas
    { id: 'i1', source: 'sistema-teleimagem', target: 'supabase', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i2', source: 'sistema-teleimagem', target: 'omie', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i3', source: 'sistema-teleimagem', target: 'clicksign', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i4', source: 'sistema-teleimagem', target: 'resend', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    
    // Integrações futuras
    { id: 'i5', source: 'sistema-teleimagem', target: 'mobilemed', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b', strokeDasharray: '8,8' } },
    { id: 'i6', source: 'sistema-teleimagem', target: 'mysuite', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b', strokeDasharray: '8,8' } },
    
    // Funcionalidades
    { id: 'i7', source: 'upload-manual', target: 'sistema-teleimagem', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'i8', source: 'sistema-teleimagem', target: 'gerador-pdf', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'i9', source: 'sistema-teleimagem', target: 'seguranca', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    { id: 'i10', source: 'sistema-teleimagem', target: 'analytics', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#a855f7' } },
  ], []);

  // 3. ARQUITETURA TÉCNICA
  const arquiteturaNodes: Node[] = useMemo(() => [
    // FRONTEND
    {
      id: 'frontend',
      type: 'default',
      position: { x: 400, y: 50 },
      data: { label: '🌐 FRONTEND\nReact + TypeScript' },
      style: { backgroundColor: '#1e40af', color: 'white', borderColor: '#1d4ed8', width: 180, height: 70 }
    },
    {
      id: 'vite',
      type: 'default',
      position: { x: 200, y: 150 },
      data: { label: '⚡ Vite\nBuild Tool' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120, height: 60 }
    },
    {
      id: 'tailwind',
      type: 'default',
      position: { x: 340, y: 150 },
      data: { label: '🎨 Tailwind CSS\nStyling' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120, height: 60 }
    },
    {
      id: 'shadcn',
      type: 'default',
      position: { x: 480, y: 150 },
      data: { label: '🧩 Shadcn/ui\nComponents' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120, height: 60 }
    },
    {
      id: 'router',
      type: 'default',
      position: { x: 620, y: 150 },
      data: { label: '🛣️ React Router\nNavigation' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 120, height: 60 }
    },

    // BACKEND
    {
      id: 'backend',
      type: 'default',
      position: { x: 400, y: 300 },
      data: { label: '🚀 BACKEND\nSupabase' },
      style: { backgroundColor: '#059669', color: 'white', borderColor: '#047857', width: 180, height: 70 }
    },
    {
      id: 'postgresql',
      type: 'default',
      position: { x: 150, y: 400 },
      data: { label: '🐘 PostgreSQL\nDatabase' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 120, height: 60 }
    },
    {
      id: 'edge-functions',
      type: 'default',
      position: { x: 290, y: 400 },
      data: { label: '⚡ Edge Functions\nServerless' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 120, height: 60 }
    },
    {
      id: 'rls',
      type: 'default',
      position: { x: 430, y: 400 },
      data: { label: '🔒 RLS\nSecurity' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 120, height: 60 }
    },
    {
      id: 'realtime',
      type: 'default',
      position: { x: 570, y: 400 },
      data: { label: '🔄 Realtime\nSubscriptions' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 120, height: 60 }
    },
    {
      id: 'storage',
      type: 'default',
      position: { x: 710, y: 400 },
      data: { label: '💾 Storage\nFiles' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 120, height: 60 }
    },

    // INTEGRAÇÕES EXTERNAS
    {
      id: 'external',
      type: 'default',
      position: { x: 400, y: 550 },
      data: { label: '🔗 INTEGRAÇÕES\nExternas' },
      style: { backgroundColor: '#7c2d12', color: 'white', borderColor: '#92400e', width: 180, height: 70 }
    },
    {
      id: 'omie-ext',
      type: 'default',
      position: { x: 200, y: 650 },
      data: { label: '🏢 Omie ERP' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 100, height: 50 }
    },
    {
      id: 'clicksign-ext',
      type: 'default',
      position: { x: 320, y: 650 },
      data: { label: '✍️ ClickSign' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 100, height: 50 }
    },
    {
      id: 'resend-ext',
      type: 'default',
      position: { x: 440, y: 650 },
      data: { label: '📧 Resend' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 100, height: 50 }
    },
    {
      id: 'mobilemed-ext',
      type: 'default',
      position: { x: 560, y: 650 },
      data: { label: '🏥 MobileMed' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#6b7280', width: 100, height: 50 }
    },
    {
      id: 'mysuite-ext',
      type: 'default',
      position: { x: 680, y: 650 },
      data: { label: '📊 MySuite' },
      style: { backgroundColor: '#e5e7eb', borderColor: '#6b7280', width: 100, height: 50 }
    },
  ], []);

  const arquiteturaEdges: Edge[] = useMemo(() => [
    // Frontend connections
    { id: 'a1', source: 'frontend', target: 'vite', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'a2', source: 'frontend', target: 'tailwind', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'a3', source: 'frontend', target: 'shadcn', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    { id: 'a4', source: 'frontend', target: 'router', type: 'smoothstep', style: { stroke: '#3b82f6' } },
    
    // Frontend to Backend
    { id: 'a5', source: 'frontend', target: 'backend', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#059669' } },
    
    // Backend connections
    { id: 'a6', source: 'backend', target: 'postgresql', type: 'smoothstep', style: { stroke: '#16a34a' } },
    { id: 'a7', source: 'backend', target: 'edge-functions', type: 'smoothstep', style: { stroke: '#16a34a' } },
    { id: 'a8', source: 'backend', target: 'rls', type: 'smoothstep', style: { stroke: '#16a34a' } },
    { id: 'a9', source: 'backend', target: 'realtime', type: 'smoothstep', style: { stroke: '#16a34a' } },
    { id: 'a10', source: 'backend', target: 'storage', type: 'smoothstep', style: { stroke: '#16a34a' } },
    
    // Backend to External
    { id: 'a11', source: 'backend', target: 'external', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#7c2d12' } },
    
    // External connections
    { id: 'a12', source: 'external', target: 'omie-ext', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'a13', source: 'external', target: 'clicksign-ext', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'a14', source: 'external', target: 'resend-ext', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'a15', source: 'external', target: 'mobilemed-ext', type: 'smoothstep', style: { stroke: '#6b7280', strokeDasharray: '5,5' } },
    { id: 'a16', source: 'external', target: 'mysuite-ext', type: 'smoothstep', style: { stroke: '#6b7280', strokeDasharray: '5,5' } },
  ], []);

  // Estados para os flows
  const [sistemaNodesState, setSistemaNodes, onSistemaNodesChange] = useNodesState(sistemaNodes);
  const [sistemaEdgesState, setSistemaEdges, onSistemaEdgesChange] = useEdgesState(sistemaEdges);

  const [integracoesNodesState, setIntegracoesNodes, onIntegracoesNodesChange] = useNodesState(integracoesNodes);
  const [integracoesEdgesState, setIntegracoesEdges, onIntegracoesEdgesChange] = useEdgesState(integracoesEdges);

  const [arquiteturaNodesState, setArquiteturaNodes, onArquiteturaNodesChange] = useNodesState(arquiteturaNodes);
  const [arquiteturaEdgesState, setArquiteturaEdges, onArquiteturaEdgesChange] = useEdgesState(arquiteturaEdges);

  // Callbacks para conectar nodes
  const onSistemaConnect = useCallback(
    (params: any) => setSistemaEdges((eds) => addEdge(params, eds)),
    [setSistemaEdges]
  );

  const onIntegracoesConnect = useCallback(
    (params: any) => setIntegracoesEdges((eds) => addEdge(params, eds)),
    [setIntegracoesEdges]
  );

  const onArquiteturaConnect = useCallback(
    (params: any) => setArquiteturaEdges((eds) => addEdge(params, eds)),
    [setArquiteturaEdges]
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Arquitetura do Sistema Teleimagem
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Visualização completa da estrutura, fluxos e integrações do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sistema">🔄 Fluxo do Sistema</TabsTrigger>
                <TabsTrigger value="integracoes">🔗 Integrações</TabsTrigger>
                <TabsTrigger value="arquitetura">🏗️ Arquitetura Técnica</TabsTrigger>
              </TabsList>

              <TabsContent value="sistema" className="mt-6">
                <div className="h-[800px] w-full border rounded-lg bg-gray-50">
                  <ReactFlow
                    nodes={sistemaNodesState}
                    edges={sistemaEdgesState}
                    onNodesChange={onSistemaNodesChange}
                    onEdgesChange={onSistemaEdgesChange}
                    onConnect={onSistemaConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="top-right"
                  >
                    <MiniMap />
                    <Controls />
                    <Background gap={12} size={1} />
                  </ReactFlow>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p><strong>Fluxo Principal:</strong> Upload → Processamento → Aplicação Tipos → Volumetria → Faturamento → Saídas</p>
                  <p><strong>Legenda:</strong> Linhas sólidas = Implementado | Linhas tracejadas = Futuro</p>
                </div>
              </TabsContent>

              <TabsContent value="integracoes" className="mt-6">
                <div className="h-[600px] w-full border rounded-lg bg-gray-50">
                  <ReactFlow
                    nodes={integracoesNodesState}
                    edges={integracoesEdgesState}
                    onNodesChange={onIntegracoesNodesChange}
                    onEdgesChange={onIntegracoesEdgesChange}
                    onConnect={onIntegracoesConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="top-right"
                  >
                    <MiniMap />
                    <Controls />
                    <Background gap={12} size={1} />
                  </ReactFlow>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p><strong>✅ Verde:</strong> Integrações Implementadas | <strong>🔮 Laranja:</strong> Integrações Futuras</p>
                  <p><strong>Atual:</strong> Supabase, Omie, ClickSign, Resend | <strong>Futuro:</strong> MobileMed, MySuite</p>
                </div>
              </TabsContent>

              <TabsContent value="arquitetura" className="mt-6">
                <div className="h-[700px] w-full border rounded-lg bg-gray-50">
                  <ReactFlow
                    nodes={arquiteturaNodesState}
                    edges={arquiteturaEdgesState}
                    onNodesChange={onArquiteturaNodesChange}
                    onEdgesChange={onArquiteturaEdgesChange}
                    onConnect={onArquiteturaConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="top-right"
                  >
                    <MiniMap />
                    <Controls />
                    <Background gap={12} size={1} />
                  </ReactFlow>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p><strong>Camadas:</strong> Frontend (React) → Backend (Supabase) → Integrações Externas</p>
                  <p><strong>Tecnologias:</strong> TypeScript, Vite, Tailwind, PostgreSQL, Edge Functions</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ArquiteturaProjeto;