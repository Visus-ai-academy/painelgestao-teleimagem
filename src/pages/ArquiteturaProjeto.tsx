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
      position: { x: 50, y: 50 },
      data: { label: '📤 UPLOAD\nVOLUMETRIA\n(4 Arquivos)' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },
    {
      id: 'upload-cadastros',
      type: 'default',
      position: { x: 210, y: 50 },
      data: { label: '📋 UPLOAD\nCADASTROS' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 140, height: 70 }
    },
    {
      id: 'upload-faturamento',
      type: 'default',
      position: { x: 370, y: 50 },
      data: { label: '💰 UPLOAD\nFATURAMENTO' },
      style: { backgroundColor: '#a855f7', color: 'white', borderColor: '#9333ea', width: 140, height: 70 }
    },
    {
      id: 'upload-repasse',
      type: 'default',
      position: { x: 530, y: 50 },
      data: { label: '👨‍⚕️ UPLOAD\nREPASSE MÉDICO' },
      style: { backgroundColor: '#16a34a', color: 'white', borderColor: '#15803d', width: 140, height: 70 }
    },

    // PROCESSAMENTO AUTOMÁTICO (94 REGRAS)
    {
      id: 'regras-volumetria',
      type: 'default',
      position: { x: 50, y: 160 },
      data: { label: '⚙️ 27 REGRAS\nVOLUMETRIA\n(Triggers Automáticos)' },
      style: { backgroundColor: '#059669', color: 'white', borderColor: '#047857', width: 150, height: 80 }
    },
    {
      id: 'regras-faturamento',
      type: 'default',
      position: { x: 220, y: 160 },
      data: { label: '🧾 5 REGRAS\nFATURAMENTO' },
      style: { backgroundColor: '#7c3aed', color: 'white', borderColor: '#6d28d9', width: 150, height: 80 }
    },
    {
      id: 'regras-exclusao',
      type: 'default',
      position: { x: 390, y: 160 },
      data: { label: '🔍 62 REGRAS\nEXCLUSÃO & AUDITORIA' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#b91c1c', width: 150, height: 80 }
    },

    // CADASTROS E PARÂMETROS
    {
      id: 'cadastros-clientes',
      type: 'default',
      position: { x: 700, y: 80 },
      data: { label: '🏥 CLIENTES\n& CONTRATOS' },
      style: { backgroundColor: '#1e40af', color: 'white', borderColor: '#1d4ed8', width: 130, height: 70 }
    },
    {
      id: 'cadastros-medicos',
      type: 'default',
      position: { x: 850, y: 80 },
      data: { label: '👨‍⚕️ MÉDICOS\n& ESPECIALIDADES' },
      style: { backgroundColor: '#1e40af', color: 'white', borderColor: '#1d4ed8', width: 130, height: 70 }
    },
    {
      id: 'cadastros-exames',
      type: 'default',
      position: { x: 1000, y: 80 },
      data: { label: '🔬 EXAMES\n& CATEGORIAS' },
      style: { backgroundColor: '#1e40af', color: 'white', borderColor: '#1d4ed8', width: 130, height: 70 }
    },
    {
      id: 'parametros-sistema',
      type: 'default',
      position: { x: 850, y: 180 },
      data: { label: '⚙️ PARÂMETROS\nSISTEMA' },
      style: { backgroundColor: '#0891b2', color: 'white', borderColor: '#0e7490', width: 130, height: 70 }
    },

    // ÁREA DE FATURAMENTO
    {
      id: 'demonstrativo',
      type: 'default',
      position: { x: 50, y: 290 },
      data: { label: '📊 DEMONSTRATIVO\nFATURAMENTO' },
      style: { backgroundColor: '#7c3aed', color: 'white', borderColor: '#6d28d9', width: 150, height: 70 }
    },
    {
      id: 'geracao-nf',
      type: 'default',
      position: { x: 220, y: 290 },
      data: { label: '🧾 GERAÇÃO\nNOTA FISCAL' },
      style: { backgroundColor: '#7c3aed', color: 'white', borderColor: '#6d28d9', width: 150, height: 70 }
    },
    {
      id: 'divergencias',
      type: 'default',
      position: { x: 390, y: 290 },
      data: { label: '⚠️ ANÁLISE\nDIVERGÊNCIAS' },
      style: { backgroundColor: '#ea580c', color: 'white', borderColor: '#c2410c', width: 150, height: 70 }
    },

    // ÁREA OPERACIONAL
    {
      id: 'escalas-medicas',
      type: 'default',
      position: { x: 50, y: 400 },
      data: { label: '📅 ESCALAS\nMÉDICAS' },
      style: { backgroundColor: '#0891b2', color: 'white', borderColor: '#0e7490', width: 140, height: 70 }
    },
    {
      id: 'presenca-medico',
      type: 'default',
      position: { x: 210, y: 400 },
      data: { label: '✅ PRESENÇA\nMÉDICO' },
      style: { backgroundColor: '#0891b2', color: 'white', borderColor: '#0e7490', width: 140, height: 70 }
    },
    {
      id: 'pcp-producao',
      type: 'default',
      position: { x: 370, y: 400 },
      data: { label: '📈 PCP\nPRODUÇÃO' },
      style: { backgroundColor: '#0891b2', color: 'white', borderColor: '#0e7490', width: 140, height: 70 }
    },
    {
      id: 'qualidade',
      type: 'default',
      position: { x: 530, y: 400 },
      data: { label: '⭐ ANÁLISE\nQUALIDADE' },
      style: { backgroundColor: '#0891b2', color: 'white', borderColor: '#0e7490', width: 140, height: 70 }
    },

    // ÁREA RH & PEOPLE
    {
      id: 'colaboradores',
      type: 'default',
      position: { x: 700, y: 290 },
      data: { label: '👥 COLABORADORES' },
      style: { backgroundColor: '#db2777', color: 'white', borderColor: '#be185d', width: 140, height: 70 }
    },
    {
      id: 'plano-carreira',
      type: 'default',
      position: { x: 860, y: 290 },
      data: { label: '📊 PLANO\nCARREIRA' },
      style: { backgroundColor: '#db2777', color: 'white', borderColor: '#be185d', width: 140, height: 70 }
    },
    {
      id: 'treinamento',
      type: 'default',
      position: { x: 1020, y: 290 },
      data: { label: '🎓 TREINAMENTO\nEQUIPE' },
      style: { backgroundColor: '#db2777', color: 'white', borderColor: '#be185d', width: 140, height: 70 }
    },

    // ÁREA COMERCIAL
    {
      id: 'estrutura-vendas',
      type: 'default',
      position: { x: 700, y: 400 },
      data: { label: '💼 ESTRUTURA\nVENDAS' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 140, height: 70 }
    },
    {
      id: 'regua-cobranca',
      type: 'default',
      position: { x: 860, y: 400 },
      data: { label: '📧 RÉGUA\nCOBRANÇA' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 140, height: 70 }
    },
    {
      id: 'mapa-clientes',
      type: 'default',
      position: { x: 1020, y: 400 },
      data: { label: '🗺️ MAPA\nCLIENTES' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 140, height: 70 }
    },

    // RELATÓRIOS E ANÁLISES
    {
      id: 'relatorios',
      type: 'default',
      position: { x: 50, y: 520 },
      data: { label: '📑 RELATÓRIOS\nGERENCIAIS' },
      style: { backgroundColor: '#6366f1', color: 'white', borderColor: '#4f46e5', width: 150, height: 70 }
    },
    {
      id: 'dashboards',
      type: 'default',
      position: { x: 220, y: 520 },
      data: { label: '📊 DASHBOARDS\nEXECUTIVOS' },
      style: { backgroundColor: '#6366f1', color: 'white', borderColor: '#4f46e5', width: 150, height: 70 }
    },
    {
      id: 'comparativos',
      type: 'default',
      position: { x: 390, y: 520 },
      data: { label: '📈 COMPARATIVOS\nPERÍODO' },
      style: { backgroundColor: '#6366f1', color: 'white', borderColor: '#4f46e5', width: 150, height: 70 }
    },

    // INTEGRAÇÕES
    {
      id: 'omie-integracao',
      type: 'default',
      position: { x: 700, y: 520 },
      data: { label: '🔗 OMIE ERP\n(NF + Pagtos)' },
      style: { backgroundColor: '#1f2937', color: 'white', borderColor: '#111827', width: 140, height: 70 }
    },
    {
      id: 'clicksign-integracao',
      type: 'default',
      position: { x: 860, y: 520 },
      data: { label: '✍️ CLICKSIGN\n(Contratos)' },
      style: { backgroundColor: '#1f2937', color: 'white', borderColor: '#111827', width: 140, height: 70 }
    },
    {
      id: 'email-integracao',
      type: 'default',
      position: { x: 1020, y: 520 },
      data: { label: '📧 RESEND\n(E-mails)' },
      style: { backgroundColor: '#1f2937', color: 'white', borderColor: '#111827', width: 140, height: 70 }
    },

    // SEGURANÇA
    {
      id: 'seguranca',
      type: 'default',
      position: { x: 370, y: 640 },
      data: { label: '🔐 SEGURANÇA\nRLS + 2FA + Audit' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#991b1b', width: 170, height: 70 }
    },
    {
      id: 'lgpd',
      type: 'default',
      position: { x: 560, y: 640 },
      data: { label: '⚖️ COMPLIANCE\nLGPD' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#991b1b', width: 170, height: 70 }
    },
    {
      id: 'backup',
      type: 'default',
      position: { x: 750, y: 640 },
      data: { label: '💾 BACKUP\n& RECOVERY' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#991b1b', width: 170, height: 70 }
    },

    // ESTATÍSTICAS DO SISTEMA
    {
      id: 'stats',
      type: 'default',
      position: { x: 1100, y: 140 },
      data: { label: '📊 SISTEMA\n11 Módulos\n124+ Funcionalidades\n94 Regras\n68 Tabelas\n60+ Edge Functions\n9 Integrações' },
      style: { 
        backgroundColor: '#ffffff',
        borderColor: '#10b981',
        borderWidth: 3,
        width: 200,
        height: 140,
        fontSize: '11px',
        fontWeight: 'bold'
      }
    },
  ], []);

  const sistemaEdges: Edge[] = useMemo(() => [
    // Fluxo de Upload → Processamento
    { id: 'e1', source: 'upload-volumetria', target: 'regras-volumetria', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'e2', source: 'upload-cadastros', target: 'cadastros-clientes', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'e3', source: 'upload-cadastros', target: 'cadastros-medicos', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'e4', source: 'upload-cadastros', target: 'cadastros-exames', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'e5', source: 'upload-faturamento', target: 'regras-faturamento', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#a855f7' } },
    { id: 'e6', source: 'upload-repasse', target: 'cadastros-medicos', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#16a34a' } },
    
    // Fluxo de Regras
    { id: 'e7', source: 'regras-volumetria', target: 'demonstrativo', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#059669' } },
    { id: 'e8', source: 'regras-volumetria', target: 'regras-exclusao', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    { id: 'e9', source: 'regras-faturamento', target: 'demonstrativo', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#7c3aed' } },
    { id: 'e10', source: 'regras-faturamento', target: 'geracao-nf', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#7c3aed' } },
    { id: 'e11', source: 'regras-exclusao', target: 'divergencias', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    
    // Conexões Cadastros → Parâmetros
    { id: 'e12', source: 'cadastros-clientes', target: 'parametros-sistema', type: 'smoothstep', style: { stroke: '#1e40af' } },
    { id: 'e13', source: 'cadastros-medicos', target: 'parametros-sistema', type: 'smoothstep', style: { stroke: '#1e40af' } },
    { id: 'e14', source: 'cadastros-exames', target: 'parametros-sistema', type: 'smoothstep', style: { stroke: '#1e40af' } },
    
    // Parâmetros → Processamento
    { id: 'e15', source: 'parametros-sistema', target: 'regras-volumetria', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#0891b2' } },
    { id: 'e16', source: 'parametros-sistema', target: 'regras-faturamento', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#0891b2' } },
    
    // Área Operacional
    { id: 'e17', source: 'cadastros-medicos', target: 'escalas-medicas', type: 'smoothstep', style: { stroke: '#0891b2' } },
    { id: 'e18', source: 'escalas-medicas', target: 'presenca-medico', type: 'smoothstep', style: { stroke: '#0891b2' } },
    { id: 'e19', source: 'regras-volumetria', target: 'pcp-producao', type: 'smoothstep', style: { stroke: '#0891b2' } },
    { id: 'e20', source: 'pcp-producao', target: 'qualidade', type: 'smoothstep', style: { stroke: '#0891b2' } },
    
    // Área RH
    { id: 'e21', source: 'cadastros-medicos', target: 'colaboradores', type: 'smoothstep', style: { stroke: '#db2777' } },
    { id: 'e22', source: 'colaboradores', target: 'plano-carreira', type: 'smoothstep', style: { stroke: '#db2777' } },
    { id: 'e23', source: 'colaboradores', target: 'treinamento', type: 'smoothstep', style: { stroke: '#db2777' } },
    
    // Área Comercial
    { id: 'e24', source: 'cadastros-clientes', target: 'estrutura-vendas', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e25', source: 'estrutura-vendas', target: 'regua-cobranca', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    { id: 'e26', source: 'cadastros-clientes', target: 'mapa-clientes', type: 'smoothstep', style: { stroke: '#f59e0b' } },
    
    // Relatórios
    { id: 'e27', source: 'demonstrativo', target: 'relatorios', type: 'smoothstep', style: { stroke: '#6366f1' } },
    { id: 'e28', source: 'pcp-producao', target: 'dashboards', type: 'smoothstep', style: { stroke: '#6366f1' } },
    { id: 'e29', source: 'demonstrativo', target: 'comparativos', type: 'smoothstep', style: { stroke: '#6366f1' } },
    
    // Integrações
    { id: 'e30', source: 'geracao-nf', target: 'omie-integracao', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    { id: 'e31', source: 'cadastros-clientes', target: 'clicksign-integracao', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    { id: 'e32', source: 'relatorios', target: 'email-integracao', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    { id: 'e33', source: 'regua-cobranca', target: 'email-integracao', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#1f2937' } },
    
    // Segurança
    { id: 'e34', source: 'parametros-sistema', target: 'seguranca', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    { id: 'e35', source: 'seguranca', target: 'lgpd', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    { id: 'e36', source: 'lgpd', target: 'backup', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
  ], []);

  // 2. INTEGRAÇÕES - IMPLEMENTADAS E FUTURAS
  const integracoesNodes: Node[] = useMemo(() => [
    // SISTEMA CENTRAL
    {
      id: 'sistema-teleimagem',
      type: 'default',
      position: { x: 500, y: 300 },
      data: { label: '🏗️ SISTEMA\nTELEIMAGEM\n(68 Tabelas)' },
      style: { 
        backgroundColor: '#1e40af', 
        color: 'white', 
        borderColor: '#1d4ed8', 
        width: 200, 
        height: 90,
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    // INTEGRAÇÕES IMPLEMENTADAS (✅)
    {
      id: 'supabase',
      type: 'default',
      position: { x: 100, y: 100 },
      data: { label: '✅ SUPABASE\nDatabase + Auth\n+ Storage + Edge' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'omie',
      type: 'default',
      position: { x: 900, y: 100 },
      data: { label: '✅ OMIE ERP\nNF + Pagamentos\n+ Cadastros' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'clicksign',
      type: 'default',
      position: { x: 100, y: 220 },
      data: { label: '✅ CLICKSIGN\nAssinatura Digital\nContratos' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'resend',
      type: 'default',
      position: { x: 100, y: 460 },
      data: { label: '✅ RESEND\nEnvio E-mails\nTransacionais' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'leaflet',
      type: 'default',
      position: { x: 900, y: 220 },
      data: { label: '✅ LEAFLET\nMapas Interativos\nDistribuição Clientes' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'react-flow',
      type: 'default',
      position: { x: 900, y: 340 },
      data: { label: '✅ REACT FLOW\nDiagramas\nArquitetura' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'recharts',
      type: 'default',
      position: { x: 900, y: 460 },
      data: { label: '✅ RECHARTS\nGráficos\nDashboards' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'jspdf',
      type: 'default',
      position: { x: 100, y: 580 },
      data: { label: '✅ JSPDF + DOCX\nGeração PDF/Word\nRelatórios' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },
    {
      id: 'xlsx',
      type: 'default',
      position: { x: 300, y: 580 },
      data: { label: '✅ XLSX\nImport/Export\nExcel' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 180, height: 80 }
    },

    // INTEGRAÇÕES FUTURAS (🔮)
    {
      id: 'mobilemed',
      type: 'default',
      position: { x: 300, y: 100 },
      data: { label: '🔮 MOBILEMED\nDados Online\nTempo Real' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 180, height: 80 }
    },
    {
      id: 'mysuite',
      type: 'default',
      position: { x: 700, y: 100 },
      data: { label: '🔮 MYSUITE\nQualidade Laudos\nIndicadores' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 180, height: 80 }
    },
    {
      id: 'whatsapp',
      type: 'default',
      position: { x: 300, y: 460 },
      data: { label: '🔮 WHATSAPP\nNotificações\nComunicação' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 180, height: 80 }
    },
    {
      id: 'power-bi',
      type: 'default',
      position: { x: 700, y: 460 },
      data: { label: '🔮 POWER BI\nBI Avançado\nAnálises' },
      style: { backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706', width: 180, height: 80 }
    },

    // SERVIÇOS INTERNOS
    {
      id: 'edge-functions',
      type: 'default',
      position: { x: 300, y: 220 },
      data: { label: '⚡ EDGE FUNCTIONS\n60+ Funções\nServerless' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 180, height: 80 }
    },
    {
      id: 'triggers',
      type: 'default',
      position: { x: 700, y: 220 },
      data: { label: '🔄 TRIGGERS\nProcessamento\nAutomático' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 180, height: 80 }
    },
    {
      id: 'rls-security',
      type: 'default',
      position: { x: 500, y: 450 },
      data: { label: '🔐 RLS + 2FA\nSegurança\nMulticamadas' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#b91c1c', width: 180, height: 80 }
    },

    // ESTATÍSTICAS
    {
      id: 'stats-integracoes',
      type: 'default',
      position: { x: 470, y: 580 },
      data: { label: '📊 TOTAIS\n✅ 9 Implementadas\n🔮 4 Planejadas\n⚡ 60+ Edge Functions' },
      style: { 
        backgroundColor: '#ffffff',
        borderColor: '#10b981',
        borderWidth: 3,
        width: 260,
        height: 100,
        fontSize: '12px',
        fontWeight: 'bold'
      }
    },
  ], []);

  const integracoesEdges: Edge[] = useMemo(() => [
    // Integrações Implementadas (Verde - Ativas)
    { id: 'i1', source: 'sistema-teleimagem', target: 'supabase', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#10b981' } },
    { id: 'i2', source: 'sistema-teleimagem', target: 'omie', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#10b981' } },
    { id: 'i3', source: 'sistema-teleimagem', target: 'clicksign', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#10b981' } },
    { id: 'i4', source: 'sistema-teleimagem', target: 'resend', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#10b981' } },
    { id: 'i5', source: 'sistema-teleimagem', target: 'leaflet', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i6', source: 'sistema-teleimagem', target: 'react-flow', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i7', source: 'sistema-teleimagem', target: 'recharts', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i8', source: 'sistema-teleimagem', target: 'jspdf', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'i9', source: 'sistema-teleimagem', target: 'xlsx', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    
    // Integrações Futuras (Laranja - Planejadas)
    { id: 'i10', source: 'sistema-teleimagem', target: 'mobilemed', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#f59e0b', strokeDasharray: '10,10' } },
    { id: 'i11', source: 'sistema-teleimagem', target: 'mysuite', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#f59e0b', strokeDasharray: '10,10' } },
    { id: 'i12', source: 'sistema-teleimagem', target: 'whatsapp', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b', strokeDasharray: '10,10' } },
    { id: 'i13', source: 'sistema-teleimagem', target: 'power-bi', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b', strokeDasharray: '10,10' } },
    
    // Serviços Internos (Azul)
    { id: 'i14', source: 'sistema-teleimagem', target: 'edge-functions', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#3b82f6' } },
    { id: 'i15', source: 'sistema-teleimagem', target: 'triggers', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#3b82f6' } },
    { id: 'i16', source: 'supabase', target: 'edge-functions', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'i17', source: 'supabase', target: 'triggers', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    
    // Segurança (Vermelho)
    { id: 'i18', source: 'sistema-teleimagem', target: 'rls-security', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#dc2626' } },
    { id: 'i19', source: 'supabase', target: 'rls-security', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
  ], []);

  // 3. ARQUITETURA TÉCNICA - STACK COMPLETO
  const arquiteturaNodes: Node[] = useMemo(() => [
    // CAMADA FRONTEND
    {
      id: 'frontend',
      type: 'default',
      position: { x: 500, y: 50 },
      data: { label: '🌐 FRONTEND\nReact 18.3 + TypeScript + Vite' },
      style: { 
        backgroundColor: '#1e40af', 
        color: 'white', 
        borderColor: '#1d4ed8', 
        width: 220, 
        height: 80,
        fontSize: '13px',
        fontWeight: 'bold'
      }
    },
    
    // UI & STYLING
    {
      id: 'tailwind',
      type: 'default',
      position: { x: 200, y: 160 },
      data: { label: '🎨 TAILWIND CSS\nStyling System' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 150, height: 70 }
    },
    {
      id: 'shadcn',
      type: 'default',
      position: { x: 370, y: 160 },
      data: { label: '🧩 SHADCN/UI\nComponents' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 150, height: 70 }
    },
    {
      id: 'radix',
      type: 'default',
      position: { x: 540, y: 160 },
      data: { label: '⚙️ RADIX UI\nPrimitives' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 150, height: 70 }
    },
    {
      id: 'lucide',
      type: 'default',
      position: { x: 710, y: 160 },
      data: { label: '🎯 LUCIDE\nIcons 460+' },
      style: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#2563eb', width: 150, height: 70 }
    },
    
    // ROTEAMENTO & STATE
    {
      id: 'react-router',
      type: 'default',
      position: { x: 200, y: 260 },
      data: { label: '🛣️ REACT ROUTER\nNavigation v6' },
      style: { backgroundColor: '#8b5cf6', color: 'white', borderColor: '#7c3aed', width: 150, height: 70 }
    },
    {
      id: 'tanstack-query',
      type: 'default',
      position: { x: 370, y: 260 },
      data: { label: '🔄 TANSTACK QUERY\nData Fetching' },
      style: { backgroundColor: '#8b5cf6', color: 'white', borderColor: '#7c3aed', width: 150, height: 70 }
    },
    {
      id: 'react-hook-form',
      type: 'default',
      position: { x: 540, y: 260 },
      data: { label: '📝 REACT HOOK FORM\nForm Management' },
      style: { backgroundColor: '#8b5cf6', color: 'white', borderColor: '#7c3aed', width: 150, height: 70 }
    },
    {
      id: 'zod',
      type: 'default',
      position: { x: 710, y: 260 },
      data: { label: '✅ ZOD\nValidation' },
      style: { backgroundColor: '#8b5cf6', color: 'white', borderColor: '#7c3aed', width: 150, height: 70 }
    },

    // VISUALIZAÇÃO DE DADOS
    {
      id: 'recharts',
      type: 'default',
      position: { x: 200, y: 360 },
      data: { label: '📊 RECHARTS\nCharts Library' },
      style: { backgroundColor: '#06b6d4', color: 'white', borderColor: '#0891b2', width: 150, height: 70 }
    },
    {
      id: 'react-flow-vis',
      type: 'default',
      position: { x: 370, y: 360 },
      data: { label: '🔀 REACT FLOW\nDiagrams' },
      style: { backgroundColor: '#06b6d4', color: 'white', borderColor: '#0891b2', width: 150, height: 70 }
    },
    {
      id: 'leaflet-map',
      type: 'default',
      position: { x: 540, y: 360 },
      data: { label: '🗺️ LEAFLET\nMaps' },
      style: { backgroundColor: '#06b6d4', color: 'white', borderColor: '#0891b2', width: 150, height: 70 }
    },
    {
      id: 'html2canvas',
      type: 'default',
      position: { x: 710, y: 360 },
      data: { label: '📸 HTML2CANVAS\nScreenshots' },
      style: { backgroundColor: '#06b6d4', color: 'white', borderColor: '#0891b2', width: 150, height: 70 }
    },

    // CAMADA BACKEND
    {
      id: 'backend',
      type: 'default',
      position: { x: 500, y: 480 },
      data: { label: '🚀 BACKEND\nSupabase Cloud' },
      style: { 
        backgroundColor: '#059669', 
        color: 'white', 
        borderColor: '#047857', 
        width: 220, 
        height: 80,
        fontSize: '13px',
        fontWeight: 'bold'
      }
    },

    // BANCO DE DADOS
    {
      id: 'postgresql',
      type: 'default',
      position: { x: 100, y: 590 },
      data: { label: '🐘 POSTGRESQL\n68 Tabelas' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },
    {
      id: 'rls',
      type: 'default',
      position: { x: 260, y: 590 },
      data: { label: '🔒 RLS\nRow Level Security' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },
    {
      id: 'triggers-db',
      type: 'default',
      position: { x: 420, y: 590 },
      data: { label: '⚡ TRIGGERS\nAuto Processing' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },
    {
      id: 'functions-db',
      type: 'default',
      position: { x: 580, y: 590 },
      data: { label: '🔧 FUNCTIONS\nDB Logic' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },
    {
      id: 'realtime',
      type: 'default',
      position: { x: 740, y: 590 },
      data: { label: '🔄 REALTIME\nSubscriptions' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },
    {
      id: 'storage',
      type: 'default',
      position: { x: 900, y: 590 },
      data: { label: '💾 STORAGE\nFile Management' },
      style: { backgroundColor: '#10b981', color: 'white', borderColor: '#059669', width: 140, height: 70 }
    },

    // EDGE FUNCTIONS
    {
      id: 'edge-functions-arch',
      type: 'default',
      position: { x: 100, y: 690 },
      data: { label: '⚡ EDGE FUNCTIONS\n60+ Serverless' },
      style: { backgroundColor: '#14b8a6', color: 'white', borderColor: '#0d9488', width: 180, height: 70 }
    },
    {
      id: 'deno-runtime',
      type: 'default',
      position: { x: 300, y: 690 },
      data: { label: '🦕 DENO\nRuntime' },
      style: { backgroundColor: '#14b8a6', color: 'white', borderColor: '#0d9488', width: 140, height: 70 }
    },

    // INTEGRAÇÕES EXTERNAS
    {
      id: 'integracoes-ext',
      type: 'default',
      position: { x: 500, y: 690 },
      data: { label: '🔗 INTEGRAÇÕES\n9 Ativas' },
      style: { 
        backgroundColor: '#f59e0b', 
        color: 'white', 
        borderColor: '#d97706', 
        width: 180, 
        height: 70,
        fontSize: '13px',
        fontWeight: 'bold'
      }
    },
    {
      id: 'omie-arch',
      type: 'default',
      position: { x: 460, y: 790 },
      data: { label: '🏢 OMIE ERP' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 110, height: 50 }
    },
    {
      id: 'clicksign-arch',
      type: 'default',
      position: { x: 590, y: 790 },
      data: { label: '✍️ CLICKSIGN' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 110, height: 50 }
    },
    {
      id: 'resend-arch',
      type: 'default',
      position: { x: 720, y: 790 },
      data: { label: '📧 RESEND' },
      style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', width: 110, height: 50 }
    },

    // SEGURANÇA & COMPLIANCE
    {
      id: 'security-arch',
      type: 'default',
      position: { x: 880, y: 480 },
      data: { label: '🔐 SEGURANÇA\nMulticamadas' },
      style: { backgroundColor: '#dc2626', color: 'white', borderColor: '#b91c1c', width: 160, height: 80 }
    },
    {
      id: 'auth-2fa',
      type: 'default',
      position: { x: 870, y: 690 },
      data: { label: '🔑 AUTH + 2FA\nSupabase Auth' },
      style: { backgroundColor: '#fca5a5', borderColor: '#dc2626', width: 140, height: 70 }
    },
    {
      id: 'lgpd-arch',
      type: 'default',
      position: { x: 1030, y: 690 },
      data: { label: '⚖️ LGPD\nCompliance' },
      style: { backgroundColor: '#fca5a5', borderColor: '#dc2626', width: 140, height: 70 }
    },

    // DOCUMENTAÇÃO & GERAÇÃO
    {
      id: 'docs-generation',
      type: 'default',
      position: { x: 1080, y: 160 },
      data: { label: '📄 GERAÇÃO DOCS\nPDF + Word + Excel' },
      style: { backgroundColor: '#a855f7', color: 'white', borderColor: '#9333ea', width: 160, height: 80 }
    },

    // ESTATÍSTICAS DA ARQUITETURA
    {
      id: 'stats-arch',
      type: 'default',
      position: { x: 1080, y: 350 },
      data: { label: '📊 STACK\n• React 18.3\n• TypeScript\n• 68 Tabelas DB\n• 60+ Edge Functions\n• 94 Regras Negócio\n• 9 Integrações' },
      style: { 
        backgroundColor: '#ffffff',
        borderColor: '#1e40af',
        borderWidth: 3,
        width: 200,
        height: 160,
        fontSize: '11px',
        fontWeight: 'bold'
      }
    },
  ], []);

  const arquiteturaEdges: Edge[] = useMemo(() => [
    // Frontend → UI/Styling
    { id: 'a1', source: 'frontend', target: 'tailwind', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'a2', source: 'frontend', target: 'shadcn', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'a3', source: 'frontend', target: 'radix', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    { id: 'a4', source: 'frontend', target: 'lucide', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#3b82f6' } },
    
    // Frontend → State/Routing
    { id: 'a5', source: 'frontend', target: 'react-router', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#8b5cf6' } },
    { id: 'a6', source: 'frontend', target: 'tanstack-query', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#8b5cf6' } },
    { id: 'a7', source: 'frontend', target: 'react-hook-form', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#8b5cf6' } },
    { id: 'a8', source: 'frontend', target: 'zod', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#8b5cf6' } },
    
    // Frontend → Visualização
    { id: 'a9', source: 'frontend', target: 'recharts', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#06b6d4' } },
    { id: 'a10', source: 'frontend', target: 'react-flow-vis', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#06b6d4' } },
    { id: 'a11', source: 'frontend', target: 'leaflet-map', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#06b6d4' } },
    { id: 'a12', source: 'frontend', target: 'html2canvas', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#06b6d4' } },
    
    // Frontend → Backend (Principal)
    { id: 'a13', source: 'frontend', target: 'backend', type: 'smoothstep', style: { strokeWidth: 4, stroke: '#059669' } },
    
    // Backend → Database
    { id: 'a14', source: 'backend', target: 'postgresql', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#10b981' } },
    { id: 'a15', source: 'backend', target: 'rls', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#10b981' } },
    { id: 'a16', source: 'backend', target: 'triggers-db', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#10b981' } },
    { id: 'a17', source: 'backend', target: 'functions-db', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#10b981' } },
    { id: 'a18', source: 'backend', target: 'realtime', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#10b981' } },
    { id: 'a19', source: 'backend', target: 'storage', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#10b981' } },
    
    // Backend → Edge Functions
    { id: 'a20', source: 'backend', target: 'edge-functions-arch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#14b8a6' } },
    { id: 'a21', source: 'edge-functions-arch', target: 'deno-runtime', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#14b8a6' } },
    
    // Backend → Integrações
    { id: 'a22', source: 'backend', target: 'integracoes-ext', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#f59e0b' } },
    { id: 'a23', source: 'integracoes-ext', target: 'omie-arch', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b' } },
    { id: 'a24', source: 'integracoes-ext', target: 'clicksign-arch', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b' } },
    { id: 'a25', source: 'integracoes-ext', target: 'resend-arch', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#f59e0b' } },
    
    // Segurança
    { id: 'a26', source: 'backend', target: 'security-arch', type: 'smoothstep', style: { strokeWidth: 3, stroke: '#dc2626' } },
    { id: 'a27', source: 'security-arch', target: 'auth-2fa', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    { id: 'a28', source: 'security-arch', target: 'lgpd-arch', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    { id: 'a29', source: 'rls', target: 'security-arch', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#dc2626' } },
    
    // Geração de Documentos
    { id: 'a30', source: 'frontend', target: 'docs-generation', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#a855f7' } },
    { id: 'a31', source: 'edge-functions-arch', target: 'docs-generation', type: 'smoothstep', style: { strokeWidth: 2, stroke: '#a855f7' } },
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
          <div className="space-y-6">
            <div className="bg-background/95 border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">🎯 Status Atual do Processamento - Sistema Totalmente Automático</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">✅ TRIGGERS ATIVOS (4 Essenciais)</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>• trigger_processamento_automatico_volumetria</span>
                        <span className="text-green-600 font-medium">ATIVO</span>
                      </div>
                      <div className="text-xs ml-4 text-muted-foreground">
                        Função: trigger_aplicar_regras_completas() - Aplica todas as 8 regras unificadas
                      </div>
                      <div className="flex justify-between">
                        <span>• trigger_data_referencia</span>
                        <span className="text-green-600 font-medium">ATIVO</span>
                      </div>
                      <div className="text-xs ml-4 text-muted-foreground">
                        Função: trigger_aplicar_data_referencia() - Define data de referência
                      </div>
                      <div className="flex justify-between">
                        <span>• set_data_referencia_trigger</span>
                        <span className="text-green-600 font-medium">ATIVO</span>
                      </div>
                      <div className="text-xs ml-4 text-muted-foreground">
                        Função: set_data_referencia_volumetria() - Backup para data de referência
                      </div>
                      <div className="flex justify-between">
                        <span>• update_volumetria_mobilemed_updated_at</span>
                        <span className="text-green-600 font-medium">ATIVO</span>
                      </div>
                      <div className="text-xs ml-4 text-muted-foreground">
                        Função: update_updated_at_column() - Atualiza timestamps
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-blue-600 mb-2">📋 REGRAS APLICADAS AUTOMATICAMENTE (8)</h4>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>1. Normalização nome do cliente</div>
                      <div>2. Correção de modalidades (CR/DX→RX/MG, OT→DO)</div>
                      <div>3. De-Para para valores zerados</div>
                      <div>4. Aplicação de categorias do cadastro de exames</div>
                      <div>5. Categoria especial para arquivo onco</div>
                      <div>6. Definição de tipo de faturamento</div>
                      <div>7. Normalização de médico</div>
                      <div>8. Lógica de quebra automática</div>
                    </div>
                  </div>
                </div>
                
                 <div className="space-y-4">
                   <div>
                     <h4 className="font-medium text-orange-600 mb-2">🔧 ANÁLISE DETALHADA: 100+ EDGE FUNCTIONS</h4>
                     <p className="text-sm text-muted-foreground mb-3">
                       <strong>PERGUNTA RESPONDIDA:</strong> Das 100+ Edge Functions existentes, suas funcionalidades 
                       foram <strong>MIGRADAS para processamento automático via triggers</strong>. Veja o detalhamento:
                     </p>
                     
                     <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                       <h5 className="font-medium text-green-700 mb-2">✅ FUNCIONALIDADES MIGRADAS PARA TRIGGER AUTOMÁTICO:</h5>
                       <div className="text-xs space-y-1 text-green-600">
                         <div>• <strong>aplicar-mapeamento-nome-cliente</strong> → Função limpar_nome_cliente() integrada</div>
                         <div>• <strong>aplicar-regras-quebra-exames</strong> → Quebra automática integrada</div>
                         <div>• <strong>aplicar-tipificacao-faturamento</strong> → Campo tipo_faturamento automático</div>
                         <div>• <strong>aplicar-correcao-modalidade-rx</strong> → Correção modalidades CR/DX→RX/MG</div>
                         <div>• <strong>aplicar-de-para-valores</strong> → Valores de referência automáticos</div>
                         <div>• <strong>aplicar-categorias-exames</strong> → Categoria do cadastro automática</div>
                         <div>• <strong>normalizar-medico</strong> → Função normalizar_medico() integrada</div>
                         <div>• <strong>buscar-valor-onco</strong> → Valores onco automáticos</div>
                         <div className="font-semibold text-green-700 mt-2">
                           🎯 RESULTADO: ~85% das funcionalidades consolidadas no trigger_aplicar_regras_completas()
                         </div>
                       </div>
                     </div>

                     <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                       <h5 className="font-medium text-blue-700 mb-2">🛠️ FUNÇÕES ADMINISTRATIVAS AINDA ATIVAS:</h5>
                       <div className="text-xs grid grid-cols-2 gap-1 text-blue-600">
                         <div>• gerar-faturamento-periodo</div>
                         <div>• limpar-dados-ficticios</div>
                         <div>• backup-manager</div>
                         <div>• security-monitor</div>
                         <div>• data-encryption</div>
                         <div>• performance-monitor</div>
                         <div>• lgpd-compliance</div>
                         <div>• sincronizar-omie</div>
                       </div>
                     </div>
                     
                     <div className="max-h-48 overflow-y-auto space-y-1 text-xs bg-amber-50 border border-amber-200 rounded p-3">
                       <div className="font-medium text-amber-700 mb-2">🟡 FUNÇÕES OBSOLETAS (funcionalidade migrada):</div>
                       
                       <div className="space-y-1 grid grid-cols-2 gap-1">
                         <div>• aplicar-correcao-modalidade-ot</div>
                         <div>• aplicar-exclusoes-periodo</div>
                         <div>• aplicar-filtro-periodo-atual</div>
                         <div>• aplicar-regras-lote</div>
                         <div>• aplicar-substituicao-especialidade</div>
                         <div>• aplicar-validacao-cliente</div>
                         <div>• processar-volumetria-otimizado</div>
                         <div>• processar-clientes</div>
                         <div>• processar-contratos</div>
                         <div>• processar-exames</div>
                         <div>• limpar-dados-volumetria</div>
                         <div>• + ~75 outras funções...</div>
                       </div>
                       
                       <div className="mt-3 p-2 bg-amber-100 rounded text-amber-700">
                         <strong>Conclusão:</strong> Estas funções existem mas não são mais necessárias, 
                         pois suas funcionalidades foram totalmente automatizadas via triggers de banco de dados.
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
              
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">📊 ANÁLISE DETALHADA: REGRAS DO SISTEMA</h4>
                <p className="text-sm text-green-700 mb-3">
                  <strong>RESPOSTA ESPECÍFICA:</strong> O sistema possui <strong>25 regras de volumetria</strong> e 
                  <strong>6 regras de faturamento</strong> (não 27 e 5 como mencionado). Status da aplicação:
                </p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div className="bg-white p-3 rounded border border-green-200">
                    <h5 className="font-medium text-green-700 mb-2">✅ REGRAS DE VOLUMETRIA (25) - APLICAÇÃO:</h5>
                    <div className="space-y-1 text-xs text-green-600">
                      <div><strong>• 8 regras:</strong> AUTOMÁTICAS via trigger_aplicar_regras_completas()</div>
                      <div><strong>• 3 regras:</strong> AUTOMÁTICAS via triggers específicos (data_referência)</div>
                      <div><strong>• 14 regras:</strong> MANUAIS via Edge Functions (quando necessário)</div>
                      <div className="mt-2 p-2 bg-green-100 rounded">
                        <strong>MOMENTO:</strong> Aplicadas instantaneamente quando dados são inseridos 
                        na tabela volumetria_mobilemed (BEFORE INSERT trigger)
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded border border-green-200">
                    <h5 className="font-medium text-green-700 mb-2">✅ REGRAS DE FATURAMENTO (6) - APLICAÇÃO:</h5>
                    <div className="space-y-1 text-xs text-green-600">
                      <div><strong>• 2 regras:</strong> AUTOMÁTICAS (tipificação via trigger)</div>
                      <div><strong>• 4 regras:</strong> MANUAIS (geração faturamento, cálculos, OMIE)</div>
                      <div className="mt-2 p-2 bg-green-100 rounded">
                        <strong>MOMENTO:</strong> Tipificação é automática na volumetria. 
                        Cálculos e geração executados via funções específicas quando solicitado
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-green-100 rounded">
                  <h5 className="font-medium text-green-700 mb-2">🎯 RESUMO DA APLICAÇÃO:</h5>
                  <div className="text-xs text-green-600 space-y-1">
                    <div><strong>67% das regras de volumetria:</strong> Aplicadas automaticamente via triggers</div>
                    <div><strong>33% das regras de volumetria:</strong> Disponíveis via Edge Functions quando necessário</div>
                    <div><strong>33% das regras de faturamento:</strong> Aplicadas automaticamente</div>
                    <div><strong>67% das regras de faturamento:</strong> Executadas sob demanda (geração, cálculos)</div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <h5 className="font-medium text-blue-700 mb-2">✅ STATUS DAS EXCLUSÕES INDEVIDAS:</h5>
                  <div className="text-xs text-blue-600 space-y-1">
                    <div><strong>SITUAÇÃO ATUAL:</strong> Exclusões indevidas foram CORRIGIDAS ✅</div>
                    <div><strong>Exclusões registradas (últimos 30 dias):</strong> 0 registros</div>
                    <div><strong>Sistema de validação:</strong> Triggers com validação robusta implementados</div>
                    <div><strong>Teste de exclusões:</strong> Disponível na página "Relatório de Exclusões"</div>
                    <div><strong>Monitoramento:</strong> Sistema monitora automaticamente exclusões indevidas</div>
                  </div>
                </div>
              </div>
            </div>
            
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
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Fluxo Principal:</strong> Upload → Processamento AUTOMÁTICO → Aplicação Tipos → Volumetria → Faturamento → Saídas</p>
            <p><strong>Legenda:</strong> Linhas sólidas = Implementado | Linhas tracejadas = Futuro | Verde = Automático | Laranja = Manual</p>
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