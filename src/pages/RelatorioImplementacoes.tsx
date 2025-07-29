import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Users, Database, DollarSign, FileText, Settings, Lock, Eye, UserCheck, CheckCircle, Download } from "lucide-react";
import jsPDF from 'jspdf';


const RelatorioImplementacoes = () => {
  const implementacoes = [
    {
      titulo: "Sistema de Segurança e Auditoria",
      icon: <Shield className="h-6 w-6" />,
      cor: "destructive",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Métricas de Segurança: Monitoramento em tempo real de tentativas de acesso, falhas de autenticação e atividades suspeitas",
        "Alertas de Segurança: Sistema automatizado de notificações para eventos críticos de segurança",
        "Logs de Auditoria: Registro completo de todas as ações realizadas no sistema com rastreabilidade total",
        "Autenticação de Dois Fatores (2FA): Implementação de camada adicional de segurança para acesso ao sistema",
        "Políticas de Senha: Configuração e aplicação de regras rigorosas para senhas dos usuários",
        "Criptografia de Dados: Proteção avançada de informações sensíveis com algoritmos de criptografia",
        "Conformidade LGPD: Adequação completa às normas da Lei Geral de Proteção de Dados",
        "Backup e Recuperação: Sistema automatizado de backup com procedimentos de recuperação de dados"
      ],
      edgeFunctions: [
        "security-monitor: Monitoramento contínuo de atividades suspeitas",
        "backup-manager: Gerenciamento automatizado de backups",
        "data-encryption: Processamento seguro de criptografia de dados",
        "lgpd-compliance: Verificação automática de conformidade LGPD"
      ]
    },
    {
      titulo: "Sistema Hierárquico de Funções e Permissões",
      icon: <Users className="h-6 w-6" />,
      cor: "default",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Hierarquia de Funções: Super Admin > Admin > Manager > User > Guest",
        "Row Level Security (RLS): Políticas de segurança a nível de linha no banco de dados",
        "Políticas Granulares: Controle detalhado de acesso a recursos específicos",
        "Componentes Protegidos: Interface adaptativa baseada em permissões do usuário",
        "Controle de Menu: Exibição dinâmica de opções conforme nível de acesso"
      ]
    },
    {
      titulo: "Gestão de Dados Mestre",
      icon: <Database className="h-6 w-6" />,
      cor: "secondary",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Gerenciar Usuários: CRUD completo com controle de permissões e auditoria",
        "Gerenciar Médicos: Cadastro especializado com informações profissionais",
        "Gerenciar Listas: Controle de listas de dados do sistema",
        "Colaboradores: Gestão completa de equipe interna",
        "Contratos (Clientes e Fornecedores): Gestão integrada de relacionamentos comerciais"
      ]
    },
    {
      titulo: "Sistema Avançado de Faturamento",
      icon: <DollarSign className="h-6 w-6" />,
      cor: "default",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Sincronização Omie: Integração bidirecional automática com sistema ERP",
        "Geração Automatizada: Processamento inteligente de faturas baseado em contratos",
        "Controle de Períodos: Gestão precisa de competências e datas de faturamento",
        "Importação Inteligente: Sistema automatizado de upload e processamento de dados",
        "Relatórios Avançados: Dashboards e análises detalhadas de faturamento",
        "Validação de Dados: Verificação automática de integridade e consistência"
      ],
      edgeFunctions: [
        "sincronizar-omie: Integração automática com ERP Omie",
        "gerar-fatura: Processamento automatizado de faturas",
        "processar-faturamento: Análise e validação de dados de faturamento",
        "processar-faturamento-pdf: Geração de relatórios em PDF",
        "gerar-relatorio-faturamento: Criação de relatórios detalhados"
      ]
    },
    {
      titulo: "Sistema de Contratos e Assinaturas Digitais",
      icon: <FileText className="h-6 w-6" />,
      cor: "outline",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Integração ClickSign: Plataforma completa de assinaturas digitais",
        "Templates Automatizados: Geração dinâmica de contratos baseada em dados",
        "Fluxo de Aprovação: Processo estruturado de revisão e assinatura",
        "Gestão de Status: Acompanhamento em tempo real do progresso dos contratos",
        "Notificações Automáticas: Alertas de prazos e pendências",
        "Armazenamento Seguro: Repositório central de documentos assinados"
      ],
      edgeFunctions: [
        "enviar-contrato-clicksign: Envio automatizado para assinatura",
        "enviar-contrato-medico: Processamento específico para contratos médicos",
        "webhook-clicksign: Recebimento de atualizações de status"
      ]
    },
    {
      titulo: "Sistema Operacional e Produção",
      icon: <Settings className="h-6 w-6" />,
      cor: "default",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Gestão de Escalas: Sistema completo de programação médica",
        "Controle de Qualidade: Monitoramento e métricas de performance",
        "Volumetria: Análise detalhada de volumes de produção",
        "Importação de Exames: Processamento automatizado de dados médicos",
        "Dashboard Operacional: Visão consolidada de indicadores",
        "Métricas em Tempo Real: Acompanhamento instantâneo de KPIs"
      ],
      edgeFunctions: [
        "processar-escalas: Processamento automatizado de escalas médicas",
        "processar-exames: Análise e validação de dados de exames"
      ]
    },
    {
      titulo: "Sistema Financeiro e Cobrança",
      icon: <DollarSign className="h-6 w-6" />,
      cor: "destructive",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Régua de Cobrança: Automatização completa do processo de cobrança",
        "Pagamentos Médicos: Gestão de remuneração e bonificações",
        "Controle Financeiro: Dashboard com indicadores financeiros",
        "Processamento de Emails: Sistema automatizado de comunicação",
        "Análise de Inadimplência: Relatórios e métricas de cobrança",
        "Integração Bancária: Conciliação automática de pagamentos"
      ],
      edgeFunctions: [
        "ativar-regua-cobranca: Ativação automática do processo de cobrança",
        "processar-emails-cobranca: Envio automatizado de cobranças",
        "processar-financeiro: Análise de dados financeiros"
      ]
    },
    {
      titulo: "Sistema de Importação e Processamento",
      icon: <Eye className="h-6 w-6" />,
      cor: "secondary",
      data: "17 Jul 2024 - 29 Jan 2025",
      itens: [
        "Importação Inteligente: Sistema automatizado de análise e validação",
        "Processamento de Clientes: Gestão completa de base de clientes",
        "Validação de Dados: Verificação automática de integridade",
        "Templates Personalizados: Modelos para diferentes tipos de importação",
        "Logs Detalhados: Rastreamento completo de operações",
        "Recuperação de Erros: Sistema robusto de tratamento de falhas"
      ],
      edgeFunctions: [
        "processar-importacao-inteligente: Sistema avançado de importação",
        "processar-clientes: Processamento de dados de clientes",
        "processar-contratos: Análise de contratos importados"
      ]
    }
  ];

  const estatisticas = {
    totalImplementacoes: implementacoes.length,
    totalFuncionalidades: implementacoes.reduce((acc, impl) => acc + impl.itens.length, 0),
    totalEdgeFunctions: implementacoes.reduce((acc, impl) => acc + (impl.edgeFunctions?.length || 0), 0),
    periodo: "17 de Julho de 2024 até 29 de Janeiro de 2025"
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
    doc.text("• Dias de Desenvolvimento: 195+", 20, yPosition);
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
            <CardTitle className="text-sm font-medium">Dias de Desenvolvimento</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">195+</div>
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