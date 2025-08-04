import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Users, Building2, RefreshCw, Filter, BarChart3, Zap } from "lucide-react";

interface ClienteVolumetria {
  id: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  status: string;
  ativo: boolean;
  email?: string;
  volume_exames: number;
  total_registros: number;
  valor_total: number;
  modalidades: string[];
  especialidades: string[];
  prioridades: string[];
}

interface RegiaoEstatistica {
  regiao: string;
  estados: string[];
  total_clientes: number;
  volume_total: number;
  valor_total: number;
  clientes: ClienteVolumetria[];
  cor_intensidade: number; // 0-100 para determinar a cor do heat map
}

interface EstadoEstatistica {
  estado: string;
  regiao: string;
  total_clientes: number;
  volume_total: number;
  valor_total: number;
  cidades: { [cidade: string]: ClienteVolumetria[] };
}

// Mapeamento de regiões do Brasil
const REGIOES_BRASIL = {
  'Norte': ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
  'Sul': ['PR', 'RS', 'SC']
};

const getRegiaoByEstado = (estado: string): string => {
  for (const [regiao, estados] of Object.entries(REGIOES_BRASIL)) {
    if (estados.includes(estado)) return regiao;
  }
  return 'Não identificado';
};

const getCorIntensidade = (volume: number, maxVolume: number): string => {
  if (volume === 0) return 'bg-gray-100';
  const intensidade = (volume / maxVolume) * 100;
  if (intensidade < 20) return 'bg-blue-200';
  if (intensidade < 40) return 'bg-blue-300';
  if (intensidade < 60) return 'bg-blue-400';
  if (intensidade < 80) return 'bg-blue-500';
  return 'bg-blue-600';
};

