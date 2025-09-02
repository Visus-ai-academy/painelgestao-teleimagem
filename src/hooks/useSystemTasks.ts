import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskData {
  arquivo_fonte?: string;
  lote_upload?: string;
  periodo_referencia?: string;
  upload_id?: string;
}

interface SystemTask {
  id: string;
  task_type: string;
  task_data: TaskData;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  processed_at?: string | null;
}

export function useSystemTasks() {
  const [tasks, setTasks] = useState<SystemTask[]>([]);
  const [loading, setLoading] = useState(false);

  const buscarTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('system_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Converter os dados para o tipo correto
      const tasksTyped: SystemTask[] = (data || []).map(task => ({
        ...task,
        task_data: task.task_data as TaskData,
        status: task.status as SystemTask['status']
      }));
      
      setTasks(tasksTyped);
    } catch (error) {
      console.error('Erro ao buscar tasks:', error);
    }
  };

  const processarTasksPendentes = async () => {
    setLoading(true);
    try {
      // Buscar tasks pendentes de aplicação de regras
      const { data: tasksPendentes, error } = await supabase
        .from('system_tasks')
        .select('*')
        .eq('task_type', 'aplicar_regras_automatico')
        .eq('status', 'pendente')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (tasksPendentes && tasksPendentes.length > 0) {
        const taskRaw = tasksPendentes[0];
        const task: SystemTask = {
          ...taskRaw,
          task_data: taskRaw.task_data as TaskData,
          status: taskRaw.status as SystemTask['status']
        };
        
        console.log('🔄 Processando task automática:', task);

        // Marcar como processando
        await supabase
          .from('system_tasks')
          .update({ 
            status: 'processando',
            attempts: task.attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        // Executar sistema de regras otimizado
        const { data: resultado, error: errorRegras } = await supabase.functions
          .invoke('sistema-aplicacao-regras-otimizado', {
            body: {
              arquivo_fonte: task.task_data.arquivo_fonte || 'volumetria_padrao',
              lote_upload: task.task_data.lote_upload || 'auto-process',
              periodo_referencia: task.task_data.periodo_referencia || 'jun/25',
              forcar_aplicacao: true
            }
          });

        if (errorRegras) {
          console.error('Erro ao aplicar regras:', errorRegras);
          
          // Marcar como erro
          await supabase
            .from('system_tasks')
            .update({ 
              status: 'erro',
              error_message: errorRegras.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id);

          return { success: false, error: errorRegras.message };
        }

        // Marcar como concluído
        await supabase
          .from('system_tasks')
          .update({ 
            status: 'concluido',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        console.log('✅ Task processada com sucesso:', resultado);

        // Atualizar lista de tasks
        await buscarTasks();

        return { 
          success: true, 
          task_id: task.id,
          resultado: resultado?.data || resultado
        };
      }

      return { success: true, message: 'Nenhuma task pendente' };

    } catch (error: any) {
      console.error('Erro ao processar tasks:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const limparTasksAntigas = async () => {
    try {
      // Limpar tasks concluídas há mais de 24 horas
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);

      const { error } = await supabase
        .from('system_tasks')
        .delete()
        .eq('status', 'concluido')
        .lt('processed_at', dataLimite.toISOString());

      if (error) throw error;
      
      await buscarTasks();
    } catch (error) {
      console.error('Erro ao limpar tasks antigas:', error);
    }
  };

  useEffect(() => {
    buscarTasks();

    // Verificar tasks pendentes a cada 30 segundos
    const interval = setInterval(async () => {
      const { data: tasksPendentes } = await supabase
        .from('system_tasks')
        .select('id')
        .eq('status', 'pendente');

      if (tasksPendentes && tasksPendentes.length > 0) {
        console.log('🔔 Tasks pendentes detectadas, processando automaticamente...');
        await processarTasksPendentes();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    tasks,
    loading,
    buscarTasks,
    processarTasksPendentes,
    limparTasksAntigas
  };
}