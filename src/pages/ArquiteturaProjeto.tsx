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
    // ENTRADA DE DADOS - NOVA ARQUITETURA DE STAGING
    {
      id: 'upload-volumetria',
      type: 'default',
      position: { x: 50, y: 100 },
      data: { label: '⚡ UPLOAD VOLUMETRIA\n(Nova Arquitetura Staging)\nArquivos 1,2,3,4' },
      style: { backgroundColor: '#10b981', borderColor: '#059669', color: 'white', width: 180, height: 80, fontWeight: 'bold' }
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

  // 4. NOVA ARQUITETURA DE STAGING - FLUXO DETALHADO
  const stagingNodes: Node[] = useMemo(() => [
    // USUÁRIO
    {
      id: 'user-upload',
      type: 'default',
      position: { x: 50, y: 200 },
      data: { label: '👤 USUÁRIO\nSeleciona Arquivo' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 150, height: 70 }
    },

    // ETAPA 1: UPLOAD
    {
      id: 'file-upload',
      type: 'default',
      position: { x: 250, y: 200 },
      data: { label: '📁 UPLOAD FILE\nArquivos 1,2,3,4\n(.xlsx)' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 150, height: 80, fontWeight: 'bold' }
    },

    // ETAPA 2: STORAGE
    {
      id: 'supabase-storage',
      type: 'default',
      position: { x: 450, y: 200 },
      data: { label: '💾 STORAGE\nSupabase Storage\n(5 segundos)' },
      style: { backgroundColor: '#059669', color: 'white', borderColor: '#047857', width: 150, height: 80, fontWeight: 'bold' }
    },

    // ETAPA 3: STAGING
    {
      id: 'staging-process',
      type: 'default',
      position: { x: 650, y: 200 },
      data: { label: '🔄 STAGING\nEdge Function\nProcessa Excel\n(30 segundos)' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 150, height: 90, fontWeight: 'bold' }
    },

    // ETAPA 4: BACKGROUND
    {
      id: 'background-rules',
      type: 'default',
      position: { x: 850, y: 200 },
      data: { label: '🏗️ BACKGROUND\nAplica Regras\nTriggers DB\n(2 minutos)' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#b91c1c', width: 150, height: 90, fontWeight: 'bold' }
    },

    // ETAPA 5: DASHBOARD
    {
      id: 'realtime-dashboard',
      type: 'default',
      position: { x: 1050, y: 200 },
      data: { label: '📊 DASHBOARD\nAtualização\nReal-time\n(Automática)' },
      style: { backgroundColor: '#a855f7', color: 'white', borderColor: '#9333ea', width: 150, height: 90, fontWeight: 'bold' }
    },

    // DETALHES TÉCNICOS - STAGING
    {
      id: 'staging-details',
      type: 'default',
      position: { x: 650, y: 350 },
      data: { label: '📋 STAGING DETALHES\n• Lê Excel XLSX\n• Valida estrutura\n• Insere em lotes\n• Monitora progresso' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 180, height: 90 }
    },

    // DETALHES TÉCNICOS - BACKGROUND  
    {
      id: 'background-details',
      type: 'default',
      position: { x: 850, y: 350 },
      data: { label: '🔧 REGRAS APLICADAS\n• Limpeza de dados\n• De-Para valores\n• Categorização\n• Quebras de exames\n• Tipificação' },
      style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 180, height: 110 }
    },

    // DETALHES TÉCNICOS - REAL-TIME
    {
      id: 'realtime-details',
      type: 'default',
      position: { x: 1050, y: 350 },
      data: { label: '🔔 REAL-TIME\n• PostgreSQL Changes\n• Supabase Realtime\n• Context Updates\n• Dashboard Refresh' },
      style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', width: 180, height: 100 }
    },

    // MONITORAMENTO
    {
      id: 'monitoring',
      type: 'default',
      position: { x: 450, y: 50 },
      data: { label: '👀 MONITORAMENTO\nTabela: processamento_uploads\nStatus em tempo real' },
      style: { backgroundColor: '#1e40af', color: 'white', borderColor: '#1d4ed8', width: 200, height: 80 }
    },

    // VANTAGENS
    {
      id: 'advantages',
      type: 'default',
      position: { x: 250, y: 500 },
      data: { label: '✅ VANTAGENS NOVA ARQUITETURA\n• Sem travamentos\n• Upload ultrarrápido\n• Tolerante a falhas\n• Monitoramento real-time\n• Processamento robusto' },
      style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 250, height: 120 }
    },

    // COMPATIBILIDADE  
    {
      id: 'compatibility',
      type: 'default',
      position: { x: 550, y: 500 },
      data: { label: '🔄 COMPATIBILIDADE\n• Mesmos arquivos (1,2,3,4)\n• Mesmas regras de negócio\n• Mesmos dashboards\n• Zero downtime na migração' },
      style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', width: 250, height: 120 }
    },

    // EDGE FUNCTIONS
    {
      id: 'edge-functions-detail',
      type: 'default',
      position: { x: 850, y: 50 },
      data: { label: '⚡ EDGE FUNCTIONS\n• processar-volumetria-staging\n• processar-staging-background\n• Escalabilidade automática' },
      style: { backgroundColor: '#059669', color: 'white', borderColor: '#047857', width: 200, height: 90 }
    }
  ], []);

  const stagingEdges: Edge[] = useMemo(() => [
    // Fluxo principal da nova arquitetura
    { id: 's1', source: 'user-upload', target: 'file-upload', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#10b981' }, label: '1. Seleciona' },
    { id: 's2', source: 'file-upload', target: 'supabase-storage', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#059669' }, label: '2. Upload' },
    { id: 's3', source: 'supabase-storage', target: 'staging-process', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#f59e0b' }, label: '3. Processa' },
    { id: 's4', source: 'staging-process', target: 'background-rules', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#dc2626' }, label: '4. Aplica Regras' },
    { id: 's5', source: 'background-rules', target: 'realtime-dashboard', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#a855f7' }, label: '5. Atualiza UI' },

    // Conexões com detalhes técnicos
    { id: 's6', source: 'staging-process', target: 'staging-details', type: 'smoothstep', style: { stroke: '#f59e0b', strokeDasharray: '5,5' } },
    { id: 's7', source: 'background-rules', target: 'background-details', type: 'smoothstep', style: { stroke: '#dc2626', strokeDasharray: '5,5' } },
    { id: 's8', source: 'realtime-dashboard', target: 'realtime-details', type: 'smoothstep', style: { stroke: '#a855f7', strokeDasharray: '5,5' } },

    // Monitoramento
    { id: 's9', source: 'monitoring', target: 'staging-process', type: 'smoothstep', style: { stroke: '#1e40af', strokeDasharray: '3,3' } },
    { id: 's10', source: 'monitoring', target: 'background-rules', type: 'smoothstep', style: { stroke: '#1e40af', strokeDasharray: '3,3' } },

    // Edge Functions
    { id: 's11', source: 'edge-functions-detail', target: 'staging-process', type: 'smoothstep', style: { stroke: '#059669', strokeDasharray: '3,3' } },
    { id: 's12', source: 'edge-functions-detail', target: 'background-rules', type: 'smoothstep', style: { stroke: '#059669', strokeDasharray: '3,3' } },

    // Vantagens e compatibilidade (apenas visuais)
    { id: 's13', source: 'file-upload', target: 'advantages', type: 'smoothstep', style: { stroke: '#16a34a', strokeDasharray: '8,8' } },
    { id: 's14', source: 'staging-process', target: 'compatibility', type: 'smoothstep', style: { stroke: '#3b82f6', strokeDasharray: '8,8' } }
  ], []);

  // Estados para os flows
  const [sistemaNodesState, setSistemaNodes, onSistemaNodesChange] = useNodesState(sistemaNodes);
  const [sistemaEdgesState, setSistemaEdges, onSistemaEdgesChange] = useEdgesState(sistemaEdges);

  const [stagingNodesState, setStagingNodes, onStagingNodesChange] = useNodesState(stagingNodes);
  const [stagingEdgesState, setStagingEdges, onStagingEdgesChange] = useEdgesState(stagingEdges);

  const [integracoesNodesState, setIntegracoesNodes, onIntegracoesNodesChange] = useNodesState(integracoesNodes);
  const [integracoesEdgesState, setIntegracoesEdges, onIntegracoesEdgesChange] = useEdgesState(integracoesEdges);

  const [arquiteturaNodesState, setArquiteturaNodes, onArquiteturaNodesChange] = useNodesState(arquiteturaNodes);
  const [arquiteturaEdgesState, setArquiteturaEdges, onArquiteturaEdgesChange] = useEdgesState(arquiteturaEdges);

  // Callbacks para conectar nodes
  const onSistemaConnect = useCallback(
    (params: any) => setSistemaEdges((eds) => addEdge(params, eds)),
    [setSistemaEdges]
  );

  const onStagingConnect = useCallback(
    (params: any) => setStagingEdges((eds) => addEdge(params, eds)),
    [setStagingEdges]
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="sistema">🔄 Fluxo do Sistema</TabsTrigger>
                <TabsTrigger value="staging">⚡ Nova Arquitetura</TabsTrigger>
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
                  <p><strong>Legenda:</strong> ⚡ Verde = Nova Arquitetura Implementada | Linhas sólidas = Implementado | Linhas tracejadas = Futuro</p>
                </div>
              </TabsContent>

              <TabsContent value="staging" className="mt-6">
                <div className="h-[700px] w-full border rounded-lg bg-gradient-to-br from-blue-50 to-green-50">
                  <ReactFlow
                    nodes={stagingNodesState}
                    edges={stagingEdgesState}
                    onNodesChange={onStagingNodesChange}
                    onEdgesChange={onStagingEdgesChange}
                    onConnect={onStagingConnect}
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
                  <p><strong>🎯 Fluxo Nova Arquitetura:</strong> 📁 Upload → 💾 Storage → 🔄 Staging → 🏗️ Background → 📊 Dashboard</p>
                  <p><strong>⏱️ Tempos:</strong> Upload (5s) → Storage (instantâneo) → Staging (30s) → Background (2min) → Dashboard (real-time)</p>
                  <p><strong>✅ Vantagens:</strong> Sem travamentos, Ultrarrápido, Monitoramento real-time, Tolerante a falhas</p>
                </div>

                {/* Detalhamento das Funções por Etapa */}
                <div className="mt-8 space-y-6">
                  <h3 className="text-2xl font-bold text-center mb-6">🔧 Funções Executadas em Cada Etapa</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* ETAPA 1: UPLOAD */}
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-700">
                          <span className="text-lg">📁</span>
                          ETAPA 1: UPLOAD (5 segundos)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-green-800 mb-2">Interface (React):</h4>
                          <ul className="text-xs space-y-1 text-green-700">
                            <li>• FileUpload.tsx</li>
                            <li>• VolumetriaUpload.tsx</li>
                            <li>• SimpleFileUpload.tsx</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-green-800 mb-2">Validações Frontend:</h4>
                          <ul className="text-xs space-y-1 text-green-700">
                            <li>• Validação formato .xlsx</li>
                            <li>• Verificação tamanho arquivo</li>
                            <li>• Seleção período referência</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ETAPA 2: STORAGE */}
                    <Card className="border-cyan-200 bg-cyan-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-cyan-700">
                          <span className="text-lg">💾</span>
                          ETAPA 2: STORAGE (Instantâneo)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-cyan-800 mb-2">Supabase Storage:</h4>
                          <ul className="text-xs space-y-1 text-cyan-700">
                            <li>• Upload bucket 'uploads'</li>
                            <li>• Geração URL temporária</li>
                            <li>• Controle acesso RLS</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-cyan-800 mb-2">Trigger Automático:</h4>
                          <ul className="text-xs space-y-1 text-cyan-700">
                            <li>• Disparo edge function</li>
                            <li>• Criação lote_upload ID</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ETAPA 3: STAGING */}
                    <Card className="border-orange-200 bg-orange-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700">
                          <span className="text-lg">🔄</span>
                          ETAPA 3: STAGING (30 segundos)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-orange-800 mb-2">Edge Function Principal:</h4>
                          <ul className="text-xs space-y-1 text-orange-700">
                            <li>• <strong>processar-volumetria-staging</strong></li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-orange-800 mb-2">Operações Executadas:</h4>
                          <ul className="text-xs space-y-1 text-orange-700">
                            <li>• Leitura arquivo Excel (XLSX.readFile)</li>
                            <li>• Validação estrutura colunas</li>
                            <li>• Processamento em lotes (1000 registros)</li>
                            <li>• Inserção tabela volumetria_staging</li>
                            <li>• Atualização status processamento_uploads</li>
                            <li>• Trigger background processing</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-orange-800 mb-2">Tabelas Atualizadas:</h4>
                          <ul className="text-xs space-y-1 text-orange-700">
                            <li>• processamento_uploads</li>
                            <li>• volumetria_staging</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ETAPA 4: BACKGROUND - PARTE 1 */}
                    <Card className="border-red-200 bg-red-50 lg:col-span-2 xl:col-span-1">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                          <span className="text-lg">🏗️</span>
                          ETAPA 4A: BACKGROUND - REGRAS (1 minuto)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Edge Function Principal:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• <strong>processar-staging-background</strong></li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Regras de Transformação:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• <strong>trigger_limpar_nome_cliente</strong> (v015)</li>
                            <li>• <strong>trigger_normalizar_medico</strong> (v017)</li>
                            <li>• <strong>aplicar_correcao_modalidades</strong> (v030)</li>
                            <li>• <strong>aplicar_categorias_trigger</strong> (v028)</li>
                            <li>• <strong>aplicar_prioridades_de_para</strong> (v018)</li>
                            <li>• <strong>aplicar_de_para_trigger</strong> (v026)</li>
                            <li>• <strong>aplicar_tipificacao_faturamento</strong> (f005/f006)</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Regras de Exclusão:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• <strong>aplicar_regras_periodo_atual</strong> (v031)</li>
                            <li>• <strong>aplicar_regras_retroativas</strong> (v002/v003)</li>
                            <li>• <strong>aplicar_regras_exclusao_dinamicas</strong> (v020)</li>
                            <li>• <strong>aplicar_exclusao_clientes_especificos</strong> (v032)</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ETAPA 4: BACKGROUND - PARTE 2 */}
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                          <span className="text-lg">⚡</span>
                          ETAPA 4B: EDGE FUNCTIONS ESPECÍFICAS (30 segundos)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Edge Functions Chamadas:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• <strong>aplicar-quebras-automatico</strong></li>
                            <li>• <strong>aplicar-substituicao-especialidade-categoria</strong> (v033/v034)</li>
                            <li>• <strong>aplicar-especialidade-automatica</strong> (v023)</li>
                            <li>• <strong>aplicar-validacao-cliente</strong> (v021)</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Operações Específicas:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• Quebra de exames compostos</li>
                            <li>• Substituição especialidades Colunas</li>
                            <li>• Aplicação categorias cadastro</li>
                            <li>• Validação clientes ativos</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Tabelas Consultadas:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• cadastro_exames</li>
                            <li>• regras_quebra_exames</li>
                            <li>• clientes</li>
                            <li>• medicos</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ETAPA 4: BACKGROUND - PARTE 3 */}
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                          <span className="text-lg">🔧</span>
                          ETAPA 4C: FINALIZAÇÃO (30 segundos)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Operações Finais:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• Atualização status 'concluido'</li>
                            <li>• Cálculo estatísticas finais</li>
                            <li>• Log audit_logs</li>
                            <li>• Limpeza volumetria_staging</li>
                            <li>• Trigger dashboard refresh</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Tabelas Finais:</h4>
                          <ul className="text-xs space-y-1 text-red-700">
                            <li>• volumetria_mobilemed (destino)</li>
                            <li>• processamento_uploads (status)</li>
                            <li>• audit_logs (rastreabilidade)</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ETAPA 5: DASHBOARD */}
                    <Card className="border-purple-200 bg-purple-50 lg:col-span-2 xl:col-span-1">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-700">
                          <span className="text-lg">📊</span>
                          ETAPA 5: DASHBOARD REAL-TIME (Automático)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-purple-800 mb-2">Hooks React Atualizados:</h4>
                          <ul className="text-xs space-y-1 text-purple-700">
                            <li>• <strong>useVolumetriaData</strong></li>
                            <li>• <strong>useUploadStatus</strong></li>
                            <li>• <strong>useClienteStats</strong></li>
                            <li>• <strong>useVolumetriaProcessedData</strong></li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-purple-800 mb-2">Componentes Atualizados:</h4>
                          <ul className="text-xs space-y-1 text-purple-700">
                            <li>• Dashboard principal</li>
                            <li>• VolumetriaStats</li>
                            <li>• StatusRegraProcessamento</li>
                            <li>• UploadStatusPanel</li>
                            <li>• CompactUploadStatus</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-purple-800 mb-2">Tecnologia Real-time:</h4>
                          <ul className="text-xs space-y-1 text-purple-700">
                            <li>• PostgreSQL LISTEN/NOTIFY</li>
                            <li>• Supabase Realtime</li>
                            <li>• React Context Updates</li>
                            <li>• Automatic Re-renders</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* MONITORAMENTO E AUDITORIA */}
                    <Card className="border-blue-200 bg-blue-50 lg:col-span-2 xl:col-span-3">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700">
                          <span className="text-lg">👀</span>
                          MONITORAMENTO E AUDITORIA (Contínuo)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="font-semibold text-sm text-blue-800 mb-2">Tabelas de Controle:</h4>
                            <ul className="text-xs space-y-1 text-blue-700">
                              <li>• <strong>processamento_uploads</strong> - Status em tempo real</li>
                              <li>• <strong>audit_logs</strong> - Log completo de operações</li>
                              <li>• <strong>performance_logs</strong> - Métricas de performance</li>
                              <li>• <strong>data_access_logs</strong> - Controle de acesso</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-blue-800 mb-2">RLS Policies Aplicadas:</h4>
                            <ul className="text-xs space-y-1 text-blue-700">
                              <li>• Proteção temporal can_edit_data()</li>
                              <li>• Controle período fechamento</li>
                              <li>• Validação permissões usuário</li>
                              <li>• Auditoria automática mudanças</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-blue-800 mb-2">Triggers Database:</h4>
                            <ul className="text-xs space-y-1 text-blue-700">
                              <li>• <strong>audit_trigger</strong> - Auditoria automática</li>
                              <li>• <strong>monitor_sensitive_access</strong> - Acesso dados sensíveis</li>
                              <li>• <strong>audit_sensitive_changes</strong> - Mudanças críticas</li>
                              <li>• <strong>round_precos_servicos</strong> - Arredondamento valores</li>
                            </ul>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                          <h4 className="font-semibold text-sm text-blue-800 mb-2">⚡ Performance e Escalabilidade:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ul className="text-xs space-y-1 text-blue-700">
                              <li>• <strong>Processamento em lotes:</strong> 1000 registros por vez</li>
                              <li>• <strong>Cache otimizado:</strong> Refresh a cada 5 minutos</li>
                              <li>• <strong>Edge Functions:</strong> Escalabilidade automática</li>
                            </ul>
                            <ul className="text-xs space-y-1 text-blue-700">
                              <li>• <strong>Background tasks:</strong> Não bloqueiam UI</li>
                              <li>• <strong>Cleanup automático:</strong> Limpeza staging após 1h</li>
                              <li>• <strong>Real-time updates:</strong> Zero polling</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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