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
          cnpj: string | null
          cod_cliente: string | null
          contato: string | null
          created_at: string
          created_by: string | null
          data_inicio_contrato: string | null
          data_termino_vigencia: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          cod_cliente?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio_contrato?: string | null
          data_termino_vigencia?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          cod_cliente?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio_contrato?: string | null
          data_termino_vigencia?: string | null
          email?: string | null
          endereco?: string | null
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
          cliente_email: string | null
          cliente_nome: string
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_fatura: string
          omie_id: string
          status: string
          sync_date: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome: string
          created_at?: string
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_fatura: string
          omie_id: string
          status: string
          sync_date?: string
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_fatura?: string
          omie_id?: string
          status?: string
          sync_date?: string
          updated_at?: string
          valor?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      get_user_role: {
        Args: { user_id: string }
        Returns: string
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
      promote_user_to_admin: {
        Args: { user_email: string }
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
