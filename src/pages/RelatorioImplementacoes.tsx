import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Users, Database, DollarSign, FileText, Settings, Lock, Eye, UserCheck, CheckCircle, Download } from "lucide-react";
import jsPDF from 'jspdf';
import { differenceInBusinessDays } from 'date-fns';


const RelatorioImplementacoes = () => {
  // Calcular dias úteis entre 15/07/2025 e 29/07/2025
  const dataInicio = new Date(2025, 6, 15); // 15/07/2025 (mês 6 = julho, 0-indexado)
  const dataFim = new Date(2025, 6, 29);    // 29/07/2025
  const diasUteis = differenceInBusinessDays(dataFim, dataInicio) + 1; // +1 para incluir o dia inicial
  
  // Todas as regras implementadas no sistema
  const regrasImplementadas = [
    // VOLUMETRIA
    { id: 'v001', nome: 'Proteção Temporal de Dados', modulo: 'volumetria', categoria: 'temporal', criterio: 'Impede edição de dados com mais de 5 dias do mês anterior. Bloqueia inserção de dados futuros.' },
    { id: 'v002', nome: 'Validação de Atraso de Laudos', modulo: 'volumetria', categoria: 'validação', criterio: 'Identifica exames com atraso quando DATA_LAUDO > DATA_PRAZO. Calcula percentual de atraso.' },
    { id: 'v003', nome: 'Filtro por Período', modulo: 'volumetria', categoria: 'dados', criterio: 'Permite filtrar dados por períodos pré-definidos (Hoje, Ontem, Última Semana, etc.) ou período customizado.' },
    { id: 'v004', nome: 'Segmentação por Cliente', modulo: 'volumetria', categoria: 'dados', criterio: 'Filtra dados por cliente específico ou exibe todos. Lista clientes únicos disponíveis.' },
    { id: 'v005', nome: 'Agregação por Modalidade', modulo: 'volumetria', categoria: 'dados', criterio: 'Agrupa exames por modalidade, calcula totais e percentuais para análise comparativa.' },
    { id: 'v006', nome: 'Agregação por Especialidade', modulo: 'volumetria', categoria: 'dados', criterio: 'Agrupa exames por especialidade médica, calcula estatísticas de volume.' },
    { id: 'v007', nome: 'Comparação entre Arquivos', modulo: 'volumetria', categoria: 'validação', criterio: 'Identifica clientes presentes em um arquivo mas ausentes em outro para validação de consistência.' },
    { id: 'v008', nome: 'Cache de Performance', modulo: 'volumetria', categoria: 'dados', criterio: 'Utiliza cache para otimizar consultas grandes, refresh automático a cada 5 minutos.' },
    { id: 'v009', nome: 'Tratamento de Arquivo 1 - Data de Exame', modulo: 'volumetria', categoria: 'dados', criterio: 'Processa dados do primeiro arquivo de upload, extrai DATA_REALIZACAO e converte para formato padrão.' },
    { id: 'v010', nome: 'Tratamento de Arquivo 2 - Data de Laudo', modulo: 'volumetria', categoria: 'dados', criterio: 'Processa dados do segundo arquivo de upload, extrai DATA_LAUDO e DATA_PRAZO para análise de prazo.' },
    { id: 'v011', nome: 'Tratamento de Arquivo 3 - Valores e Prioridades', modulo: 'volumetria', categoria: 'dados', criterio: 'Processa dados do terceiro arquivo, extrai VALORES e PRIORIDADE para cálculos financeiros.' },
    { id: 'v012', nome: 'Tratamento de Arquivo 4 - Dados Complementares', modulo: 'volumetria', categoria: 'dados', criterio: 'Processa dados do quarto arquivo, extrai informações complementares como MEDICO, ESPECIALIDADE e STATUS.' },
    { id: 'v013', nome: 'Validação de Formato Excel', modulo: 'volumetria', categoria: 'validação', criterio: 'Valida estrutura dos arquivos Excel antes do processamento, verifica colunas obrigatórias.' },
    { id: 'v014', nome: 'Mapeamento Dinâmico de Campos', modulo: 'volumetria', categoria: 'dados', criterio: 'Utiliza tabela field_mappings para mapear colunas do arquivo para campos do banco de dados.' },
    { id: 'v015', nome: 'Limpeza de Dados Duplicados', modulo: 'volumetria', categoria: 'dados', criterio: 'Remove dados duplicados baseado em ACCESSION_NUMBER antes da inserção no banco.' },
    { id: 'v016', nome: 'Processamento em Lotes', modulo: 'volumetria', categoria: 'dados', criterio: 'Processa uploads em lotes de 1000 registros para otimizar performance e evitar timeouts.' },
    { id: 'v017', nome: 'Log de Upload e Auditoria', modulo: 'volumetria', categoria: 'dados', criterio: 'Registra todos os uploads na tabela upload_logs com status, erros e estatísticas de processamento.' },
    { id: 'v018', nome: 'Transformação de Valores Numéricos', modulo: 'volumetria', categoria: 'dados', criterio: 'Converte colunas de valores para formato numérico, remove caracteres não numéricos e ajusta casas decimais.' },
    { id: 'v019', nome: 'Remoção de Decimais Desnecessários', modulo: 'volumetria', categoria: 'dados', criterio: 'Remove ".00" de valores monetários quando não há centavos, mantendo apenas valores inteiros limpos.' },
    { id: 'v020', nome: 'Formatação Padrão CNPJ Brasil', modulo: 'volumetria', categoria: 'dados', criterio: 'Aplica máscara padrão brasileira XX.XXX.XXX/XXXX-XX em colunas de CNPJ, validando formato e dígitos.' },
    { id: 'v021', nome: 'Padronização de Formato de Data', modulo: 'volumetria', categoria: 'dados', criterio: 'Converte todas as datas para formato padrão DD/MM/YYYY, detectando automaticamente formatos de entrada.' },
    { id: 'v022', nome: 'Validação e Limpeza de Caracteres Especiais', modulo: 'volumetria', categoria: 'dados', criterio: 'Remove caracteres especiais inválidos, espaços extras e normaliza encoding de texto (UTF-8).' },
    { id: 'v023', nome: 'Tratamento de Campos Vazios e Nulos', modulo: 'volumetria', categoria: 'dados', criterio: 'Define valores padrão para campos obrigatórios vazios e converte strings vazias em NULL apropriadamente.' },
    { id: 'v024', nome: 'Normalização de Nomes e Textos', modulo: 'volumetria', categoria: 'dados', criterio: 'Padroniza capitalização de nomes (Title Case), remove acentos desnecessários e corrige encoding.' },
    { id: 'v025', nome: 'Validação de Integridade Referencial', modulo: 'volumetria', categoria: 'validação', criterio: 'Verifica se códigos de cliente, médico e especialidade existem nas tabelas de referência antes da inserção.' },
    { id: 'v026', nome: 'Mapeamento De Para - Valores por Estudo', modulo: 'volumetria', categoria: 'dados', criterio: 'Utiliza arquivo de referência (ESTUDO_DESCRICAO, VALORES) para preencher valores zerados nos arquivos 1, 2, 3 e 4 através de correspondência por descrição do estudo.' },
    
    // FATURAMENTO
    { id: 'f001', nome: 'Geração Automática de Faturas', modulo: 'faturamento', categoria: 'automação', criterio: 'Gera faturas automaticamente baseado nos exames realizados e valores contratuais.' },
    { id: 'f002', nome: 'Integração OMIE', modulo: 'faturamento', categoria: 'integração', criterio: 'Sincroniza dados de faturamento com sistema OMIE para controle fiscal.' },
    
    // CLIENTES
    { id: 'c001', nome: 'Validação de CNPJ', modulo: 'clientes', categoria: 'validação', criterio: 'Valida formato e autenticidade do CNPJ do cliente antes do cadastro.' },
    
    // MÉDICOS
    { id: 'm001', nome: 'Validação de CRM', modulo: 'médicos', categoria: 'validação', criterio: 'Valida formato do CRM e especialidade médica cadastrada.' },
    
    // ESCALAS
    { id: 'e001', nome: 'Proteção Temporal Escalas', modulo: 'escalas', categoria: 'temporal', criterio: 'Aplicação das mesmas regras temporais de volumetria para escalas médicas.' },
    
    // SEGURANÇA
    { id: 's001', nome: 'Controle de Acesso por Perfil', modulo: 'segurança', categoria: 'acesso', criterio: 'Define permissões específicas baseadas no perfil do usuário (admin, manager, médico).' },
    { id: 's002', nome: 'Auditoria de Operações', modulo: 'segurança', categoria: 'acesso', criterio: 'Registra todas as operações críticas com identificação do usuário, timestamp e dados alterados.' }
  ];

  const implementacoes = [
    {
      titulo: "Sistema de Segurança e Auditoria Completo",
      icon: <Shield className="h-6 w-6" />,
      cor: "destructive",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Métricas de Segurança: Monitoramento em tempo real com indicadores críticos",
        "Alertas de Segurança: Sistema automatizado de notificações para eventos críticos", 
        "Logs de Auditoria: Registro completo com rastreabilidade total de ações",
        "Logs de Acesso a Dados: Monitoramento LGPD de acessos sensíveis",
        "Autenticação de Dois Fatores (2FA): Camada adicional de segurança",
        "Políticas de Senha: Configuração avançada e aplicação rigorosa",
        "Criptografia de Dados: Proteção SHA-256 de informações sensíveis",
        "Conformidade LGPD: Adequação completa às normas de proteção",
        "Backup e Recuperação: Sistema automatizado com cronograma inteligente",
        "Monitoramento de Performance: Análise contínua de sistema"
      ],
      edgeFunctions: [
        "security-monitor: Monitoramento contínuo de ameaças",
        "backup-manager: Gerenciamento automatizado de backups",
        "data-encryption: Processamento seguro de criptografia",
        "lgpd-compliance: Verificação automática de conformidade",
        "performance-monitor: Monitoramento de performance do sistema"
      ]
    },
    {
      titulo: "Sistema Hierárquico de Roles e Permissões",
      icon: <Users className="h-6 w-6" />,
      cor: "default",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Hierarquia Completa: Super Admin > Admin > Manager > Medico > User > Guest",
        "Row Level Security (RLS): Políticas avançadas em todas as tabelas",
        "Políticas Granulares: Controle detalhado por função e contexto",
        "Componentes Protegidos: Interface adaptativa baseada em permissões",
        "Controle de Menu: Exibição dinâmica conforme nível de acesso",
        "Auditoria de Permissões: Rastreamento completo de acessos",
        "Proteção Temporal: Controle de dados históricos e futuros"
      ]
    },
    {
      titulo: "Gestão de Dados Mestres Avançada",
      icon: <Database className="h-6 w-6" />,
      cor: "secondary", 
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Gerenciar Usuários: CRUD completo com controle hierárquico",
        "Gerenciar Médicos: Cadastro especializado com categorias",
        "Gerenciar Listas: Controle de configurações mestras",
        "Colaboradores: Gestão completa de equipes internas",
        "Contratos Clientes: Gestão comercial avançada",
        "Especialidades e Modalidades: Configuração médica completa",
        "Categorias de Exames: Organização estruturada",
        "Prioridades: Sistema de classificação inteligente"
      ]
    },
    {
      titulo: "Sistema de Faturamento e ERP Integrado",
      icon: <DollarSign className="h-6 w-6" />,
      cor: "default",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Integração Omie: Sincronização bidirecional automática",
        "Geração Automatizada: Processamento inteligente de faturas",
        "Controle de Períodos: Gestão flexível (8 ao 7 do mês)",
        "Templates Personalizados: Faturamento por cliente",
        "Régua de Cobrança: Automatização completa do processo",
        "Relatórios Financeiros: Dashboards em tempo real",
        "Validação de Dados: Verificação automática de integridade",
        "Sistema de Emails: Cobrança automatizada"
      ],
      edgeFunctions: [
        "sincronizar-omie: Integração bidirecional com ERP",
        "gerar-fatura: Processamento automatizado de faturas",
        "processar-faturamento: Análise e validação completa",
        "processar-faturamento-pdf: Geração de relatórios PDF",
        "gerar-relatorio-faturamento: Relatórios detalhados",
        "ativar-regua-cobranca: Sistema de cobrança automática",
        "processar-emails-cobranca: Envio automatizado"
      ]
    },
    {
      titulo: "Dashboards e Analytics Avançados",
      icon: <Eye className="h-6 w-6" />,
      cor: "outline",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Dashboard Principal: Métricas em tempo real consolidadas",
        "Dashboard Operacional: Controle de produção e qualidade",
        "Dashboard Financeiro: Análises financeiras completas",
        "Dashboard Volumetria: Análise detalhada de volumes",
        "Dashboard Segurança: Monitoramento de ameaças",
        "Componentes Visuais: Speedometer, MetricCard, Charts",
        "Filtros Avançados: Busca inteligente e filtragem dinâmica",
        "Controles de Período: Seleção flexível de competências"
      ]
    },
    {
      titulo: "Sistema de Importação Inteligente",
      icon: <FileText className="h-6 w-6" />,
      cor: "default",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Mapeamento Inteligente: Auto-detecção de campos",
        "Templates Configuráveis: Modelos para todos os sistemas",
        "Validação em Tempo Real: Verificação automática",
        "Histórico Completo: Logs detalhados com metadados",
        "Processamento em Lote: Otimização para grandes volumes",
        "Recuperação de Erros: Sistema robusto de tratamento",
        "Sincronização Automática: Atualização de mapeamentos"
      ],
      edgeFunctions: [
        "processar-importacao-inteligente: IA para detecção de formato",
        "sincronizar-mapeamentos: Sincronização automática",
        "sincronizar-template: Gestão de templates"
      ]
    },
    {
      titulo: "Sistema de Otimização e Performance",
      icon: <Settings className="h-6 w-6" />,
      cor: "secondary",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Paginação Inteligente: Superação do limite de 1000 registros",
        "Carregamento Progressivo: Fetch em lotes otimizado",
        "Cache Inteligente: Múltiplas camadas de cache",
        "Consultas Otimizadas: SQL com índices estratégicos",
        "Lazy Loading: Carregamento sob demanda",
        "Virtual Scrolling: Listas longas otimizadas",
        "Debounce em Filtros: Otimização de busca"
      ]
    },
    {
      titulo: "Sistema Operacional e Volumetria",
      icon: <Eye className="h-6 w-6" />,
      cor: "destructive",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Gestão de Escalas: Sistema completo de programação médica",
        "Controle de Qualidade: Monitoramento e métricas SLA",
        "Volumetria Avançada: Análise detalhada de produção",
        "Processamento de Exames: Automatização completa",
        "Métricas em Tempo Real: KPIs operacionais",
        "Integração MobileMed: Importação automática",
        "Mapeamento Visual: Geolocalização de clientes"
      ],
      edgeFunctions: [
        "processar-escalas: Processamento automatizado de escalas",
        "processar-exames: Análise e validação de exames",
        "processar-volumetria-mobilemed: Dados MobileMed",
        "limpar-dados-volumetria: Limpeza inteligente"
      ]
    },
    {
      titulo: "Contratos e Assinaturas Digitais",
      icon: <FileText className="h-6 w-6" />,
      cor: "outline",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Integração ClickSign: Plataforma completa de assinaturas",
        "Templates Automatizados: Geração dinâmica de contratos",
        "Fluxo de Aprovação: Processo estruturado de assinatura",
        "Gestão de Status: Acompanhamento em tempo real",
        "Notificações Automáticas: Alertas de prazos",
        "Armazenamento Seguro: Repositório central",
        "Webhook Integrado: Atualizações automáticas"
      ],
      edgeFunctions: [
        "enviar-contrato-clicksign: Envio automatizado",
        "enviar-contrato-medico: Contratos médicos específicos",
        "webhook-clicksign: Recebimento de atualizações"
      ]
    },
    {
      titulo: "Arquitetura e Documentação Visual",
      icon: <Settings className="h-6 w-6" />,
      cor: "default",
      data: "15 Jul 2025 - 29 Jul 2025",
      itens: [
        "Mapa Mental: Visão geral dos módulos interativos",
        "ERD Interativo: Relacionamentos detalhados do banco",
        "Arquitetura Técnica: Camadas frontend/backend/integrações", 
        "Fluxos de Processo: Visualização de processos principais",
        "Documentação Automática: Relatórios auto-gerados",
        "Diagramas Atualizados: Sempre sincronizados"
      ]
    }
  ];

  const estatisticas = {
    totalImplementacoes: implementacoes.length,
    totalFuncionalidades: implementacoes.reduce((acc, impl) => acc + impl.itens.length, 0),
    totalEdgeFunctions: implementacoes.reduce((acc, impl) => acc + (impl.edgeFunctions?.length || 0), 0),
    periodo: "15 de Julho de 2025 até 29 de Julho de 2025"
  };

  const gerarPDF = () => {
    const doc = new jsPDF();
    let yPosition = 20;
    
    // Título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE IMPLEMENTAÇÕES', 105, yPosition, { align: 'center' });
    yPosition += 10;
    
    // Período
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${estatisticas.periodo}`, 105, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Estatísticas
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTATÍSTICAS GERAIS', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`• Total de Sistemas: ${estatisticas.totalImplementacoes}`, 20, yPosition);
    yPosition += 6;
    doc.text(`• Funcionalidades: ${estatisticas.totalFuncionalidades}`, 20, yPosition);
    yPosition += 6;
    doc.text(`• Edge Functions: ${estatisticas.totalEdgeFunctions}`, 20, yPosition);
    yPosition += 6;
    doc.text(`• Dias Úteis de Desenvolvimento: ${diasUteis} dias úteis`, 20, yPosition);
    yPosition += 15;
    
    // Implementações
    implementacoes.forEach((impl, index) => {
      // Verificar se precisa de nova página
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Título da implementação
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${impl.titulo}`, 20, yPosition);
      yPosition += 8;
      
      // Data
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`Implementado em: ${impl.data}`, 20, yPosition);
      yPosition += 10;
      
      // Funcionalidades
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Funcionalidades:', 20, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'normal');
      impl.itens.forEach((item) => {
        // Verificar se precisa quebrar linha
        const splitText = doc.splitTextToSize(`• ${item}`, 170);
        doc.text(splitText, 25, yPosition);
        yPosition += splitText.length * 4;
        
        // Verificar se precisa de nova página
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
      });
      
      // Edge Functions (se existir)
      if (impl.edgeFunctions && impl.edgeFunctions.length > 0) {
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Edge Functions:', 20, yPosition);
        yPosition += 6;
        
        doc.setFont('helvetica', 'normal');
        impl.edgeFunctions.forEach((func) => {
          doc.text(`• ${func}`, 25, yPosition);
          yPosition += 4;
          
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
        });
      }
      
      yPosition += 10;
    });
    
    // Adicionar seção de regras
    yPosition += 10;
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REGRAS DE NEGÓCIO IMPLEMENTADAS', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Regras: ${regrasImplementadas.length}`, 20, yPosition);
    yPosition += 10;
    
    // Agrupar regras por módulo
    const regrasPorModulo = regrasImplementadas.reduce((acc, regra) => {
      if (!acc[regra.modulo]) acc[regra.modulo] = [];
      acc[regra.modulo].push(regra);
      return acc;
    }, {} as Record<string, typeof regrasImplementadas>);
    
    Object.entries(regrasPorModulo).forEach(([modulo, regras]) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${modulo.toUpperCase()} (${regras.length} regras)`, 20, yPosition);
      yPosition += 8;
      
      regras.forEach((regra) => {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${regra.id} - ${regra.nome}`, 25, yPosition);
        yPosition += 5;
        
        doc.setFont('helvetica', 'normal');
        const splitCriterio = doc.splitTextToSize(`Critério: ${regra.criterio}`, 165);
        doc.text(splitCriterio, 25, yPosition);
        yPosition += splitCriterio.length * 4 + 3;
      });
      
      yPosition += 5;
    });

    // Salvar PDF
    doc.save('relatorio-implementacoes.pdf');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Relatório de Implementações
        </h1>
        <p className="text-xl text-muted-foreground">
          Período: {estatisticas.periodo}
        </p>
        <Button 
          onClick={gerarPDF}
          className="mt-4"
          size="lg"
        >
          <Download className="h-4 w-4 mr-2" />
          Gerar PDF
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Sistemas</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.totalImplementacoes}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionalidades</CardTitle>
            <Settings className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.totalFuncionalidades}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Edge Functions</CardTitle>
            <Lock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas.totalEdgeFunctions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dias Úteis de Desenvolvimento</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diasUteis}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Implementações */}
      <div className="space-y-6">
        {implementacoes.map((implementacao, index) => (
          <Card key={index} className="w-full">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  {implementacao.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{implementacao.titulo}</CardTitle>
                  <CardDescription>Implementado em {implementacao.data}</CardDescription>
                </div>
                <Badge variant={implementacao.cor as any}>
                  {implementacao.itens.length} funcionalidades
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3 text-lg">Funcionalidades Implementadas:</h4>
                <div className="space-y-2">
                  {implementacao.itens.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {implementacao.edgeFunctions && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 text-lg">Edge Functions Desenvolvidas:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {implementacao.edgeFunctions.map((func, funcIndex) => (
                        <div key={funcIndex} className="flex items-center space-x-2 p-2 rounded-lg bg-muted/50">
                          <Lock className="h-3 w-3 text-primary" />
                          <span className="text-sm font-mono">{func}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6 text-center">
          <h3 className="text-xl font-bold mb-2">Resumo do Período</h3>
          <p className="text-muted-foreground">
            Durante o período de {estatisticas.periodo}, foram implementados {estatisticas.totalImplementacoes} sistemas principais, 
            totalizando {estatisticas.totalFuncionalidades} funcionalidades específicas e {estatisticas.totalEdgeFunctions} edge functions 
            para processamento automatizado e integração com sistemas externos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RelatorioImplementacoes;