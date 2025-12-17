import { AutoRegrasMaster } from '@/components/AutoRegrasMaster';

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sistema Automático de Regras</h1>
        <p className="text-muted-foreground mt-1">
          Aplicação automática garantida das 28 regras de negócio sempre que dados são inseridos
        </p>
      </div>
      
      <AutoRegrasMaster />
      
      <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
        <h3 className="font-semibold text-lg mb-2">Como funciona o Sistema Automático</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong>Detecção Automática:</strong> Monitora uploads concluídos em tempo real</li>
          <li>• <strong>Aplicação Instantânea:</strong> Aplica todas as 28 regras automaticamente</li>
          <li>• <strong>Validação Garantida:</strong> Dados só são aceitos após aplicação bem-sucedida</li>
          <li>• <strong>Zero Intervenção:</strong> Não requer cliques ou ações manuais</li>
          <li>• <strong>Monitoramento:</strong> Logs e alertas para qualquer problema</li>
        </ul>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <h3 className="font-semibold text-lg mb-2 text-blue-800">Regras v007 + v034 Integradas</h3>
        <p className="text-sm text-blue-700 mb-2">
          As regras de especialidade "Colunas" agora estão integradas no pipeline automático:
        </p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>v007:</strong> Colunas → MUSCULO ESQUELETICO (padrão)</li>
          <li>• <strong>v034:</strong> Colunas → NEURO + SC (para neurologistas da tabela <code className="bg-blue-100 px-1 rounded">medicos_neurologistas</code>)</li>
        </ul>
      </div>
    </div>
  );
}
