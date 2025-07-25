export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          session_id: string | null
          severity: string | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          session_id?: string | null
          severity?: string | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          session_id?: string | null
          severity?: string | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          backup_location: string | null
          backup_type: string
          checksum: string | null
          end_time: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          start_time: string | null
          status: string
        }
        Insert: {
          backup_location?: string | null
          backup_type: string
          checksum?: string | null
          end_time?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          start_time?: string | null
          status: string
        }
        Update: {
          backup_location?: string | null
          backup_type?: string
          checksum?: string | null
          end_time?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          start_time?: string | null
          status?: string
        }
        Relationships: []
      }
      categorias_exame: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      categorias_medico: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          cnpj: string | null
          cod_cliente: string | null
          contato: string | null
          created_at: string
          created_by: string | null
          data_inicio_contrato: string | null
          data_termino_vigencia: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cidade?: string | null
          cnpj?: string | null
          cod_cliente?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio_contrato?: string | null
          data_termino_vigencia?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cidade?: string | null
          cnpj?: string | null
          cod_cliente?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio_contrato?: string | null
          data_termino_vigencia?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracao_protecao: {
        Row: {
          created_at: string
          created_by: string | null
          dias_edicao_mes_anterior: number
          id: string
          permite_dados_futuros: boolean
          permite_edicao_historico: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dias_edicao_mes_anterior?: number
          id?: string
          permite_dados_futuros?: boolean
          permite_edicao_historico?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dias_edicao_mes_anterior?: number
          id?: string
          permite_dados_futuros?: boolean
          permite_edicao_historico?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      contratos_clientes: {
        Row: {
          acrescimo_percentual: number | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          desconto_percentual: number | null
          dia_vencimento: number | null
          especialidades: string[] | null
          forma_pagamento: string | null
          id: string
          modalidades: string[] | null
          numero_contrato: string
          observacoes: string | null
          status: string
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          acrescimo_percentual?: number | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          desconto_percentual?: number | null
          dia_vencimento?: number | null
          especialidades?: string[] | null
          forma_pagamento?: string | null
          id?: string
          modalidades?: string[] | null
          numero_contrato: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          acrescimo_percentual?: number | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          desconto_percentual?: number | null
          dia_vencimento?: number | null
          especialidades?: string[] | null
          forma_pagamento?: string | null
          id?: string
          modalidades?: string[] | null
          numero_contrato?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_metric_values: {
        Row: {
          dimensions: Json | null
          id: string
          metadata: Json | null
          metric_id: string | null
          timestamp: string | null
          value: number
        }
        Insert: {
          dimensions?: Json | null
          id?: string
          metadata?: Json | null
          metric_id?: string | null
          timestamp?: string | null
          value: number
        }
        Update: {
          dimensions?: Json | null
          id?: string
          metadata?: Json | null
          metric_id?: string | null
          timestamp?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_metric_values_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "custom_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_metrics: {
        Row: {
          alert_thresholds: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          id: string
          metric_type: string
          name: string
          parameters: Json | null
          query_template: string
          update_frequency_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          alert_thresholds?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          metric_type: string
          name: string
          parameters?: Json | null
          query_template: string
          update_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          alert_thresholds?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          metric_type?: string
          name?: string
          parameters?: Json | null
          query_template?: string
          update_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      data_access_logs: {
        Row: {
          action: string
          data_classification: string | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          sensitive_data_accessed: boolean | null
          timestamp: string | null
          user_agent: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          action: string
          data_classification?: string | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          sensitive_data_accessed?: boolean | null
          timestamp?: string | null
          user_agent?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          action?: string
          data_classification?: string | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          sensitive_data_accessed?: boolean | null
          timestamp?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          auto_delete: boolean | null
          created_at: string | null
          id: string
          legal_hold: boolean | null
          retention_period_days: number
          table_name: string
        }
        Insert: {
          auto_delete?: boolean | null
          created_at?: string | null
          id?: string
          legal_hold?: boolean | null
          retention_period_days: number
          table_name: string
        }
        Update: {
          auto_delete?: boolean | null
          created_at?: string | null
          id?: string
          legal_hold?: boolean | null
          retention_period_days?: number
          table_name?: string
        }
        Relationships: []
      }
      documentos_clientes: {
        Row: {
          clicksign_document_key: string | null
          cliente_id: string
          created_at: string
          data_assinatura: string | null
          data_envio_assinatura: string | null
          id: string
          medico_id: string | null
          nome_arquivo: string
          signatarios: Json | null
          status_documento: string
          tipo_documento: string
          updated_at: string
          url_arquivo: string | null
        }
        Insert: {
          clicksign_document_key?: string | null
          cliente_id: string
          created_at?: string
          data_assinatura?: string | null
          data_envio_assinatura?: string | null
          id?: string
          medico_id?: string | null
          nome_arquivo: string
          signatarios?: Json | null
          status_documento?: string
          tipo_documento: string
          updated_at?: string
          url_arquivo?: string | null
        }
        Update: {
          clicksign_document_key?: string | null
          cliente_id?: string
          created_at?: string
          data_assinatura?: string | null
          data_envio_assinatura?: string | null
          id?: string
          medico_id?: string | null
          nome_arquivo?: string
          signatarios?: Json | null
          status_documento?: string
          tipo_documento?: string
          updated_at?: string
          url_arquivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clientes_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_cobranca: {
        Row: {
          assunto: string
          cliente_email: string
          corpo_email: string | null
          created_at: string
          enviado_em: string
          erro_detalhes: string | null
          fatura_id: string | null
          id: string
          status: string
        }
        Insert: {
          assunto: string
          cliente_email: string
          corpo_email?: string | null
          created_at?: string
          enviado_em?: string
          erro_detalhes?: string | null
          fatura_id?: string | null
          id?: string
          status: string
        }
        Update: {
          assunto?: string
          cliente_email?: string
          corpo_email?: string | null
          created_at?: string
          enviado_em?: string
          erro_detalhes?: string | null
          fatura_id?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_cobranca_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturamento"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_data: {
        Row: {
          created_at: string | null
          encrypted_value: string
          encryption_algorithm: string | null
          field_name: string
          hash_value: string | null
          id: string
          record_id: string
          table_name: string
        }
        Insert: {
          created_at?: string | null
          encrypted_value: string
          encryption_algorithm?: string | null
          field_name: string
          hash_value?: string | null
          id?: string
          record_id: string
          table_name: string
        }
        Update: {
          created_at?: string | null
          encrypted_value?: string
          encryption_algorithm?: string | null
          field_name?: string
          hash_value?: string | null
          id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      escalas_medicas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          data_ausencia: string | null
          especialidade: string
          id: string
          medico_id: string
          modalidade: string
          motivo_ausencia: string | null
          observacoes: string | null
          status: string
          tipo_escala: string
          turno: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          data_ausencia?: string | null
          especialidade: string
          id?: string
          medico_id: string
          modalidade: string
          motivo_ausencia?: string | null
          observacoes?: string | null
          status?: string
          tipo_escala: string
          turno: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          data_ausencia?: string | null
          especialidade?: string
          id?: string
          medico_id?: string
          modalidade?: string
          motivo_ausencia?: string | null
          observacoes?: string | null
          status?: string
          tipo_escala?: string
          turno?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_medicas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      exames: {
        Row: {
          categoria: string
          cliente_id: string
          created_at: string
          created_by: string | null
          data_exame: string
          especialidade: string
          id: string
          medico_id: string
          modalidade: string
          observacoes: string | null
          paciente_nome: string
          quantidade: number
          status: string
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          categoria: string
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_exame: string
          especialidade: string
          id?: string
          medico_id: string
          modalidade: string
          observacoes?: string | null
          paciente_nome: string
          quantidade?: number
          status?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          categoria?: string
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_exame?: string
          especialidade?: string
          id?: string
          medico_id?: string
          modalidade?: string
          observacoes?: string | null
          paciente_nome?: string
          quantidade?: number
          status?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "exames_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamento: {
        Row: {
          categoria: string | null
          cliente: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          data_emissao: string
          data_exame: string | null
          data_pagamento: string | null
          data_vencimento: string
          especialidade: string | null
          id: string
          medico: string | null
          modalidade: string | null
          nome_exame: string | null
          numero_fatura: string
          omie_id: string
          paciente: string | null
          prioridade: string | null
          quantidade: number | null
          sync_date: string
          updated_at: string
          valor: number
          valor_bruto: number | null
        }
        Insert: {
          categoria?: string | null
          cliente?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          data_emissao: string
          data_exame?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          especialidade?: string | null
          id?: string
          medico?: string | null
          modalidade?: string | null
          nome_exame?: string | null
          numero_fatura: string
          omie_id: string
          paciente?: string | null
          prioridade?: string | null
          quantidade?: number | null
          sync_date?: string
          updated_at?: string
          valor: number
          valor_bruto?: number | null
        }
        Update: {
          categoria?: string | null
          cliente?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          data_emissao?: string
          data_exame?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          especialidade?: string | null
          id?: string
          medico?: string | null
          modalidade?: string | null
          nome_exame?: string | null
          numero_fatura?: string
          omie_id?: string
          paciente?: string | null
          prioridade?: string | null
          quantidade?: number | null
          sync_date?: string
          updated_at?: string
          valor?: number
          valor_bruto?: number | null
        }
        Relationships: []
      }
      field_mappings: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_value: string | null
          field_type: string
          file_type: string
          id: string
          is_required: boolean
          order_index: number
          source_field: string
          target_field: string
          target_table: string
          template_name: string
          transformation_rules: Json | null
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          field_type?: string
          file_type: string
          id?: string
          is_required?: boolean
          order_index?: number
          source_field: string
          target_field: string
          target_table: string
          template_name: string
          transformation_rules?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          field_type?: string
          file_type?: string
          id?: string
          is_required?: boolean
          order_index?: number
          source_field?: string
          target_field?: string
          target_table?: string
          template_name?: string
          transformation_rules?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: []
      }
      import_history: {
        Row: {
          created_at: string
          created_by: string | null
          error_details: Json | null
          file_type: string
          filename: string
          id: string
          import_summary: Json | null
          mapping_used: Json | null
          preview_data: Json | null
          records_failed: number | null
          records_imported: number | null
          status: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_details?: Json | null
          file_type: string
          filename: string
          id?: string
          import_summary?: Json | null
          mapping_used?: Json | null
          preview_data?: Json | null
          records_failed?: number | null
          records_imported?: number | null
          status?: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_details?: Json | null
          file_type?: string
          filename?: string
          id?: string
          import_summary?: Json | null
          mapping_used?: Json | null
          preview_data?: Json | null
          records_failed?: number | null
          records_imported?: number | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "import_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_templates: {
        Row: {
          active: boolean
          auto_detect_columns: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          file_type: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_detect_columns?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_type: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_detect_columns?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_type?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lgpd_consent: {
        Row: {
          consent_type: string
          email: string
          expires_at: string | null
          granted: boolean
          id: string
          ip_address: unknown | null
          legal_basis: string
          purpose: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          consent_type: string
          email: string
          expires_at?: string | null
          granted: boolean
          id?: string
          ip_address?: unknown | null
          legal_basis: string
          purpose: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          consent_type?: string
          email?: string
          expires_at?: string | null
          granted?: boolean
          id?: string
          ip_address?: unknown | null
          legal_basis?: string
          purpose?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          city: string | null
          country: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          success: boolean
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address: unknown
          success: boolean
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          success?: boolean
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      medicos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          crm: string
          email: string | null
          especialidade: string
          especialidades: string[] | null
          id: string
          modalidades: string[] | null
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          crm: string
          email?: string | null
          especialidade: string
          especialidades?: string[] | null
          id?: string
          modalidades?: string[] | null
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          crm?: string
          email?: string | null
          especialidade?: string
          especialidades?: string[] | null
          id?: string
          modalidades?: string[] | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      medicos_valores_repasse: {
        Row: {
          created_at: string | null
          especialidade: string
          id: string
          medico_id: string
          modalidade: string
          prioridade: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          especialidade: string
          id?: string
          medico_id: string
          modalidade: string
          prioridade: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          especialidade?: string
          id?: string
          medico_id?: string
          modalidade?: string
          prioridade?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicos_valores_repasse_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      modalidades: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pagamentos_medicos: {
        Row: {
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          descontos: number
          detalhes: Json | null
          id: string
          medico_id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          total_exames: number
          updated_at: string
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          descontos?: number
          detalhes?: Json | null
          id?: string
          medico_id: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          total_exames?: number
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          descontos?: number
          detalhes?: Json | null
          id?: string
          medico_id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          total_exames?: number
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_medicos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      partition_analysis: {
        Row: {
          analysis_timestamp: string | null
          expected_performance_gain: string | null
          id: string
          metadata: Json | null
          partition_strategy: string | null
          recommendation: string | null
          record_count: number | null
          size_mb: number | null
          table_name: string
        }
        Insert: {
          analysis_timestamp?: string | null
          expected_performance_gain?: string | null
          id?: string
          metadata?: Json | null
          partition_strategy?: string | null
          recommendation?: string | null
          record_count?: number | null
          size_mb?: number | null
          table_name: string
        }
        Update: {
          analysis_timestamp?: string | null
          expected_performance_gain?: string | null
          id?: string
          metadata?: Json | null
          partition_strategy?: string | null
          recommendation?: string | null
          record_count?: number | null
          size_mb?: number | null
          table_name?: string
        }
        Relationships: []
      }
      password_policies: {
        Row: {
          created_at: string | null
          history_count: number | null
          id: string
          lockout_duration_minutes: number | null
          max_age_days: number | null
          max_attempts: number | null
          min_length: number | null
          require_lowercase: boolean | null
          require_numbers: boolean | null
          require_symbols: boolean | null
          require_uppercase: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          history_count?: number | null
          id?: string
          lockout_duration_minutes?: number | null
          max_age_days?: number | null
          max_attempts?: number | null
          min_length?: number | null
          require_lowercase?: boolean | null
          require_numbers?: boolean | null
          require_symbols?: boolean | null
          require_uppercase?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          history_count?: number | null
          id?: string
          lockout_duration_minutes?: number | null
          max_age_days?: number | null
          max_attempts?: number | null
          min_length?: number | null
          require_lowercase?: boolean | null
          require_numbers?: boolean | null
          require_symbols?: boolean | null
          require_uppercase?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pendencias: {
        Row: {
          categoria: string
          created_at: string | null
          created_by: string | null
          data_limite: string | null
          descricao: string | null
          id: string
          metadata: Json | null
          modulo: string | null
          prioridade: string
          resolucao: string | null
          resolved_at: string | null
          resolved_by: string | null
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          created_by?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          metadata?: Json | null
          modulo?: string | null
          prioridade?: string
          resolucao?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          created_by?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          metadata?: Json | null
          modulo?: string | null
          prioridade?: string
          resolucao?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_logs: {
        Row: {
          id: string
          metadata: Json | null
          operation: string
          query_time: number
          row_count: number | null
          table_name: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          operation: string
          query_time: number
          row_count?: number | null
          table_name: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          operation?: string
          query_time?: number
          row_count?: number | null
          table_name?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      precos_servicos: {
        Row: {
          ativo: boolean
          categoria: string
          categoria_exame_id: string | null
          created_at: string
          created_by: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string
          descricao: string | null
          especialidade: string
          especialidade_id: string | null
          id: string
          modalidade: string
          modalidade_id: string | null
          prioridade: string
          prioridade_id: string | null
          updated_at: string
          valor_base: number
          valor_urgencia: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          categoria_exame_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string
          descricao?: string | null
          especialidade: string
          especialidade_id?: string | null
          id?: string
          modalidade: string
          modalidade_id?: string | null
          prioridade: string
          prioridade_id?: string | null
          updated_at?: string
          valor_base?: number
          valor_urgencia?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          categoria_exame_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string
          descricao?: string | null
          especialidade?: string
          especialidade_id?: string | null
          id?: string
          modalidade?: string
          modalidade_id?: string | null
          prioridade?: string
          prioridade_id?: string | null
          updated_at?: string
          valor_base?: number
          valor_urgencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "precos_servicos_categoria_exame_id_fkey"
            columns: ["categoria_exame_id"]
            isOneToOne: false
            referencedRelation: "categorias_exame"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_servicos_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_servicos_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "modalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_servicos_prioridade_id_fkey"
            columns: ["prioridade_id"]
            isOneToOne: false
            referencedRelation: "prioridades"
            referencedColumns: ["id"]
          },
        ]
      }
      prioridades: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regras_contrato: {
        Row: {
          acrescimo_percentual: number | null
          ativo: boolean
          categoria: string
          contrato_id: string
          created_at: string
          created_by: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string
          desconto_percentual: number | null
          especialidade: string
          id: string
          modalidade: string
          prioridade: string
          updated_at: string
          valor_personalizado: number | null
        }
        Insert: {
          acrescimo_percentual?: number | null
          ativo?: boolean
          categoria: string
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string
          desconto_percentual?: number | null
          especialidade: string
          id?: string
          modalidade: string
          prioridade: string
          updated_at?: string
          valor_personalizado?: number | null
        }
        Update: {
          acrescimo_percentual?: number | null
          ativo?: boolean
          categoria?: string
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string
          desconto_percentual?: number | null
          especialidade?: string
          id?: string
          modalidade?: string
          prioridade?: string
          updated_at?: string
          valor_personalizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      regua_cobranca: {
        Row: {
          ativo: boolean
          created_at: string
          dias_envio: number
          emails_enviados: number
          fatura_id: string | null
          id: string
          max_emails: number
          proximo_envio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_envio?: number
          emails_enviados?: number
          fatura_id?: string | null
          id?: string
          max_emails?: number
          proximo_envio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_envio?: number
          emails_enviados?: number
          fatura_id?: string | null
          id?: string
          max_emails?: number
          proximo_envio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regua_cobranca_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: true
            referencedRelation: "faturamento"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          alert_type: string
          auto_resolved: boolean | null
          description: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          severity: string
          status: string | null
          timestamp: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          auto_resolved?: boolean | null
          description: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          severity: string
          status?: string | null
          timestamp?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          auto_resolved?: boolean | null
          description?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          severity?: string
          status?: string | null
          timestamp?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      upload_logs: {
        Row: {
          created_at: string
          error_message: string | null
          file_type: string
          filename: string
          id: string
          records_processed: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_type: string
          filename: string
          id?: string
          records_processed?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_type?: string
          filename?: string
          id?: string
          records_processed?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_2fa: {
        Row: {
          backup_codes: string[] | null
          created_at: string | null
          enabled: boolean | null
          id: string
          last_used: string | null
          secret: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_used?: string | null
          secret: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_used?: string | null
          secret?: string
          user_id?: string
        }
        Relationships: []
      }
      user_menu_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          granted: boolean
          id: string
          menu_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          menu_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          menu_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      valores_referencia_de_para: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          estudo_descricao: string
          id: string
          updated_at: string
          valores: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          estudo_descricao: string
          id?: string
          updated_at?: string
          valores?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          estudo_descricao?: string
          id?: string
          updated_at?: string
          valores?: number
        }
        Relationships: []
      }
      volumetria_mobilemed: {
        Row: {
          ACCESSION_NUMBER: string | null
          arquivo_fonte: string
          CODIGO_INTERNO: number | null
          CODIGO_PACIENTE: string | null
          COMPLEMENTAR: string | null
          created_at: string
          created_by: string | null
          DATA_LAUDO: string | null
          DATA_PRAZO: string | null
          DATA_REALIZACAO: string | null
          DATA_REASSINATURA: string | null
          data_referencia: string | null
          DATA_TRANSFERENCIA: string | null
          data_upload: string
          DIGITADOR: string | null
          DUPLICADO: string | null
          EMPRESA: string
          ESPECIALIDADE: string | null
          ESTUDO_DESCRICAO: string | null
          HORA_LAUDO: string | null
          HORA_PRAZO: string | null
          HORA_REALIZACAO: string | null
          HORA_REASSINATURA: string | null
          HORA_TRANSFERENCIA: string | null
          id: string
          IMAGENS_CAPTURADAS: number | null
          IMAGENS_CHAVES: number | null
          MEDICO: string | null
          MEDICO_REASSINATURA: string | null
          MODALIDADE: string | null
          NOME_PACIENTE: string
          POSSUI_IMAGENS_CHAVE: string | null
          PRIORIDADE: string | null
          SEGUNDA_ASSINATURA: string | null
          STATUS: string | null
          updated_at: string
          VALORES: number | null
        }
        Insert: {
          ACCESSION_NUMBER?: string | null
          arquivo_fonte: string
          CODIGO_INTERNO?: number | null
          CODIGO_PACIENTE?: string | null
          COMPLEMENTAR?: string | null
          created_at?: string
          created_by?: string | null
          DATA_LAUDO?: string | null
          DATA_PRAZO?: string | null
          DATA_REALIZACAO?: string | null
          DATA_REASSINATURA?: string | null
          data_referencia?: string | null
          DATA_TRANSFERENCIA?: string | null
          data_upload?: string
          DIGITADOR?: string | null
          DUPLICADO?: string | null
          EMPRESA: string
          ESPECIALIDADE?: string | null
          ESTUDO_DESCRICAO?: string | null
          HORA_LAUDO?: string | null
          HORA_PRAZO?: string | null
          HORA_REALIZACAO?: string | null
          HORA_REASSINATURA?: string | null
          HORA_TRANSFERENCIA?: string | null
          id?: string
          IMAGENS_CAPTURADAS?: number | null
          IMAGENS_CHAVES?: number | null
          MEDICO?: string | null
          MEDICO_REASSINATURA?: string | null
          MODALIDADE?: string | null
          NOME_PACIENTE: string
          POSSUI_IMAGENS_CHAVE?: string | null
          PRIORIDADE?: string | null
          SEGUNDA_ASSINATURA?: string | null
          STATUS?: string | null
          updated_at?: string
          VALORES?: number | null
        }
        Update: {
          ACCESSION_NUMBER?: string | null
          arquivo_fonte?: string
          CODIGO_INTERNO?: number | null
          CODIGO_PACIENTE?: string | null
          COMPLEMENTAR?: string | null
          created_at?: string
          created_by?: string | null
          DATA_LAUDO?: string | null
          DATA_PRAZO?: string | null
          DATA_REALIZACAO?: string | null
          DATA_REASSINATURA?: string | null
          data_referencia?: string | null
          DATA_TRANSFERENCIA?: string | null
          data_upload?: string
          DIGITADOR?: string | null
          DUPLICADO?: string | null
          EMPRESA?: string
          ESPECIALIDADE?: string | null
          ESTUDO_DESCRICAO?: string | null
          HORA_LAUDO?: string | null
          HORA_PRAZO?: string | null
          HORA_REALIZACAO?: string | null
          HORA_REASSINATURA?: string | null
          HORA_TRANSFERENCIA?: string | null
          id?: string
          IMAGENS_CAPTURADAS?: number | null
          IMAGENS_CHAVES?: number | null
          MEDICO?: string | null
          MEDICO_REASSINATURA?: string | null
          MODALIDADE?: string | null
          NOME_PACIENTE?: string
          POSSUI_IMAGENS_CHAVE?: string | null
          PRIORIDADE?: string | null
          SEGUNDA_ASSINATURA?: string | null
          STATUS?: string | null
          updated_at?: string
          VALORES?: number | null
        }
        Relationships: []
      }
      volumetria_mobilemed_archive: {
        Row: {
          ACCESSION_NUMBER: string | null
          arquivo_fonte: string
          CODIGO_INTERNO: number | null
          CODIGO_PACIENTE: string | null
          COMPLEMENTAR: string | null
          created_at: string
          created_by: string | null
          DATA_LAUDO: string | null
          DATA_PRAZO: string | null
          DATA_REALIZACAO: string | null
          DATA_REASSINATURA: string | null
          data_referencia: string | null
          DATA_TRANSFERENCIA: string | null
          data_upload: string
          DIGITADOR: string | null
          DUPLICADO: string | null
          EMPRESA: string
          ESPECIALIDADE: string | null
          ESTUDO_DESCRICAO: string | null
          HORA_LAUDO: string | null
          HORA_PRAZO: string | null
          HORA_REALIZACAO: string | null
          HORA_REASSINATURA: string | null
          HORA_TRANSFERENCIA: string | null
          id: string
          IMAGENS_CAPTURADAS: number | null
          IMAGENS_CHAVES: number | null
          MEDICO: string | null
          MEDICO_REASSINATURA: string | null
          MODALIDADE: string | null
          NOME_PACIENTE: string
          POSSUI_IMAGENS_CHAVE: string | null
          PRIORIDADE: string | null
          SEGUNDA_ASSINATURA: string | null
          STATUS: string | null
          updated_at: string
          VALORES: number | null
        }
        Insert: {
          ACCESSION_NUMBER?: string | null
          arquivo_fonte: string
          CODIGO_INTERNO?: number | null
          CODIGO_PACIENTE?: string | null
          COMPLEMENTAR?: string | null
          created_at?: string
          created_by?: string | null
          DATA_LAUDO?: string | null
          DATA_PRAZO?: string | null
          DATA_REALIZACAO?: string | null
          DATA_REASSINATURA?: string | null
          data_referencia?: string | null
          DATA_TRANSFERENCIA?: string | null
          data_upload?: string
          DIGITADOR?: string | null
          DUPLICADO?: string | null
          EMPRESA: string
          ESPECIALIDADE?: string | null
          ESTUDO_DESCRICAO?: string | null
          HORA_LAUDO?: string | null
          HORA_PRAZO?: string | null
          HORA_REALIZACAO?: string | null
          HORA_REASSINATURA?: string | null
          HORA_TRANSFERENCIA?: string | null
          id?: string
          IMAGENS_CAPTURADAS?: number | null
          IMAGENS_CHAVES?: number | null
          MEDICO?: string | null
          MEDICO_REASSINATURA?: string | null
          MODALIDADE?: string | null
          NOME_PACIENTE: string
          POSSUI_IMAGENS_CHAVE?: string | null
          PRIORIDADE?: string | null
          SEGUNDA_ASSINATURA?: string | null
          STATUS?: string | null
          updated_at?: string
          VALORES?: number | null
        }
        Update: {
          ACCESSION_NUMBER?: string | null
          arquivo_fonte?: string
          CODIGO_INTERNO?: number | null
          CODIGO_PACIENTE?: string | null
          COMPLEMENTAR?: string | null
          created_at?: string
          created_by?: string | null
          DATA_LAUDO?: string | null
          DATA_PRAZO?: string | null
          DATA_REALIZACAO?: string | null
          DATA_REASSINATURA?: string | null
          data_referencia?: string | null
          DATA_TRANSFERENCIA?: string | null
          data_upload?: string
          DIGITADOR?: string | null
          DUPLICADO?: string | null
          EMPRESA?: string
          ESPECIALIDADE?: string | null
          ESTUDO_DESCRICAO?: string | null
          HORA_LAUDO?: string | null
          HORA_PRAZO?: string | null
          HORA_REALIZACAO?: string | null
          HORA_REASSINATURA?: string | null
          HORA_TRANSFERENCIA?: string | null
          id?: string
          IMAGENS_CAPTURADAS?: number | null
          IMAGENS_CHAVES?: number | null
          MEDICO?: string | null
          MEDICO_REASSINATURA?: string | null
          MODALIDADE?: string | null
          NOME_PACIENTE?: string
          POSSUI_IMAGENS_CHAVE?: string | null
          PRIORIDADE?: string | null
          SEGUNDA_ASSINATURA?: string | null
          STATUS?: string | null
          updated_at?: string
          VALORES?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      mv_volumetria_dashboard: {
        Row: {
          data_referencia: string | null
          EMPRESA: string | null
          ESPECIALIDADE: string | null
          mes_referencia: string | null
          MODALIDADE: string | null
          PRIORIDADE: string | null
          total_atrasados: number | null
          total_registros: number | null
          total_volume: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      analyze_partitioning_need: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      aplicar_valores_de_para: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      archive_old_volumetria_data: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_custom_metric: {
        Args: { metric_name: string }
        Returns: Json
      }
      can_edit_data: {
        Args: { data_referencia: string }
        Returns: boolean
      }
      can_insert_data: {
        Args: { data_referencia: string }
        Returns: boolean
      }
      can_view_data: {
        Args: { data_referencia: string }
        Returns: boolean
      }
      cleanup_old_performance_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_security_alert: {
        Args: {
          p_alert_type: string
          p_severity: string
          p_title: string
          p_description: string
          p_metadata?: Json
        }
        Returns: string
      }
      get_clientes_com_volumetria: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nome: string
          endereco: string
          cidade: string
          estado: string
          status: string
          ativo: boolean
          contato: string
          telefone: string
          email: string
          cnpj: string
          volume_exames: number
          total_registros: number
        }[]
      }
      get_periodo_faturamento: {
        Args: { data_referencia: string }
        Returns: {
          inicio_periodo: string
          fim_periodo: string
          mes_referencia: string
          ano_referencia: number
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
      get_volumetria_stats: {
        Args: {
          p_empresa?: string
          p_data_inicio?: string
          p_data_fim?: string
        }
        Returns: {
          total_exames: number
          total_registros: number
          total_atrasados: number
          percentual_atraso: number
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      hash_personal_data: {
        Args: { data: string }
        Returns: string
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      is_manager_or_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      limpar_dados_volumetria: {
        Args: { arquivos_fonte: string[] }
        Returns: {
          registros_removidos: number
          arquivos_processados: string[]
        }[]
      }
      log_audit_event: {
        Args: {
          p_table_name: string
          p_operation: string
          p_record_id: string
          p_old_data?: Json
          p_new_data?: Json
          p_severity?: string
        }
        Returns: string
      }
      log_data_access: {
        Args: {
          p_resource_type: string
          p_resource_id?: string
          p_action?: string
          p_sensitive?: boolean
          p_classification?: string
        }
        Returns: string
      }
      prepare_partition_structure: {
        Args: { table_name: string; partition_date: string }
        Returns: Json
      }
      promote_user_to_admin: {
        Args: { user_email: string }
        Returns: boolean
      }
      refresh_volumetria_dashboard: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_custom_metrics: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      user_can_access_empresa: {
        Args: { empresa_name: string }
        Returns: boolean
      }
      validate_cnpj: {
        Args: { cnpj: string }
        Returns: boolean
      }
      validate_cpf: {
        Args: { cpf: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "medico"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "user", "medico"],
    },
  },
} as const
