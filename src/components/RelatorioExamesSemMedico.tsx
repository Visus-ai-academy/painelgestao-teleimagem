import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, FileWarning, Loader2, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';

interface ExameSemMedico {
  id: string;
  MEDICO: string;
  ESTUDO_DESCRICAO: string;
  MODALIDADE: string;
  ESPECIALIDADE: string;
  CATEGORIA: string;
  EMPRESA: string;
  periodo_referencia: string;
  total_exames: number;
}

export const RelatorioExamesSemMedico = () => {
  const [loading, setLoading] = useState(false);
  const [exames, setExames] = useState<ExameSemMedico[]>([]);
  const [filteredExames, setFilteredExames] = useState<ExameSemMedico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalExames, setTotalExames] = useState(0);

  const buscarExamesSemMedico = async () => {
    try {
      setLoading(true);
      toast.info('Buscando exames sem médico cadastrado...');

      // 1. Buscar todos os nomes de médicos cadastrados
      const { data: medicosData, error: medicosError } = await supabase
        .from('medicos')
        .select('nome');

      if (medicosError) throw medicosError;

      const medicosNomes = new Set((medicosData || []).map(m => m.nome.toUpperCase().trim()));
      console.log(`Total de médicos cadastrados: ${medicosNomes.size}`);

      // 2. Buscar exames agrupados por médico
      const { data: examesData, error: examesError } = await supabase
        .from('volumetria_mobilemed')
        .select('MEDICO, ESTUDO_DESCRICAO, MODALIDADE, ESPECIALIDADE, CATEGORIA, EMPRESA, periodo_referencia, VALORES')
        .not('MEDICO', 'is', null)
        .order('MEDICO');

      if (examesError) throw examesError;

      // 3. Agrupar e filtrar exames cujo médico não está cadastrado
      const examesPorMedico = new Map<string, ExameSemMedico>();
      let totalExamesCount = 0;

      for (const exame of examesData || []) {
        const medicoNome = exame.MEDICO?.toUpperCase().trim() || '';
        
        // Verificar se o médico NÃO está cadastrado
        if (!medicosNomes.has(medicoNome)) {
          const chave = `${medicoNome}|${exame.MODALIDADE}|${exame.ESPECIALIDADE}`;
          
          if (!examesPorMedico.has(chave)) {
            examesPorMedico.set(chave, {
              id: chave,
              MEDICO: exame.MEDICO || '',
              ESTUDO_DESCRICAO: exame.ESTUDO_DESCRICAO || '',
              MODALIDADE: exame.MODALIDADE || '',
              ESPECIALIDADE: exame.ESPECIALIDADE || '',
              CATEGORIA: exame.CATEGORIA || '',
              EMPRESA: exame.EMPRESA || '',
              periodo_referencia: exame.periodo_referencia || '',
              total_exames: 0
            });
          }

          const grupo = examesPorMedico.get(chave)!;
          grupo.total_exames += exame.VALORES || 1;
          totalExamesCount += exame.VALORES || 1;
        }
      }

      const resultado = Array.from(examesPorMedico.values())
        .sort((a, b) => b.total_exames - a.total_exames);

      setExames(resultado);
      setFilteredExames(resultado);
      setTotalExames(totalExamesCount);

      if (resultado.length > 0) {
        toast.success(`${resultado.length} grupos de exames sem médico cadastrado encontrados (${totalExamesCount} exames no total)`);
      } else {
        toast.success('Todos os exames possuem médico cadastrado!');
      }
    } catch (error: any) {
      console.error('Erro ao buscar exames sem médico:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = exames.filter(exame =>
        exame.MEDICO.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exame.MODALIDADE.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exame.ESPECIALIDADE.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredExames(filtered);
    } else {
      setFilteredExames(exames);
    }
  }, [searchTerm, exames]);

  const exportarCSV = () => {
    const headers = ['Médico', 'Modalidade', 'Especialidade', 'Categoria', 'Cliente', 'Período', 'Total Exames'];
    const rows = filteredExames.map(e => [
      e.MEDICO,
      e.MODALIDADE,
      e.ESPECIALIDADE,
      e.CATEGORIA,
      e.EMPRESA,
      e.periodo_referencia,
      e.total_exames
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `exames_sem_medico_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('CSV exportado com sucesso!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Exames sem Médico Cadastrado
        </CardTitle>
        <CardDescription>
          Lista de exames cujo médico não existe na tabela de médicos cadastrados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este relatório identifica exames na volumetria cujo nome do médico não consta na tabela de médicos.
            Esses exames não serão incluídos no cálculo de repasse até que o médico seja cadastrado ou mapeado.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button onClick={buscarExamesSemMedico} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              'Buscar Exames sem Médico'
            )}
          </Button>

          {exames.length > 0 && (
            <Button variant="outline" onClick={exportarCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>

        {exames.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Grupos de Exames</p>
                <p className="text-2xl font-bold">{filteredExames.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total de Exames</p>
                <p className="text-2xl font-bold text-orange-600">{totalExames}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Filtrar por médico, modalidade ou especialidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Médico</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Total Exames</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExames.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum exame sem médico cadastrado'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExames.map((exame) => (
                      <TableRow key={exame.id}>
                        <TableCell className="font-medium">{exame.MEDICO}</TableCell>
                        <TableCell>{exame.MODALIDADE}</TableCell>
                        <TableCell>{exame.ESPECIALIDADE}</TableCell>
                        <TableCell>{exame.CATEGORIA}</TableCell>
                        <TableCell>{exame.EMPRESA}</TableCell>
                        <TableCell>{exame.periodo_referencia}</TableCell>
                        <TableCell className="text-right font-mono">{exame.total_exames}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
