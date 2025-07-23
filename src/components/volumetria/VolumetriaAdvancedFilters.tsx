import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Filter, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VolumetriaAdvancedFiltersProps {
  filters: VolumetriaFilters;
  onFiltersChange: (filters: VolumetriaFilters) => void;
}

export interface VolumetriaFilters {
  ano: string;
  trimestre: string;
  mes: string;
  semana: string;
  dia: string;
  cliente: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  medico: string;
  equipe: string;
  tipoCliente: string;
}

interface FilterData {
  clientes: string[];
  modalidades: string[];
  especialidades: string[];
  categorias: string[];
  prioridades: string[];
  medicos: string[];
  equipes: string[];
  anos: number[];
}

export function VolumetriaAdvancedFilters({ filters, onFiltersChange }: VolumetriaAdvancedFiltersProps) {
  const [filterData, setFilterData] = useState<FilterData>({
    clientes: [],
    modalidades: [],
    especialidades: [],
    categorias: [],
    prioridades: [],
    medicos: [],
    equipes: [],
    anos: []
  });

  useEffect(() => {
    loadFilterData();
  }, []);

  const loadFilterData = async () => {
    try {
      console.log('🔍 Carregando opções de filtros baseadas nos dados reais...');
      
      // Carregar dados únicos para filtros usando paginação
      const loadUniqueValues = async (column: string) => {
        let allValues: string[] = [];
        let offset = 0;
        const limit = 1000;
        
        while (true) {
          const { data, error } = await supabase
            .from('volumetria_mobilemed')
            .select(column)
            .not(column, 'is', null)
            .range(offset, offset + limit - 1);

          if (error) {
            console.error(`❌ Erro ao carregar ${column}:`, error);
            break;
          }

          if (!data || data.length === 0) break;

          const values = data.map(item => item[column]).filter(Boolean);
          allValues = [...allValues, ...values];
          
          if (data.length < limit) break;
          offset += limit;
        }
        
        return [...new Set(allValues)].sort();
      };

      // Carregar todos os valores únicos em paralelo
      const [clientes, modalidades, especialidades, prioridades, medicos] = await Promise.all([
        loadUniqueValues('EMPRESA'),
        loadUniqueValues('MODALIDADE'),
        loadUniqueValues('ESPECIALIDADE'),
        loadUniqueValues('PRIORIDADE'),
        loadUniqueValues('MEDICO')
      ]);

      // Carregar anos únicos baseados em data_referencia
      const { data: datesData } = await supabase
        .from('volumetria_mobilemed')
        .select('data_referencia')
        .not('data_referencia', 'is', null)
        .order('data_referencia', { ascending: false })
        .limit(1000);

      const yearsSet = new Set<number>();
      datesData?.forEach(item => {
        if (item.data_referencia) {
          yearsSet.add(new Date(item.data_referencia).getFullYear());
        }
      });
      const yearsArray = Array.from(yearsSet).sort((a, b) => b - a);

      console.log(`✅ Filtros carregados: ${clientes.length} clientes, ${modalidades.length} modalidades, ${especialidades.length} especialidades`);

      setFilterData({
        clientes,
        modalidades,
        especialidades,
        categorias: ['Rotina', 'Urgência', 'Emergência'], // Categorias baseadas na estrutura comum
        prioridades,
        medicos,
        equipes: ['Equipe A', 'Equipe B', 'Equipe C'], // Placeholder - ajustar conforme necessário
        anos: yearsArray
      });
    } catch (error) {
      console.error('❌ Erro ao carregar dados dos filtros:', error);
    }
  };

  const updateFilter = (key: keyof VolumetriaFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    const resetFilters: VolumetriaFilters = {
      ano: 'todos',
      trimestre: 'todos',
      mes: 'todos',
      semana: 'todos',
      dia: 'todos',
      cliente: 'todos',
      modalidade: 'todos',
      especialidade: 'todos',
      categoria: 'todos',
      prioridade: 'todos',
      medico: 'todos',
      equipe: 'todos',
      tipoCliente: 'todos'
    };
    onFiltersChange(resetFilters);
  };

  const currentYear = new Date().getFullYear();
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Filtros Temporais */}
          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Ano</label>
            <Select value={filters.ano} onValueChange={(value) => updateFilter('ano', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Anos</SelectItem>
                {filterData.anos.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Trimestre</label>
            <Select value={filters.trimestre} onValueChange={(value) => updateFilter('trimestre', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Q1">1º Trimestre</SelectItem>
                <SelectItem value="Q2">2º Trimestre</SelectItem>
                <SelectItem value="Q3">3º Trimestre</SelectItem>
                <SelectItem value="Q4">4º Trimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Mês</label>
            <Select value={filters.mes} onValueChange={(value) => updateFilter('mes', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Meses</SelectItem>
                {months.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Semana</label>
            <Select value={filters.semana} onValueChange={(value) => updateFilter('semana', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="semana_atual">Semana Atual</SelectItem>
                <SelectItem value="semana_anterior">Semana Anterior</SelectItem>
                <SelectItem value="ultimas_2_semanas">Últimas 2 Semanas</SelectItem>
                <SelectItem value="ultimas_4_semanas">Últimas 4 Semanas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Dia</label>
            <Select value={filters.dia} onValueChange={(value) => updateFilter('dia', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="ultimos_7_dias">Últimos 7 Dias</SelectItem>
                <SelectItem value="ultimos_30_dias">Últimos 30 Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtros de Dados */}
          <div className="space-y-1 min-w-[140px]">
            <label className="text-xs font-medium">Cliente ({filterData.clientes.length})</label>
            <Select value={filters.cliente} onValueChange={(value) => updateFilter('cliente', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {filterData.clientes.map(cliente => (
                  <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Modalidade ({filterData.modalidades.length})</label>
            <Select value={filters.modalidade} onValueChange={(value) => updateFilter('modalidade', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {filterData.modalidades.map(modalidade => (
                  <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[130px]">
            <label className="text-xs font-medium">Especialidade ({filterData.especialidades.length})</label>
            <Select value={filters.especialidade} onValueChange={(value) => updateFilter('especialidade', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {filterData.especialidades.map(especialidade => (
                  <SelectItem key={especialidade} value={especialidade}>{especialidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Categoria</label>
            <Select value={filters.categoria} onValueChange={(value) => updateFilter('categoria', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {filterData.categorias.map(categoria => (
                  <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Prioridade ({filterData.prioridades.length})</label>
            <Select value={filters.prioridade} onValueChange={(value) => updateFilter('prioridade', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {filterData.prioridades.map(prioridade => (
                  <SelectItem key={prioridade} value={prioridade}>{prioridade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[130px]">
            <label className="text-xs font-medium">Médico ({filterData.medicos.length})</label>
            <Select value={filters.medico} onValueChange={(value) => updateFilter('medico', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="todos">Todos</SelectItem>
                {filterData.medicos.map(medico => (
                  <SelectItem key={medico} value={medico}>{medico}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Equipe</label>
            <Select value={filters.equipe} onValueChange={(value) => updateFilter('equipe', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {filterData.equipes.map(equipe => (
                  <SelectItem key={equipe} value={equipe}>{equipe}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-xs font-medium">Tipo Cliente</label>
            <Select value={filters.tipoCliente} onValueChange={(value) => updateFilter('tipoCliente', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="CO">CO (Operacional)</SelectItem>
                <SelectItem value="NC">NC (Novo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contador de filtros ativos e mensagem de dados */}
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Filtros ativos: {Object.values(filters).filter(value => value !== 'todos').length}
          </div>
          {Object.values(filters).some(value => value !== 'todos') && (
            <div className="text-sm text-blue-600 font-medium">
              💡 Dados exibidos conforme filtros aplicados
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}