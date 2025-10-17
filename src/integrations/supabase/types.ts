export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      payment_history: {
        Row: {
          amount: number
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
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
          logo_url: string | null
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
          logo_url?: string | null
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
          logo_url?: string | null
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
          linked_txn_id: string | null
          liquidation_date: string | null
          payment_method: string | null
          person_id: string | null
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
          linked_txn_id?: string | null
          liquidation_date?: string | null
          payment_method?: string | null
          person_id?: string | null
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
          linked_txn_id?: string | null
          liquidation_date?: string | null
          payment_method?: string | null
          person_id?: string | null
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
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
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
          avatar_url?: string | null
          created_at?: string | null
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
          avatar_url?: string | null
          created_at?: string | null
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
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          metadata: Json | null
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
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
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
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
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
    }
    Functions: {
      admin_list_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          current_period_end: string
          email: string
          full_name: string
          onboarding_completed: boolean
          plan_name: string
          plan_slug: string
          subscription_status: string
          user_id: string
        }[]
      }
      check_usage_limit: {
        Args: { current_value: number; limit_name: string }
        Returns: boolean
      }
      cleanup_orphaned_series: {
        Args: Record<PropertyKey, never>
        Returns: number
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
      generate_future_fixed_transactions: {
        Args: { count: number; from_date: string; target_series_id: string }
        Returns: number
      }
      get_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          is_active: boolean
          permissions: Json
          role: string
          user_id: string
        }[]
      }
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
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      maintain_fixed_transaction_series: {
        Args: Record<PropertyKey, never>
        Returns: {
          generated_count: number
          next_generation_date: string
          series_id: string
        }[]
      }
      record_merchant_usage: {
        Args: { p_merchant_id: string }
        Returns: undefined
      }
      refresh_frequent_merchants: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      run_fixed_transaction_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: {
          generated_transactions: number
          processed_series: number
        }[]
      }
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
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      update_installment_series: {
        Args: {
          p_installments_data: Json
          p_series_id: string
          p_user_id: string
        }
        Returns: number
      }
      update_profile_emails: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_transaction_series_with_balance: {
        Args: {
          affected_account_id: string
          from_date: string
          new_account_id: string
          new_category_id: string
          new_credit_card_id: string
          new_description: string
          new_installments: number
          new_is_fixed: boolean
          new_payment_method: string
          new_person_id: string
          new_type: string
          new_value: number
          series_id: string
          total_value_difference: number
        }
        Returns: number
      }
      update_transaction_with_balance: {
        Args: {
          affected_account_id: string
          new_account_id: string
          new_category_id: string
          new_credit_card_id: string
          new_date: string
          new_description: string
          new_installments: number
          new_is_fixed: boolean
          new_payment_method: string
          new_person_id: string
          new_type: string
          new_value: number
          transaction_id: string
          value_difference: number
        }
        Returns: undefined
      }
      update_user_learned_pattern: {
        Args: {
          p_category: string
          p_confidence?: number
          p_description: string
          p_subcategory?: string
        }
        Returns: undefined
      }
      user_has_feature: {
        Args: { feature_name: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          owner?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          updated_at: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {},
  },
} as const

