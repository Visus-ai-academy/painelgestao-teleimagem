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
}

export function VolumetriaAdvancedFilters({ filters, onFiltersChange }: VolumetriaAdvancedFiltersProps) {
  const [filterData, setFilterData] = useState<FilterData>({
    clientes: [],
    modalidades: [],
    especialidades: [],
    categorias: [],
    prioridades: [],
    medicos: [],
    equipes: []
  });

  useEffect(() => {
    loadFilterData();
  }, []);

  const loadFilterData = async () => {
    try {
      // Carregar dados únicos para filtros
      const [clientesRes, modalidadesRes, especialidadesRes, prioridadesRes, medicosRes] = await Promise.all([
        supabase.from('volumetria_mobilemed').select('EMPRESA').not('EMPRESA', 'is', null),
        supabase.from('volumetria_mobilemed').select('MODALIDADE').not('MODALIDADE', 'is', null),
        supabase.from('volumetria_mobilemed').select('ESPECIALIDADE').not('ESPECIALIDADE', 'is', null),
        supabase.from('volumetria_mobilemed').select('PRIORIDADE').not('PRIORIDADE', 'is', null),
        supabase.from('volumetria_mobilemed').select('MEDICO').not('MEDICO', 'is', null)
      ]);

      setFilterData({
        clientes: [...new Set(clientesRes.data?.map(item => item.EMPRESA) || [])].sort(),
        modalidades: [...new Set(modalidadesRes.data?.map(item => item.MODALIDADE) || [])].sort(),
        especialidades: [...new Set(especialidadesRes.data?.map(item => item.ESPECIALIDADE) || [])].sort(),
        categorias: ['Rotina', 'Urgência', 'Emergência'], // Categorias baseadas na estrutura comum
        prioridades: [...new Set(prioridadesRes.data?.map(item => item.PRIORIDADE) || [])].sort(),
        medicos: [...new Set(medicosRes.data?.map(item => item.MEDICO) || [])].sort(),
        equipes: ['Equipe A', 'Equipe B', 'Equipe C'] // Placeholder - ajustar conforme necessário
      });
    } catch (error) {
      console.error('Erro ao carregar dados dos filtros:', error);
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
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Filtros Temporais */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ano</label>
            <Select value={filters.ano} onValueChange={(value) => updateFilter('ano', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Anos</SelectItem>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Trimestre</label>
            <Select value={filters.trimestre} onValueChange={(value) => updateFilter('trimestre', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Mês</label>
            <Select value={filters.mes} onValueChange={(value) => updateFilter('mes', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Semana</label>
            <Select value={filters.semana} onValueChange={(value) => updateFilter('semana', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Dia</label>
            <Select value={filters.dia} onValueChange={(value) => updateFilter('dia', value)}>
              <SelectTrigger>
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente</label>
            <Select value={filters.cliente} onValueChange={(value) => updateFilter('cliente', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Modalidade</label>
            <Select value={filters.modalidade} onValueChange={(value) => updateFilter('modalidade', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Especialidade</label>
            <Select value={filters.especialidade} onValueChange={(value) => updateFilter('especialidade', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select value={filters.categoria} onValueChange={(value) => updateFilter('categoria', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Prioridade</label>
            <Select value={filters.prioridade} onValueChange={(value) => updateFilter('prioridade', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Médico</label>
            <Select value={filters.medico} onValueChange={(value) => updateFilter('medico', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Equipe</label>
            <Select value={filters.equipe} onValueChange={(value) => updateFilter('equipe', value)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo Cliente</label>
            <Select value={filters.tipoCliente} onValueChange={(value) => updateFilter('tipoCliente', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="CO">CO (Cliente Operacional)</SelectItem>
                <SelectItem value="NC">NC (Novo Cliente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contador de filtros ativos */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Filtros ativos: {Object.values(filters).filter(value => value !== 'todos').length}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}