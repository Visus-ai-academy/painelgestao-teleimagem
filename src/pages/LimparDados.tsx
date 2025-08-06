import LimparDadosCompleto from '@/components/LimparDadosCompleto';
import { LimparDadosRegra } from '@/components/LimparDadosRegra';
import { LimparPrecos } from '@/components/LimparPrecos';
import { LimparUploads } from '@/components/LimparUploads';
import { LimparContratosPrecos } from '@/components/LimparContratosPrecos';
import { LimparClientesContratosPrecos } from '@/components/LimparClientesContratosPrecos';

export default function LimparDados() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Limpar Dados</h1>
        <p className="text-muted-foreground mt-1">
          Ferramentas para limpeza e gerenciamento de dados do sistema
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        <LimparClientesContratosPrecos />
        <LimparContratosPrecos />
        <LimparPrecos />
        <LimparDadosRegra />
        <LimparDadosCompleto />
        <LimparUploads />
      </div>
    </div>
  );
}