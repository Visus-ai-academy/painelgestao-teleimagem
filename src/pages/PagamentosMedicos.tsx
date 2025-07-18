import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Download, Eye, Calculator, Filter, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Medico {
  id: string;
  nome: string;
  crm: string;
  especialidade: string;
  categoria: string;
  email: string;
}

interface ExameDetalhe {
  id: string;
  data_exame: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cliente_nome: string;
  paciente_nome: string;
}

interface ResumoMedico {
  medico: Medico;
  total_exames: number;
  valor_bruto: number;
  descontos: number;
  valor_liquido: number;
  exames: ExameDetalhe[];
}

export default function PagamentosMedicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [resumos, setResumos] = useState<ResumoMedico[]>([]);
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date();
    return format(hoje, 'yyyy-MM');
  });
  const [loading, setLoading] = useState(false);
  const [filtroMedico, setFiltroMedico] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("");
  const [medicoDetalhado, setMedicoDetalhado] = useState<ResumoMedico | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    carregarMedicos();
  }, []);

  useEffect(() => {
    if (periodo) {
      calcularPagamentos();
    }
  }, [periodo]);

  const carregarMedicos = async () => {
    try {
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setMedicos(data || []);
    } catch (error) {
      console.error('Erro ao carregar médicos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de médicos",
        variant: "destructive",
      });
    }
  };

  const calcularPagamentos = async () => {
    if (!periodo) return;

    setLoading(true);
    try {
      const [ano, mes] = periodo.split('-');
      const dataInicio = `${ano}-${mes}-01`;
      const dataFim = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];

      // Buscar exames do período com dados de médicos e clientes
      const { data: exames, error } = await supabase
        .from('exames')
        .select(`
          *,
          medicos!inner(id, nome, crm, especialidade, categoria, email),
          clientes!inner(nome)
        `)
        .gte('data_exame', dataInicio)
        .lte('data_exame', dataFim);

      if (error) throw error;

      // Agrupar por médico e calcular totais
      const resumosPorMedico = new Map<string, ResumoMedico>();

      exames?.forEach((exame) => {
        const medico = exame.medicos;
        const cliente = exame.clientes;
        
        if (!resumosPorMedico.has(medico.id)) {
          resumosPorMedico.set(medico.id, {
            medico,
            total_exames: 0,
            valor_bruto: 0,
            descontos: 0,
            valor_liquido: 0,
            exames: []
          });
        }

        const resumo = resumosPorMedico.get(medico.id)!;
        resumo.total_exames += exame.quantidade;
        resumo.valor_bruto += Number(exame.valor_total);
        
        // Calcular desconto baseado na categoria do médico
        let percentualDesconto = 0;
        switch (medico.categoria) {
          case 'Junior':
            percentualDesconto = 0.15; // 15%
            break;
          case 'Pleno':
            percentualDesconto = 0.20; // 20%
            break;
          case 'Senior':
            percentualDesconto = 0.25; // 25%
            break;
          case 'Expert':
            percentualDesconto = 0.30; // 30%
            break;
          default:
            percentualDesconto = 0.15;
        }

        const desconto = Number(exame.valor_total) * percentualDesconto;
        resumo.descontos += desconto;
        resumo.valor_liquido = resumo.valor_bruto - resumo.descontos;

        resumo.exames.push({
          id: exame.id,
          data_exame: exame.data_exame,
          modalidade: exame.modalidade,
          especialidade: exame.especialidade,
          categoria: exame.categoria,
          quantidade: exame.quantidade,
          valor_unitario: Number(exame.valor_unitario),
          valor_total: Number(exame.valor_total),
          cliente_nome: cliente.nome,
          paciente_nome: exame.paciente_nome
        });
      });

      setResumos(Array.from(resumosPorMedico.values()));
    } catch (error) {
      console.error('Erro ao calcular pagamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao calcular pagamentos dos médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const gerarArquivoPagamento = async () => {
    try {
      const dados = resumos.map(resumo => ({
        medico: resumo.medico.nome,
        crm: resumo.medico.crm,
        especialidade: resumo.medico.especialidade,
        categoria: resumo.medico.categoria,
        total_exames: resumo.total_exames,
        valor_bruto: resumo.valor_bruto,
        descontos: resumo.descontos,
        valor_liquido: resumo.valor_liquido,
        periodo: periodo
      }));

      // Criar CSV
      const headers = ['Médico', 'CRM', 'Especialidade', 'Categoria', 'Total Exames', 'Valor Bruto', 'Descontos', 'Valor Líquido', 'Período'];
      const csvContent = [
        headers.join(','),
        ...dados.map(row => [
          row.medico,
          row.crm,
          row.especialidade,
          row.categoria,
          row.total_exames,
          row.valor_bruto.toFixed(2),
          row.descontos.toFixed(2),
          row.valor_liquido.toFixed(2),
          row.periodo
        ].join(','))
      ].join('\n');

      // Download do arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pagamentos_medicos_${periodo}.csv`;
      link.click();

      toast({
        title: "Sucesso",
        description: "Arquivo de pagamento médico gerado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao gerar arquivo:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar arquivo de pagamento",
        variant: "destructive",
      });
    }
  };

  const resumosFiltrados = resumos.filter(resumo => {
    const nomeMatch = resumo.medico.nome.toLowerCase().includes(filtroMedico.toLowerCase());
    const especialidadeMatch = !filtroEspecialidade || resumo.medico.especialidade === filtroEspecialidade;
    return nomeMatch && especialidadeMatch;
  });

  const totalGeral = resumosFiltrados.reduce((acc, resumo) => ({
    exames: acc.exames + resumo.total_exames,
    bruto: acc.bruto + resumo.valor_bruto,
    descontos: acc.descontos + resumo.descontos,
    liquido: acc.liquido + resumo.valor_liquido
  }), { exames: 0, bruto: 0, descontos: 0, liquido: 0 });

  const especialidades = [...new Set(medicos.map(m => m.especialidade))];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pagamento Médico</h1>
          <p className="text-muted-foreground">Gestão de pagamentos e repasses médicos</p>
        </div>
      </div>

      {/* Controles e Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Controles de Período e Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar Médico</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do médico..."
                  value={filtroMedico}
                  onChange={(e) => setFiltroMedico(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Especialidade</label>
              <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas especialidades</SelectItem>
                  {especialidades.map(esp => (
                    <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={gerarArquivoPagamento} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Gerar Arquivo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total de Exames</p>
              <p className="text-2xl font-bold text-primary">{totalGeral.exames}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor Bruto</p>
              <p className="text-2xl font-bold text-blue-600">R$ {totalGeral.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Descontos</p>
              <p className="text-2xl font-bold text-red-600">R$ {totalGeral.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor Líquido</p>
              <p className="text-2xl font-bold text-green-600">R$ {totalGeral.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Médico</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando dados...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Médico</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Exames</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Valor Líquido</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumosFiltrados.map((resumo) => (
                  <TableRow key={resumo.medico.id}>
                    <TableCell className="font-medium">{resumo.medico.nome}</TableCell>
                    <TableCell>{resumo.medico.crm}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{resumo.medico.especialidade}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        resumo.medico.categoria === 'Expert' ? 'default' :
                        resumo.medico.categoria === 'Senior' ? 'secondary' :
                        'outline'
                      }>
                        {resumo.medico.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{resumo.total_exames}</TableCell>
                    <TableCell className="text-right">
                      R$ {resumo.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      R$ {resumo.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      R$ {resumo.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMedicoDetalhado(resumo)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Detalhes - {resumo.medico.nome}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Total de Exames</p>
                                <p className="font-bold">{resumo.total_exames}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Valor Bruto</p>
                                <p className="font-bold">R$ {resumo.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Descontos</p>
                                <p className="font-bold text-red-600">R$ {resumo.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Valor Líquido</p>
                                <p className="font-bold text-green-600">R$ {resumo.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                            
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Data</TableHead>
                                  <TableHead>Paciente</TableHead>
                                  <TableHead>Cliente</TableHead>
                                  <TableHead>Modalidade</TableHead>
                                  <TableHead>Categoria</TableHead>
                                  <TableHead className="text-right">Qtd</TableHead>
                                  <TableHead className="text-right">Valor Unit.</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resumo.exames.map((exame) => (
                                  <TableRow key={exame.id}>
                                    <TableCell>
                                      {format(new Date(exame.data_exame), 'dd/MM/yyyy', { locale: ptBR })}
                                    </TableCell>
                                    <TableCell>{exame.paciente_nome}</TableCell>
                                    <TableCell>{exame.cliente_nome}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{exame.modalidade}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={exame.categoria === 'Urgência' ? 'destructive' : 'secondary'}>
                                        {exame.categoria}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{exame.quantidade}</TableCell>
                                    <TableCell className="text-right">
                                      R$ {exame.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      R$ {exame.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}