export default function MapaDistribuicaoClientes() {
  const [carregando, setCarregando] = useState(true);
  const [clientesVolumetria, setClientesVolumetria] = useState<ClienteVolumetria[]>([]);
  const [regioesEstatisticas, setRegioesEstatisticas] = useState<RegiaoEstatistica[]>([]);
  const [estadosEstatisticas, setEstadosEstatisticas] = useState<EstadoEstatistica[]>([]);
  
  // Filtros
  const [filtroModalidade, setFiltroModalidade] = useState<string>('todas');
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string>('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [visualizacao, setVisualizacao] = useState<'regioes' | 'estados' | 'cidades'>('regioes');

  // Carregar dados da volumetria real
  const carregarDadosVolumetria = async () => {
    setCarregando(true);
    try {
      console.log('Carregando dados de volumetria real...');

      // Buscar clientes ativos
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, endereco, cidade, estado, status, ativo, email')
        .eq('ativo', true)
        .eq('status', 'Ativo');

      if (clientesError) throw clientesError;

      // Buscar dados de volumetria agrupados por cliente
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          "EMPRESA",
          "MODALIDADE",
          "ESPECIALIDADE", 
          "PRIORIDADE",
          "VALORES"
        `);

      if (volumetriaError) throw volumetriaError;

      console.log('Dados de volumetria carregados:', volumetriaData?.length);

      // Agrupar volumetria por empresa (cliente)
      const volumetriaPorEmpresa = new Map<string, {
        volume_exames: number;
        total_registros: number;
        valor_total: number;
        modalidades: Set<string>;
        especialidades: Set<string>;
        prioridades: Set<string>;
      }>();

      volumetriaData?.forEach(item => {
        const empresa = item.EMPRESA || 'Não identificado';
        
        if (!volumetriaPorEmpresa.has(empresa)) {
          volumetriaPorEmpresa.set(empresa, {
            volume_exames: 0,
            total_registros: 0,
            valor_total: 0,
            modalidades: new Set(),
            especialidades: new Set(),
            prioridades: new Set()
          });
        }

        const stats = volumetriaPorEmpresa.get(empresa)!;
        stats.total_registros += 1;
        stats.volume_exames += item.VALORES || 0;
        stats.valor_total += item.VALORES || 0;
        
        if (item.MODALIDADE) stats.modalidades.add(item.MODALIDADE);
        if (item.ESPECIALIDADE) stats.especialidades.add(item.ESPECIALIDADE);
        if (item.PRIORIDADE) stats.prioridades.add(item.PRIORIDADE);
      });

      // Combinar dados de clientes com volumetria
      const clientesComVolumetria: ClienteVolumetria[] = clientes?.map(cliente => {
        const volumetria = volumetriaPorEmpresa.get(cliente.nome) || {
          volume_exames: 0,
          total_registros: 0,
          valor_total: 0,
          modalidades: new Set(),
          especialidades: new Set(),
          prioridades: new Set()
        };

        return {
          ...cliente,
          volume_exames: volumetria.volume_exames,
          total_registros: volumetria.total_registros,
          valor_total: volumetria.valor_total,
          modalidades: Array.from(volumetria.modalidades),
          especialidades: Array.from(volumetria.especialidades),
          prioridades: Array.from(volumetria.prioridades)
        };
      }) || [];

      setClientesVolumetria(clientesComVolumetria);
      processarEstatisticas(clientesComVolumetria);

    } catch (error: any) {
      console.error('Erro ao carregar volumetria:', error);
      toast.error('Erro ao carregar dados de volumetria');
    } finally {
      setCarregando(false);
    }
  };

  // Processar estatísticas por região e estado
  const processarEstatisticas = (clientes: ClienteVolumetria[]) => {
    // Filtrar clientes baseado nos filtros selecionados
    let clientesFiltrados = clientes;

    if (filtroModalidade !== 'todas') {
      clientesFiltrados = clientesFiltrados.filter(c => 
        c.modalidades.includes(filtroModalidade)
      );
    }

    if (filtroEspecialidade !== 'todas') {
      clientesFiltrados = clientesFiltrados.filter(c => 
        c.especialidades.includes(filtroEspecialidade)
      );
    }

    if (filtroPrioridade !== 'todas') {
      clientesFiltrados = clientesFiltrados.filter(c => 
        c.prioridades.includes(filtroPrioridade)
      );
    }

    // Agrupar por região
    const regioesMap = new Map<string, RegiaoEstatistica>();
    const estadosMap = new Map<string, EstadoEstatistica>();

    clientesFiltrados.forEach(cliente => {
      const estado = cliente.estado || 'NI';
      const regiao = getRegiaoByEstado(estado);

      // Estatísticas por região
      if (!regioesMap.has(regiao)) {
        regioesMap.set(regiao, {
          regiao,
          estados: REGIOES_BRASIL[regiao as keyof typeof REGIOES_BRASIL] || [],
          total_clientes: 0,
          volume_total: 0,
          valor_total: 0,
          clientes: [],
          cor_intensidade: 0
        });
      }

      const estatRegiao = regioesMap.get(regiao)!;
      estatRegiao.total_clientes++;
      estatRegiao.volume_total += cliente.volume_exames;
      estatRegiao.valor_total += cliente.valor_total;
      estatRegiao.clientes.push(cliente);

      // Estatísticas por estado
      if (!estadosMap.has(estado)) {
        estadosMap.set(estado, {
          estado,
          regiao,
          total_clientes: 0,
          volume_total: 0,
          valor_total: 0,
          cidades: {}
        });
      }

      const estatEstado = estadosMap.get(estado)!;
      estatEstado.total_clientes++;
      estatEstado.volume_total += cliente.volume_exames;
      estatEstado.valor_total += cliente.valor_total;

      const cidade = cliente.cidade || 'Não informado';
      if (!estatEstado.cidades[cidade]) {
        estatEstado.cidades[cidade] = [];
      }
      estatEstado.cidades[cidade].push(cliente);
    });

    // Calcular intensidade de cor baseada no volume máximo
    const maxVolume = Math.max(...Array.from(regioesMap.values()).map(r => r.volume_total));
    regioesMap.forEach(regiao => {
      regiao.cor_intensidade = regiao.volume_total > 0 ? (regiao.volume_total / maxVolume) * 100 : 0;
    });

    setRegioesEstatisticas(Array.from(regioesMap.values()));
    setEstadosEstatisticas(Array.from(estadosMap.values()));
  };

  // Reprocessar quando filtros mudarem
  useEffect(() => {
    if (clientesVolumetria.length > 0) {
      processarEstatisticas(clientesVolumetria);
    }
  }, [filtroModalidade, filtroEspecialidade, filtroPrioridade, clientesVolumetria]);

  useEffect(() => {
    carregarDadosVolumetria();
  }, []);

  // Obter listas únicas para filtros
  const modalidadesUnicas = [...new Set(clientesVolumetria.flatMap(c => c.modalidades))];
  const especialidadesUnicas = [...new Set(clientesVolumetria.flatMap(c => c.especialidades))];
  const prioridadesUnicas = [...new Set(clientesVolumetria.flatMap(c => c.prioridades))];

  const totalGeral = {
    clientes: clientesVolumetria.length,
    volume: clientesVolumetria.reduce((sum, c) => sum + c.volume_exames, 0),
    valor: clientesVolumetria.reduce((sum, c) => sum + c.valor_total, 0)
  };

  if (carregando) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mapa de Distribuição de Clientes</h1>
          <p className="text-gray-600 mt-1">Distribuição geográfica com dados reais de volumetria</p>
        </div>
        <Button onClick={carregarDadosVolumetria} disabled={carregando}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Modalidade</label>
              <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {modalidadesUnicas.map(modalidade => (
                    <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Especialidade</label>
              <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {especialidadesUnicas.map(especialidade => (
                    <SelectItem key={especialidade} value={especialidade}>{especialidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {prioridadesUnicas.map(prioridade => (
                    <SelectItem key={prioridade} value={prioridade}>{prioridade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Visualização</label>
              <Select value={visualizacao} onValueChange={(v) => setVisualizacao(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regioes">Por Região</SelectItem>
                  <SelectItem value="estados">Por Estado</SelectItem>
                  <SelectItem value="cidades">Por Cidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                <p className="text-2xl font-bold">{totalGeral.clientes}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Volume Total</p>
                <p className="text-2xl font-bold">{totalGeral.volume.toLocaleString()}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold">R$ {totalGeral.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <Zap className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa de Calor por Regiões */}
      {visualizacao === 'regioes' && (
        <Card>
          <CardHeader>
            <CardTitle>Mapa de Calor - Distribuição por Região</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {regioesEstatisticas.map(regiao => {
                const maxVolume = Math.max(...regioesEstatisticas.map(r => r.volume_total));
                const corClasse = getCorIntensidade(regiao.volume_total, maxVolume);
                
                return (
                  <div key={regiao.regiao} className={`p-6 rounded-lg ${corClasse} transition-all hover:scale-105`}>
                    <div className="text-center text-white">
                      <h3 className="font-bold text-lg">{regiao.regiao}</h3>
                      <div className="mt-3 space-y-1">
                        <p className="text-sm">{regiao.total_clientes} clientes</p>
                        <p className="text-sm">{regiao.volume_total.toLocaleString()} exames</p>
                        <p className="text-xs">R$ {regiao.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {regiao.estados.length} estados
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela por Estados */}
      {visualizacao === 'estados' && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Estado</th>
                    <th className="text-left py-3 px-4">Região</th>
                    <th className="text-right py-3 px-4">Clientes</th>
                    <th className="text-right py-3 px-4">Volume</th>
                    <th className="text-right py-3 px-4">Valor</th>
                    <th className="text-right py-3 px-4">Cidades</th>
                  </tr>
                </thead>
                <tbody>
                  {estadosEstatisticas
                    .sort((a, b) => b.volume_total - a.volume_total)
                    .map((estado, index) => (
                    <tr key={estado.estado} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <td className="py-3 px-4 font-medium">{estado.estado}</td>
                      <td className="py-3 px-4">{estado.regiao}</td>
                      <td className="py-3 px-4 text-right">{estado.total_clientes}</td>
                      <td className="py-3 px-4 text-right">{estado.volume_total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">R$ {estado.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right">{Object.keys(estado.cidades).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista detalhada por cidade */}
      {visualizacao === 'cidades' && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Cidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {estadosEstatisticas.map(estado => (
                <div key={estado.estado} className="border rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3">{estado.estado} - {estado.regiao}</h3>
                  <div className="grid gap-3">
                    {Object.entries(estado.cidades).map(([cidade, clientesCidade]) => (
                      <div key={cidade} className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{cidade}</span>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>{clientesCidade.length} clientes</span>
                            <span>{clientesCidade.reduce((sum, c) => sum + c.volume_exames, 0).toLocaleString()} exames</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {clientesCidade.map(cliente => (
                            <Badge key={cliente.id} variant="outline" className="text-xs">
                              {cliente.nome}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}