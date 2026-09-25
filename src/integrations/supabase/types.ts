export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          initial_balance: number
          name: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name: string
          type: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          initial_balance?: number
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          permissions: Json | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          event: string
          id: string
          payload: Json
          process_error: string | null
          processed_at: string | null
          received_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          event: string
          id: string
          payload?: Json
          process_error?: string | null
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          event?: string
          id?: string
          payload?: Json
          process_error?: string | null
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount_limit: number
          category_id: string
          created_at: string
          id: string
          period_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_limit: number
          category_id: string
          created_at?: string
          id?: string
          period_month: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_limit?: number
          category_id?: string
          created_at?: string
          id?: string
          period_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          created_at: string | null
          descricao: string
          id: string
          imagem_url: string | null
          status: string
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: string
          imagem_url?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: string
          imagem_url?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: string
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          category_type?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          category_type?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          brand: string | null
          connected_account_id: string | null
          created_at: string | null
          due_date: number
          id: string
          limit: number
          name: string
          statement_date: number
          user_id: string
        }
        Insert: {
          brand?: string | null
          connected_account_id?: string | null
          created_at?: string | null
          due_date: number
          id?: string
          limit: number
          name: string
          statement_date: number
          user_id: string
        }
        Update: {
          brand?: string | null
          connected_account_id?: string | null
          created_at?: string | null
          due_date?: number
          id?: string
          limit?: number
          name?: string
          statement_date?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_current_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_projected_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      family_group_members: {
        Row: {
          created_at: string
          email: string
          family_group_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          family_group_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          family_group_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_group_members_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      goal_allocations: {
        Row: {
          allocated_on: string
          amount: number
          created_at: string
          goal_id: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          allocated_on?: string
          amount: number
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Update: {
          allocated_on?: string
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_allocations_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_allocations_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "vw_goal_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          color: string
          created_at: string
          deadline: string | null
          executed_at: string | null
          icon: string
          id: string
          name: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          deadline?: string | null
          executed_at?: string | null
          icon?: string
          id?: string
          name: string
          target_value: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          deadline?: string | null
          executed_at?: string | null
          icon?: string
          id?: string
          name?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          id: string
          ledger_id: string
          paid_by_person_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          description: string
          entry_date?: string
          id?: string
          ledger_id: string
          paid_by_person_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          ledger_id?: string
          paid_by_person_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_paid_by_person_id_fkey"
            columns: ["paid_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_participants: {
        Row: {
          created_at: string
          id: string
          ledger_id: string
          person_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          ledger_id: string
          person_id: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          ledger_id?: string
          person_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ledger_participants_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          owner_weight: number
          pix_key: string | null
          pix_name: string | null
          settled_at: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          owner_weight?: number
          pix_key?: string | null
          pix_name?: string | null
          settled_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          owner_weight?: number
          pix_key?: string | null
          pix_name?: string | null
          settled_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchants_dictionary: {
        Row: {
          aliases: string[] | null
          category: string
          confidence_modifier: number
          context: string | null
          created_at: string | null
          created_by: string | null
          entity_name: string
          entry_type: string
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_used_at: string | null
          merchant_key: string
          metadata: Json | null
          priority: number
          regex_patterns: string[] | null
          region: string | null
          source_type: string | null
          state_specific: boolean | null
          states: string[] | null
          subcategory: string | null
          updated_at: string | null
          updated_by: string | null
          usage_count: number | null
        }
        Insert: {
          aliases?: string[] | null
          category: string
          confidence_modifier?: number
          context?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_name: string
          entry_type?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          merchant_key: string
          metadata?: Json | null
          priority?: number
          regex_patterns?: string[] | null
          region?: string | null
          source_type?: string | null
          state_specific?: boolean | null
          states?: string[] | null
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number | null
        }
        Update: {
          aliases?: string[] | null
          category?: string
          confidence_modifier?: number
          context?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_name?: string
          entry_type?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          merchant_key?: string
          metadata?: Json | null
          priority?: number
          regex_patterns?: string[] | null
          region?: string | null
          source_type?: string | null
          state_specific?: boolean | null
          states?: string[] | null
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      monthly_summaries: {
        Row: {
          categories: Json
          computed_at: string
          essential_monthly: number
          headline_basis: number | null
          headline_pct: number | null
          id: string
          inflation_12m: number | null
          inflation_3m: number | null
          inflation_6m: number | null
          matched_merchants: number
          period_month: string
          sample_size: number
          user_id: string
        }
        Insert: {
          categories?: Json
          computed_at?: string
          essential_monthly?: number
          headline_basis?: number | null
          headline_pct?: number | null
          id?: string
          inflation_12m?: number | null
          inflation_3m?: number | null
          inflation_6m?: number | null
          matched_merchants?: number
          period_month: string
          sample_size?: number
          user_id: string
        }
        Update: {
          categories?: Json
          computed_at?: string
          essential_monthly?: number
          headline_basis?: number | null
          headline_pct?: number | null
          id?: string
          inflation_12m?: number | null
          inflation_3m?: number | null
          inflation_6m?: number | null
          matched_merchants?: number
          period_month?: string
          sample_size?: number
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          priority: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          priority?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          priority?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          bank_slip_url: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string | null
          id: string
          name: string
          pix: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          pix?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          pix?: string | null
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          budget: number
          color: string
          created_at: string
          description: string | null
          end_date: string
          final_report: Json | null
          funded_from_goal: number
          goal_id: string | null
          icon: string
          id: string
          kind: string
          ledger_id: string | null
          name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          budget?: number
          color?: string
          created_at?: string
          description?: string | null
          end_date: string
          final_report?: Json | null
          funded_from_goal?: number
          goal_id?: string | null
          icon?: string
          id?: string
          kind?: string
          ledger_id?: string | null
          name: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          budget?: number
          color?: string
          created_at?: string
          description?: string | null
          end_date?: string
          final_report?: Json | null
          funded_from_goal?: number
          goal_id?: string | null
          icon?: string
          id?: string
          kind?: string
          ledger_id?: string | null
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: true
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: true
            referencedRelation: "vw_goal_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: true
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          hits: number
          identity: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          identity: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          identity?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by_txn_id: string | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          is_fixed: boolean
          start_date: string
          total_installments: number
          total_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by_txn_id?: string | null
          description: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_fixed?: boolean
          start_date?: string
          total_installments: number
          total_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by_txn_id?: string | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_fixed?: boolean
          start_date?: string
          total_installments?: number
          total_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      split_contracts: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          person_id: string
          proportion_percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          person_id: string
          proportion_percentage: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          person_id?: string
          proportion_percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_contracts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_contracts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          asaas_plan_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          limits: Json | null
          metadata: Json | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          asaas_plan_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          limits?: Json | null
          metadata?: Json | null
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          asaas_plan_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          limits?: Json | null
          metadata?: Json | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          category_id: string | null
          compensation_value: number | null
          composition_details: string | null
          created_at: string | null
          credit_card_id: string | null
          date: string
          description: string
          id: string
          installment_number: number | null
          is_fixed: boolean | null
          is_shared: boolean | null
          ledger_id: string | null
          linked_txn_id: string | null
          liquidation_date: string | null
          paid_by_user_id: string | null
          payment_method: string | null
          person_id: string | null
          project_id: string | null
          series_id: string | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          compensation_value?: number | null
          composition_details?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          date: string
          description: string
          id?: string
          installment_number?: number | null
          is_fixed?: boolean | null
          is_shared?: boolean | null
          ledger_id?: string | null
          linked_txn_id?: string | null
          liquidation_date?: string | null
          paid_by_user_id?: string | null
          payment_method?: string | null
          person_id?: string | null
          project_id?: string | null
          series_id?: string | null
          status?: string
          type: string
          updated_at?: string | null
          user_id: string
          value: number
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          compensation_value?: number | null
          composition_details?: string | null
          created_at?: string | null
          credit_card_id?: string | null
          date?: string
          description?: string
          id?: string
          installment_number?: number | null
          is_fixed?: boolean | null
          is_shared?: boolean | null
          ledger_id?: string | null
          linked_txn_id?: string | null
          liquidation_date?: string | null
          paid_by_user_id?: string | null
          payment_method?: string | null
          person_id?: string | null
          project_id?: string | null
          series_id?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_current_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "vw_account_projected_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_linked_txn_id_fkey"
            columns: ["linked_txn_id"]
            isOneToOne: false
            referencedRelation: "transaction_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_linked_txn_id_fkey"
            columns: ["linked_txn_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vw_goal_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      user_learned_patterns: {
        Row: {
          category: string
          confidence: number
          created_at: string | null
          description: string
          first_learned_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          metadata: Json | null
          normalized_description: string
          source_type: string
          subcategory: string | null
          usage_count: number
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number
          created_at?: string | null
          description: string
          first_learned_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json | null
          normalized_description: string
          source_type?: string
          subcategory?: string | null
          usage_count?: number
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string | null
          description?: string
          first_learned_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json | null
          normalized_description?: string
          source_type?: string
          subcategory?: string | null
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_path: string | null
          body: string
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_path?: string | null
          body: string
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_path?: string | null
          body?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          asaas_customer_id: string | null
          avatar_path: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          metadata: Json | null
          onboarding_completed: boolean | null
          preferences: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string
          blocked_reason: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          grace_period_end: string | null
          id: string
          last_payment_at: string | null
          metadata: Json | null
          next_due_date: string | null
          plan_id: string
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          blocked_reason?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          grace_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          metadata?: Json | null
          next_due_date?: string | null
          plan_id: string
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          blocked_reason?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          grace_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          metadata?: Json | null
          next_due_date?: string | null
          plan_id?: string
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_usage: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric: string
          period_end: string
          period_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric: string
          period_end: string
          period_start: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_frequent_merchants: {
        Row: {
          aliases: string[] | null
          category: string | null
          confidence_modifier: number | null
          entity_name: string | null
          entry_type: string | null
          id: string | null
          last_used_at: string | null
          merchant_key: string | null
          priority: number | null
          subcategory: string | null
          usage_count: number | null
        }
        Relationships: []
      }
      series_summary: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_installments: number | null
          description: string | null
          id: string | null
          is_fixed: boolean | null
          paid_installments: number | null
          paid_value: number | null
          pending_installments: number | null
          pending_value: number | null
          total_installments: number | null
          total_value: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_installments: {
        Row: {
          date: string | null
          description: string | null
          id: string | null
          installment_display: string | null
          installment_number: number | null
          series_description: string | null
          series_id: string | null
          series_is_fixed: boolean | null
          series_total_value: number | null
          status: string | null
          total_installments: number | null
          type: string | null
          user_id: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_account_current_balance: {
        Row: {
          account_id: string | null
          current_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_account_projected_balance: {
        Row: {
          account_id: string | null
          projected_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_goal_progress: {
        Row: {
          allocations_count: number | null
          color: string | null
          created_at: string | null
          deadline: string | null
          executed_at: string | null
          icon: string | null
          id: string | null
          last_allocation_on: string | null
          monthly_needed: number | null
          months_left: number | null
          name: string | null
          progress_pct: number | null
          project_id: string | null
          remaining_value: number | null
          saved_value: number | null
          target_value: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_free_plan: { Args: { p_plan_id: string }; Returns: Json }
      admin_activate_plan_for_user: {
        Args: { p_plan_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_create_admin_user: {
        Args: { p_email: string; p_full_name: string; p_password: string }
        Returns: Json
      }
      admin_create_user: {
        Args: { p_email: string; p_full_name: string; p_password: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      admin_dashboard_metrics: { Args: never; Returns: Json }
      admin_get_user_details: { Args: { p_user_id: string }; Returns: Json }
      admin_list_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_active: boolean
          last_sign_in_at: string
          user_id: string
        }[]
      }
      admin_list_subscriptions: {
        Args: never
        Returns: {
          amount: number
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_start: string
          email: string
          full_name: string
          id: string
          is_current: boolean
          last_payment_at: string
          period_end: string
          plan_name: string
          plan_slug: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          billing_cycle: string
          blocked_until: string
          cancel_at_period_end: boolean
          created_at: string
          email: string
          full_name: string
          is_admin: boolean
          last_sign_in_at: string
          period_end: string
          plan_name: string
          plan_slug: string
          subscription_status: string
          user_id: string
        }[]
      }
      admin_set_user_block: {
        Args: { p_reason?: string; p_until: string; p_user_id: string }
        Returns: undefined
      }
      admin_toggle_admin: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: undefined
      }
      check_usage_limit: {
        Args: { current_value: number; limit_name: string }
        Returns: boolean
      }
      cleanup_orphaned_series: { Args: never; Returns: number }
      cleanup_rate_limit_counters: {
        Args: { p_older_than_hours?: number }
        Returns: number
      }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: Json
      }
      consume_rate_limit_key: {
        Args: {
          p_bucket: string
          p_identity: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: Json
      }
      create_installment_series: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_credit_card_id: string
          p_description: string
          p_installments_data: Json
          p_is_fixed: boolean
          p_payment_method: string
          p_person_id: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      delete_installment_series: {
        Args: { p_series_id: string; p_user_id: string }
        Returns: number
      }
      get_admin_user: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          permissions: Json
          role: string
          user_id: string
        }[]
      }
      get_my_subscription_status: { Args: never; Returns: Json }
      get_top_merchants: {
        Args: { p_limit?: number }
        Returns: {
          aliases: string[]
          category: string
          confidence_modifier: number
          entity_name: string
          entry_type: string
          id: string
          merchant_key: string
          priority: number
          subcategory: string
          usage_count: number
        }[]
      }
      get_top_merchants_impl: {
        Args: { p_limit?: number }
        Returns: {
          aliases: string[]
          category: string
          confidence_modifier: number
          entity_name: string
          entry_type: string
          id: string
          merchant_key: string
          priority: number
          subcategory: string
          usage_count: number
        }[]
      }
      get_user_plan: {
        Args: { p_user_id?: string }
        Returns: {
          features: Json
          limits: Json
          plan_id: string
          plan_name: string
          plan_slug: string
          status: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      orbi_active_plan_features: { Args: { p_user_id: string }; Returns: Json }
      orbi_active_plan_limits: { Args: { p_user_id: string }; Returns: Json }
      orbi_budget_copy_previous: { Args: { p_month: string }; Returns: number }
      orbi_budget_overview: {
        Args: {
          p_exclude_projects?: boolean
          p_month?: string
          p_scope?: string
        }
        Returns: Json
      }
      orbi_cash_forecast: {
        Args: { p_horizon_days?: number; p_scope?: string }
        Returns: Json
      }
      orbi_claim_family_invites: { Args: never; Returns: undefined }
      orbi_daily_burn_rate: {
        Args: { p_days?: number; p_scope?: string }
        Returns: Json
      }
      orbi_exec_if_tables: {
        Args: { p_commands: string[]; p_tables: string[] }
        Returns: undefined
      }
      orbi_family_user_ids: { Args: never; Returns: string[] }
      orbi_goal_execute: {
        Args: {
          p_end_date: string
          p_extra_budget?: number
          p_goal_id: string
          p_kind?: string
          p_name: string
          p_start_date: string
          p_with_ledger?: boolean
        }
        Returns: string
      }
      orbi_has_feature: { Args: { p_key: string }; Returns: boolean }
      orbi_is_essential_category: { Args: { p_name: string }; Returns: boolean }
      orbi_is_safe_multiline: {
        Args: { p_max: number; p_value: string }
        Returns: boolean
      }
      orbi_is_safe_text: {
        Args: { p_max: number; p_value: string }
        Returns: boolean
      }
      orbi_is_safe_url: {
        Args: { p_max: number; p_value: string }
        Returns: boolean
      }
      orbi_ledger_settle: { Args: { p_ledger_id: string }; Returns: Json }
      orbi_ledger_summary: { Args: { p_ledger_id: string }; Returns: Json }
      orbi_merchant_root: { Args: { p_normalized: string }; Returns: string }
      orbi_monthly_closing: {
        Args: {
          p_exclude_projects?: boolean
          p_month?: string
          p_scope?: string
        }
        Returns: Json
      }
      orbi_my_family_group_id: { Args: never; Returns: string }
      orbi_no_subscription: { Args: { p_label: string }; Returns: undefined }
      orbi_norm_text: { Args: { p_value: string }; Returns: string }
      orbi_pct_change: {
        Args: { p_current: number; p_previous: number }
        Returns: number
      }
      orbi_personal_inflation: {
        Args: { p_months?: number; p_refresh?: boolean }
        Returns: Json
      }
      orbi_personal_inflation_compute: {
        Args: { p_month: string; p_user_id: string }
        Returns: {
          categories: Json
          computed_at: string
          essential_monthly: number
          headline_basis: number | null
          headline_pct: number | null
          id: string
          inflation_12m: number | null
          inflation_3m: number | null
          inflation_6m: number | null
          matched_merchants: number
          period_month: string
          sample_size: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "monthly_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      orbi_personal_inflation_run_monthly: { Args: never; Returns: number }
      orbi_project_archive: { Args: { p_project_id: string }; Returns: Json }
      orbi_project_close: {
        Args: { p_auto?: boolean; p_project_id: string }
        Returns: Json
      }
      orbi_project_overview: { Args: { p_project_id: string }; Returns: Json }
      orbi_project_reopen: {
        Args: { p_end_date?: string; p_project_id: string }
        Returns: undefined
      }
      orbi_project_totals: { Args: { p_project_id: string }; Returns: Json }
      orbi_projects_auto_archive: { Args: never; Returns: number }
      orbi_projects_list: { Args: { p_scope?: string }; Returns: Json }
      orbi_quota_lock: {
        Args: { p_resource: string; p_user_id: string }
        Returns: undefined
      }
      orbi_quota_max: {
        Args: { p_default: number; p_key: string; p_limits: Json }
        Returns: number
      }
      orbi_quota_reject: {
        Args: { p_label: string; p_max: number }
        Returns: undefined
      }
      orbi_quota_snapshot: { Args: never; Returns: Json }
      orbi_require_auth: { Args: never; Returns: string }
      orbi_require_feature: {
        Args: { p_key: string; p_label: string; p_user_id: string }
        Returns: undefined
      }
      orbi_sanitize_search_text: {
        Args: { p_max?: number; p_value: string }
        Returns: string
      }
      orbi_scope_user_ids: { Args: { p_scope: string }; Returns: string[] }
      orbi_service_roles: { Args: never; Returns: string }
      orbi_tenant_tables: { Args: never; Returns: string[] }
      record_merchant_usage: {
        Args: { p_merchant_id: string }
        Returns: undefined
      }
      refresh_frequent_merchants: { Args: never; Returns: undefined }
      require_self: { Args: { p_claimed: string }; Returns: string }
      search_banking_pattern: {
        Args: { p_context?: string; p_description: string }
        Returns: {
          category: string
          confidence_modifier: number
          id: string
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_banking_pattern_impl: {
        Args: { p_context?: string; p_description: string }
        Returns: {
          category: string
          confidence_modifier: number
          id: string
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_by_keywords: {
        Args: { p_description: string; p_type?: string }
        Returns: {
          category: string
          confidence_modifier: number
          id: string
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_by_keywords_impl: {
        Args: { p_description: string; p_type?: string }
        Returns: {
          category: string
          confidence_modifier: number
          id: string
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_merchant: {
        Args: {
          p_description: string
          p_limit?: number
          p_user_location?: string
        }
        Returns: {
          category: string
          confidence_modifier: number
          entity_name: string
          id: string
          match_score: number
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_merchant_compound_words: {
        Args: {
          p_description: string
          p_min_score?: number
          p_user_location?: string
        }
        Returns: {
          category: string
          confidence_modifier: number
          entity_name: string
          id: string
          match_score: number
          matched_tokens: string[]
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_merchant_compound_words_impl: {
        Args: {
          p_description: string
          p_min_score?: number
          p_user_location?: string
        }
        Returns: {
          category: string
          confidence_modifier: number
          entity_name: string
          id: string
          match_score: number
          matched_tokens: string[]
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      search_merchant_impl: {
        Args: {
          p_description: string
          p_limit?: number
          p_user_location?: string
        }
        Returns: {
          category: string
          confidence_modifier: number
          entity_name: string
          id: string
          match_score: number
          merchant_key: string
          priority: number
          subcategory: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_installment_series: {
        Args: {
          p_installments_data: Json
          p_series_id: string
          p_user_id: string
        }
        Returns: number
      }
      update_profile_emails: { Args: never; Returns: undefined }
      update_user_learned_pattern: {
        Args: {
          p_category: string
          p_confidence?: number
          p_description: string
          p_subcategory?: string
        }
        Returns: undefined
      }
      learn_transaction_classification: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      user_active_plan_limits: { Args: { p_user_id: string }; Returns: Json }
      user_has_feature: { Args: { feature_name: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
