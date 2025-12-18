import { LimparUploads } from '@/components/LimparUploads';
import { LimparContratosPrecos } from '@/components/LimparContratosPrecos';
import { LimparClientesContratosPrecos } from '@/components/LimparClientesContratosPrecos';
import { LimparDadosFicticios } from '@/components/LimparDadosFicticios';
import { LimparCacheVolumetria } from '@/components/LimparCacheVolumetria';
import { LimparVolumetriaTruncate } from '@/components/LimparVolumetriaTruncate';
import { LimparRepasseReprocessar } from '@/components/LimparRepasseReprocessar';
import { LimparPeriodoLocalStorage } from '@/components/LimparPeriodoLocalStorage';

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
        {/* PRIMEIRO: Limpar período do localStorage */}
        <LimparPeriodoLocalStorage />
        
        <LimparRepasseReprocessar />
        <LimparVolumetriaTruncate />
        <LimparCacheVolumetria />
        <LimparDadosFicticios />
        <LimparClientesContratosPrecos />
        <LimparContratosPrecos />
        <LimparUploads />
      </div>
    </div>
  );
}