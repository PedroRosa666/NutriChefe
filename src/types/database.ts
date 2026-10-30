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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_demo_accounts: {
        Row: {
          admin_id: string
          created_at: string
          extra_patients: string[]
          nutritionist_id: string | null
          patient_id: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          extra_patients?: string[]
          nutritionist_id?: string | null
          patient_id?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          extra_patients?: string[]
          nutritionist_id?: string | null
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_demo_accounts_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_demo_accounts_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_demo_accounts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_configurations: {
        Row: {
          ai_name: string
          created_at: string | null
          custom_instructions: string | null
          id: string
          is_active: boolean | null
          nutritionist_id: string
          personality: string
          updated_at: string | null
        }
        Insert: {
          ai_name?: string
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          is_active?: boolean | null
          nutritionist_id: string
          personality?: string
          updated_at?: string | null
        }
        Update: {
          ai_name?: string
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          is_active?: boolean | null
          nutritionist_id?: string
          personality?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_configurations_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_message_at: string | null
          nutritionist_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          nutritionist_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          nutritionist_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_type?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_operations: {
        Row: {
          created_at: string
          id: string
          kind: string
          request_hash: string
          result: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          kind: string
          request_hash: string
          result?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          request_hash?: string
          result?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          canceled_by: string | null
          client_id: string
          created_at: string
          duration_min: number
          id: string
          location: string
          mode: string
          notes: string
          nutritionist_id: string
          reminded_day_at: string | null
          reminded_hour_at: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          canceled_by?: string | null
          client_id: string
          created_at?: string
          duration_min?: number
          id?: string
          location?: string
          mode?: string
          notes?: string
          nutritionist_id: string
          reminded_day_at?: string | null
          reminded_hour_at?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          canceled_by?: string | null
          client_id?: string
          created_at?: string
          duration_min?: number
          id?: string
          location?: string
          mode?: string
          notes?: string
          nutritionist_id?: string
          reminded_day_at?: string | null
          reminded_hour_at?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_events: {
        Row: {
          actor_id: string | null
          client_id: string
          dedupe_key: string
          entity_id: string | null
          entity_version: number | null
          id: string
          kind: string
          nutritionist_id: string | null
          occurred_at: string
          summary: Json
        }
        Insert: {
          actor_id?: string | null
          client_id: string
          dedupe_key: string
          entity_id?: string | null
          entity_version?: number | null
          id?: string
          kind: string
          nutritionist_id?: string | null
          occurred_at?: string
          summary?: Json
        }
        Update: {
          actor_id?: string | null
          client_id?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_version?: number | null
          id?: string
          kind?: string
          nutritionist_id?: string | null
          occurred_at?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "care_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_events_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          nutritionist_id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          nutritionist_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          nutritionist_id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_messages_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          created_at: string
          id: string
          message: string
          stack: string
          url: string
          user_agent: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          stack?: string
          url?: string
          user_agent?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stack?: string
          url?: string
          user_agent?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_errors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_health_profiles: {
        Row: {
          activity_level: string | null
          allergies: string[]
          birth_date: string | null
          dietary_preferences: string[]
          goal: string | null
          height_cm: number | null
          notes: string
          sex: string | null
          target_weight_kg: number | null
          updated_at: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          allergies?: string[]
          birth_date?: string | null
          dietary_preferences?: string[]
          goal?: string | null
          height_cm?: number | null
          notes?: string
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          allergies?: string[]
          birth_date?: string | null
          dietary_preferences?: string[]
          goal?: string | null
          height_cm?: number | null
          notes?: string
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_health_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_plan_selection: {
        Row: {
          client_id: string
          plan_id: string
          selected_at: string
        }
        Insert: {
          client_id: string
          plan_id: string
          selected_at?: string
        }
        Update: {
          client_id?: string
          plan_id?: string
          selected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_plan_selection_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_plan_selection_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_visitors: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_hash: string
          nutritionist_id: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash: string
          nutritionist_id: string
          patient_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string
          nutritionist_id?: string
          patient_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_swap_requests: {
        Row: {
          applied: boolean
          client_id: string
          counter_food_id: string | null
          counter_grams: number | null
          counter_label: string | null
          counter_recipe_id: string | null
          counter_servings: number | null
          created_at: string
          day: number
          effective_from: string | null
          id: string
          item_id: string | null
          meal: string | null
          meal_id: string | null
          meal_name: string | null
          nutritionist_id: string
          option_group: number | null
          original_food_id: string | null
          original_label: string
          original_recipe_id: string | null
          plan_id: string
          reason: string
          requested_food_id: string | null
          requested_grams: number | null
          requested_label: string | null
          requested_recipe_id: string | null
          requested_servings: number | null
          resolved_at: string | null
          response_note: string
          status: string
          version_id: string | null
        }
        Insert: {
          applied?: boolean
          client_id: string
          counter_food_id?: string | null
          counter_grams?: number | null
          counter_label?: string | null
          counter_recipe_id?: string | null
          counter_servings?: number | null
          created_at?: string
          day: number
          effective_from?: string | null
          id?: string
          item_id?: string | null
          meal?: string | null
          meal_id?: string | null
          meal_name?: string | null
          nutritionist_id: string
          option_group?: number | null
          original_food_id?: string | null
          original_label: string
          original_recipe_id?: string | null
          plan_id: string
          reason?: string
          requested_food_id?: string | null
          requested_grams?: number | null
          requested_label?: string | null
          requested_recipe_id?: string | null
          requested_servings?: number | null
          resolved_at?: string | null
          response_note?: string
          status?: string
          version_id?: string | null
        }
        Update: {
          applied?: boolean
          client_id?: string
          counter_food_id?: string | null
          counter_grams?: number | null
          counter_label?: string | null
          counter_recipe_id?: string | null
          counter_servings?: number | null
          created_at?: string
          day?: number
          effective_from?: string | null
          id?: string
          item_id?: string | null
          meal?: string | null
          meal_id?: string | null
          meal_name?: string | null
          nutritionist_id?: string
          option_group?: number | null
          original_food_id?: string | null
          original_label?: string
          original_recipe_id?: string | null
          plan_id?: string
          reason?: string
          requested_food_id?: string | null
          requested_grams?: number | null
          requested_label?: string | null
          requested_recipe_id?: string | null
          requested_servings?: number | null
          resolved_at?: string | null
          response_note?: string
          status?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_swap_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_counter_food_id_fkey"
            columns: ["counter_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_counter_recipe_id_fkey"
            columns: ["counter_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_requested_food_id_fkey"
            columns: ["requested_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_requested_recipe_id_fkey"
            columns: ["requested_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_swap_requests_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          carbs: number
          category: string
          created_at: string
          fat: number
          fiber: number
          id: string
          kcal: number
          measures: Json
          name: string
          nutrients: Json
          owner_id: string | null
          protein: number
          sodium: number | null
          taco_id: number | null
          updated_at: string
        }
        Insert: {
          carbs?: number
          category?: string
          created_at?: string
          fat?: number
          fiber?: number
          id?: string
          kcal?: number
          measures?: Json
          name: string
          nutrients?: Json
          owner_id?: string | null
          protein?: number
          sodium?: number | null
          taco_id?: number | null
          updated_at?: string
        }
        Update: {
          carbs?: number
          category?: string
          created_at?: string
          fat?: number
          fiber?: number
          id?: string
          kcal?: number
          measures?: Json
          name?: string
          nutrients?: Json
          owner_id?: string | null
          protein?: number
          sodium?: number | null
          taco_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_checks: {
        Row: {
          check_date: string
          chosen: Json
          client_id: string
          created_at: string
          id: string
          meal: string | null
          meal_id: string
          meal_name: string | null
          note: string
          plan_id: string
          status: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          check_date: string
          chosen?: Json
          client_id: string
          created_at?: string
          id?: string
          meal?: string | null
          meal_id: string
          meal_name?: string | null
          note?: string
          plan_id: string
          status: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          check_date?: string
          chosen?: Json
          client_id?: string
          created_at?: string
          id?: string
          meal?: string | null
          meal_id?: string
          meal_name?: string | null
          note?: string
          plan_id?: string
          status?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_checks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_checks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_checks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_items: {
        Row: {
          created_at: string
          day: number
          food_id: string | null
          grams: number | null
          id: string
          meal: string | null
          meal_id: string
          measure_label: string | null
          note: string
          option_group: number | null
          plan_id: string
          position: number
          recipe_id: string | null
          servings: number
        }
        Insert: {
          created_at?: string
          day: number
          food_id?: string | null
          grams?: number | null
          id?: string
          meal?: string | null
          meal_id: string
          measure_label?: string | null
          note?: string
          option_group?: number | null
          plan_id: string
          position?: number
          recipe_id?: string | null
          servings?: number
        }
        Update: {
          created_at?: string
          day?: number
          food_id?: string | null
          grams?: number | null
          id?: string
          meal?: string | null
          meal_id?: string
          measure_label?: string | null
          note?: string
          option_group?: number | null
          plan_id?: string
          position?: number
          recipe_id?: string | null
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_meal_fkey"
            columns: ["plan_id", "meal_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_meals"
            referencedColumns: ["plan_id", "id"]
          },
          {
            foreignKeyName: "meal_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_meals: {
        Row: {
          category: string | null
          created_at: string
          day_overrides: Json
          days: number[]
          guidance: string
          id: string
          kcal_share: number | null
          name: string
          plan_id: string
          position: number
          time_of_day: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          day_overrides?: Json
          days?: number[]
          guidance?: string
          id?: string
          kcal_share?: number | null
          name: string
          plan_id: string
          position?: number
          time_of_day?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          day_overrides?: Json
          days?: number[]
          guidance?: string
          id?: string
          kcal_share?: number | null
          name?: string
          plan_id?: string
          position?: number
          time_of_day?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_meals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_templates: {
        Row: {
          created_at: string
          id: string
          items: Json
          meals: Json
          notes: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          meals?: Json
          notes?: string
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          meals?: Json
          notes?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_versions: {
        Row: {
          client_id: string
          content: Json
          id: string
          legacy: boolean
          number: number
          plan_id: string
          plan_revision: number
          published_at: string
          published_by: string | null
          valid_from: string
        }
        Insert: {
          client_id: string
          content: Json
          id?: string
          legacy?: boolean
          number: number
          plan_id: string
          plan_revision: number
          published_at?: string
          published_by?: string | null
          valid_from: string
        }
        Update: {
          client_id?: string
          content?: Json
          id?: string
          legacy?: boolean
          number?: number
          plan_id?: string
          plan_revision?: number
          published_at?: string
          published_by?: string | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_versions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          id: string
          notes: string
          published_revision: number
          revision: number
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string
          published_revision?: number
          revision?: number
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string
          published_revision?: number
          revision?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: string
          pushed_at: string | null
          read_at: string | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          kind: string
          pushed_at?: string | null
          read_at?: string | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          pushed_at?: string | null
          read_at?: string | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_goals: {
        Row: {
          active_goals: string[] | null
          calories: number | null
          carbs: number | null
          created_at: string | null
          fat: number | null
          fiber: number | null
          id: string
          protein: number | null
          set_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_goals?: string[] | null
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          fat?: number | null
          fiber?: number | null
          id?: string
          protein?: number | null
          set_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_goals?: string[] | null
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          fat?: number | null
          fiber?: number | null
          id?: string
          protein?: number | null
          set_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_goals_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_log_entries: {
        Row: {
          created_at: string | null
          entry_date: string
          id: string
          meal: string | null
          meal_id: string | null
          meal_name: string | null
          per_serving: Json
          plan_check_id: string | null
          recipe_id: string | null
          recipe_title: string
          servings: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_date: string
          id?: string
          meal?: string | null
          meal_id?: string | null
          meal_name?: string | null
          per_serving?: Json
          plan_check_id?: string | null
          recipe_id?: string | null
          recipe_title: string
          servings?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_date?: string
          id?: string
          meal?: string | null
          meal_id?: string | null
          meal_name?: string | null
          per_serving?: Json
          plan_check_id?: string | null
          recipe_id?: string | null
          recipe_title?: string
          servings?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_log_entries_plan_check_id_fkey"
            columns: ["plan_check_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_log_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_log_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutritionist_clients: {
        Row: {
          client_id: string
          consent_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          nutritionist_id: string
          status: string
        }
        Insert: {
          client_id: string
          consent_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          nutritionist_id: string
          status?: string
        }
        Update: {
          client_id?: string
          consent_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          nutritionist_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutritionist_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutritionist_clients_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutritionist_invites: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          nutritionist_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          nutritionist_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          nutritionist_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutritionist_invites_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutritionist_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutritionist_verifications: {
        Row: {
          card_path: string
          created_at: string
          crn_number: string
          crn_region: number
          full_name: string
          reject_reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string
          status: string
          user_id: string
        }
        Insert: {
          card_path: string
          created_at?: string
          crn_number: string
          crn_region: number
          full_name: string
          reject_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path: string
          status?: string
          user_id: string
        }
        Update: {
          card_path?: string
          created_at?: string
          crn_number?: string
          crn_region?: number
          full_name?: string
          reject_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutritionist_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutritionist_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepting_new_clients: boolean | null
          accepts_health_insurance: boolean | null
          approach: string | null
          avatar_url: string | null
          bio: string | null
          certifications: string[] | null
          clinic_address: string | null
          consultation_duration: number | null
          consultation_price: number | null
          consultation_types: Json | null
          created_at: string | null
          crn_number: string | null
          crn_region: number | null
          crn_status: string
          education: string | null
          email: string
          full_name: string
          health_insurances: string[] | null
          id: string
          instagram: string | null
          is_demo: boolean
          phone: string | null
          professional_bio: string | null
          profile_visibility: string | null
          specializations: string[] | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_type: string
          website: string | null
          whatsapp: string | null
          years_of_experience: number | null
        }
        Insert: {
          accepting_new_clients?: boolean | null
          accepts_health_insurance?: boolean | null
          approach?: string | null
          avatar_url?: string | null
          bio?: string | null
          certifications?: string[] | null
          clinic_address?: string | null
          consultation_duration?: number | null
          consultation_price?: number | null
          consultation_types?: Json | null
          created_at?: string | null
          crn_number?: string | null
          crn_region?: number | null
          crn_status?: string
          education?: string | null
          email: string
          full_name: string
          health_insurances?: string[] | null
          id: string
          instagram?: string | null
          is_demo?: boolean
          phone?: string | null
          professional_bio?: string | null
          profile_visibility?: string | null
          specializations?: string[] | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_type: string
          website?: string | null
          whatsapp?: string | null
          years_of_experience?: number | null
        }
        Update: {
          accepting_new_clients?: boolean | null
          accepts_health_insurance?: boolean | null
          approach?: string | null
          avatar_url?: string | null
          bio?: string | null
          certifications?: string[] | null
          clinic_address?: string | null
          consultation_duration?: number | null
          consultation_price?: number | null
          consultation_types?: Json | null
          created_at?: string | null
          crn_number?: string | null
          crn_region?: number | null
          crn_status?: string
          education?: string | null
          email?: string
          full_name?: string
          health_insurances?: string[] | null
          id?: string
          instagram?: string | null
          is_demo?: boolean
          phone?: string | null
          professional_bio?: string | null
          profile_visibility?: string | null
          specializations?: string[] | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_type?: string
          website?: string | null
          whatsapp?: string | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          excluded: boolean
          food_id: string | null
          grams: number | null
          id: string
          line_nutrients: Json | null
          measure_label: string | null
          note: string
          position: number
          quantity: number | null
          recipe_id: string
          text: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          excluded?: boolean
          food_id?: string | null
          grams?: number | null
          id?: string
          line_nutrients?: Json | null
          measure_label?: string | null
          note?: string
          position: number
          quantity?: number | null
          recipe_id: string
          text: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          excluded?: boolean
          food_id?: string | null
          grams?: number | null
          id?: string
          line_nutrients?: Json | null
          measure_label?: string | null
          note?: string
          position?: number
          quantity?: number | null
          recipe_id?: string
          text?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          author_id: string
          category: string
          created_at: string | null
          description: string
          difficulty: string
          final_weight_g: number | null
          hidden_at: string | null
          id: string
          image: string
          ingredients: Json
          instructions: Json
          meal_types: string[]
          nutrition_basis: string
          nutrition_declared: Json
          nutrition_facts: Json
          nutrition_needs_review: boolean
          nutrition_reviewed_at: string | null
          nutrition_reviewed_by: string | null
          nutrition_source: string
          nutrition_status: string
          premium_only: boolean
          prep_time: number
          rating: number | null
          recipe_version: number
          review_count: number
          serving_label: string
          serving_weight_g: number | null
          title: string
          updated_at: string | null
          yield_servings: number | null
        }
        Insert: {
          author_id: string
          category: string
          created_at?: string | null
          description: string
          difficulty: string
          final_weight_g?: number | null
          hidden_at?: string | null
          id?: string
          image: string
          ingredients: Json
          instructions: Json
          meal_types?: string[]
          nutrition_basis?: string
          nutrition_declared?: Json
          nutrition_facts: Json
          nutrition_needs_review?: boolean
          nutrition_reviewed_at?: string | null
          nutrition_reviewed_by?: string | null
          nutrition_source?: string
          nutrition_status?: string
          premium_only?: boolean
          prep_time: number
          rating?: number | null
          recipe_version?: number
          review_count?: number
          serving_label?: string
          serving_weight_g?: number | null
          title: string
          updated_at?: string | null
          yield_servings?: number | null
        }
        Update: {
          author_id?: string
          category?: string
          created_at?: string | null
          description?: string
          difficulty?: string
          final_weight_g?: number | null
          hidden_at?: string | null
          id?: string
          image?: string
          ingredients?: Json
          instructions?: Json
          meal_types?: string[]
          nutrition_basis?: string
          nutrition_declared?: Json
          nutrition_facts?: Json
          nutrition_needs_review?: boolean
          nutrition_reviewed_at?: string | null
          nutrition_reviewed_by?: string | null
          nutrition_source?: string
          nutrition_status?: string
          premium_only?: boolean
          prep_time?: number
          rating?: number | null
          recipe_version?: number
          review_count?: number
          serving_label?: string
          serving_weight_g?: number | null
          title?: string
          updated_at?: string | null
          yield_servings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          recipe_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          recipe_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          recipe_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string | null
          currency: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_period?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_period?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          payment_method: string | null
          plan_id: string
          started_at: string | null
          status: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          plan_id: string
          started_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          plan_id?: string
          started_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
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
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          created_at: string | null
          id: string
          logged_on: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          logged_on?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string | null
          id?: string
          logged_on?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_broadcast: {
        Args: { p_audience: string; p_body: string; p_title: string }
        Returns: number
      }
      admin_delete_review: { Args: { p_review: string }; Returns: undefined }
      admin_errors: {
        Args: { p_days?: number }
        Returns: {
          last_at: string
          message: string
          stack: string
          total: number
          url: string
          users: number
        }[]
      }
      admin_grant_premium: {
        Args: { p_plan: string; p_until: string; p_user: string }
        Returns: undefined
      }
      admin_recipes: {
        Args: { p_query?: string }
        Returns: {
          author_name: string
          created_at: string
          hidden_at: string
          id: string
          premium_only: boolean
          rating: number
          reviews: number
          title: string
        }[]
      }
      admin_reviews: {
        Args: { p_recipe: string }
        Returns: {
          comment: string
          created_at: string
          id: string
          rating: number
          user_name: string
        }[]
      }
      admin_revoke_premium: { Args: { p_user: string }; Returns: undefined }
      admin_run_reminders: { Args: never; Returns: number }
      admin_seed_demo: {
        Args: { p_admin: string; p_nutri: string; p_patient: string }
        Returns: undefined
      }
      admin_set_crn: {
        Args: { p_status: string; p_user: string }
        Returns: undefined
      }
      admin_set_plan: {
        Args: {
          p_active: boolean
          p_plan: string
          p_price: number
          p_stripe_price: string
        }
        Returns: undefined
      }
      admin_set_recipe_hidden: {
        Args: { p_hidden: boolean; p_recipe: string }
        Returns: undefined
      }
      admin_set_recipe_premium: {
        Args: { p_premium: boolean; p_recipe: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      admin_test_push: { Args: never; Returns: undefined }
      admin_users: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          banned_until: string
          courtesy: boolean
          created_at: string
          crn_status: string
          email: string
          expires_at: string
          full_name: string
          id: string
          is_demo: boolean
          last_sign_in_at: string
          plan_name: string
          sub_status: string
          user_type: string
        }[]
      }
      ai_access: { Args: { p_user: string }; Returns: Json }
      ai_link_active: {
        Args: { p_client: string; p_nutritionist: string }
        Returns: boolean
      }
      app_min_client: { Args: never; Returns: number }
      app_today: { Args: never; Returns: string }
      apply_swap_to_plan: {
        Args: {
          p_food: string
          p_grams: number
          p_label: string
          p_recipe: string
          p_request: Database["public"]["Tables"]["food_swap_requests"]["Row"]
          p_servings: number
        }
        Returns: boolean
      }
      appointment_data: {
        Args: {
          p: Database["public"]["Tables"]["appointments"]["Row"]
          p_other: string
        }
        Returns: Json
      }
      assert_admin: { Args: never; Returns: undefined }
      can_edit_meal_plan: { Args: { p_plan: string }; Returns: boolean }
      can_start_ai: { Args: { p_nutritionist: string }; Returns: boolean }
      can_view_meal_plan: { Args: { p_plan: string }; Returns: boolean }
      cancel_appointment: { Args: { p_id: string }; Returns: undefined }
      cancel_food_swap: { Args: { p_request: string }; Returns: undefined }
      claim_push: {
        Args: { p_notification: string }
        Returns: {
          created_at: string
          data: Json
          id: string
          kind: string
          pushed_at: string | null
          read_at: string | null
          ref_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clean_day_overrides: { Args: { p: Json }; Returns: Json }
      cleanup_demo_visitors: { Args: never; Returns: number }
      consume_ai_quota: {
        Args: {
          p_kind: string
          p_per_day: number
          p_per_hour: number
          p_user: string
        }
        Returns: boolean
      }
      consume_demo_ai: {
        Args: { p_limit: number; p_user: string }
        Returns: boolean
      }
      create_nutritionist_invite: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expires_at: string
          nutritionist_id: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "nutritionist_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      default_meal_name: { Args: { p_category: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      delete_my_archived_plans: { Args: never; Returns: number }
      free_patient_limit: { Args: never; Returns: number }
      has_feature: {
        Args: { p_feature: string; p_user: string }
        Returns: boolean
      }
      ingredient_nutrients: {
        Args: { p_food: string; p_grams: number }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_demo_visitor: { Args: { p_user?: string }; Returns: boolean }
      is_my_nutritionist: { Args: { p_nutritionist: string }; Returns: boolean }
      is_my_patient: { Args: { p_client: string }; Returns: boolean }
      legacy_meal_id: {
        Args: { p_category: string; p_plan: string }
        Returns: string
      }
      mark_messages_read: {
        Args: { p_client: string; p_nutritionist: string }
        Returns: undefined
      }
      my_archived_plans: { Args: never; Returns: number }
      my_premium: { Args: never; Returns: Json }
      my_progress: { Args: never; Returns: Json }
      notify: {
        Args: { p_data: Json; p_kind: string; p_ref: string; p_user: string }
        Returns: undefined
      }
      op_begin: {
        Args: { p_id: string; p_kind: string; p_payload: Json }
        Returns: Json
      }
      op_finish: { Args: { p_id: string; p_result: Json }; Returns: Json }
      patient_limit_reached: {
        Args: { p_nutritionist: string }
        Returns: boolean
      }
      patients_attention: {
        Args: never
        Returns: {
          client_id: string
          full_name: string
          last_check: string
          last_log: string
          pending_swaps: number
          unread_messages: number
        }[]
      }
      patients_overview: {
        Args: never
        Returns: {
          client_id: string
          days7: number
          goal_kcal: number
          kcal7: number
          last_check: string
          last_log: string
          pending_swaps: number
          unread_messages: number
        }[]
      }
      plan_day_of: { Args: { p_date: string }; Returns: number }
      plan_snapshot: { Args: { p_plan: string }; Returns: Json }
      plan_version_on: {
        Args: { p_date: string; p_plan: string }
        Returns: string
      }
      plan_views: { Args: { p_client: string }; Returns: Json }
      premium_content: { Args: never; Returns: boolean }
      premium_recipe_teasers: {
        Args: never
        Returns: {
          calories: number
          category: string
          id: string
          image: string
          prep_time: number
          title: string
        }[]
      }
      pro_nutritionist_ids: { Args: never; Returns: string[] }
      profile_name: { Args: { p_id: string }; Returns: string }
      publish_plan: {
        Args: {
          p_expected_revision: number
          p_operation: string
          p_plan: string
        }
        Returns: Json
      }
      publish_plan_internal: { Args: { p_plan: string }; Returns: Json }
      recipe_author_stats: {
        Args: never
        Returns: {
          diary_logs: number
          favorites: number
          in_plans: number
          recipe_id: string
        }[]
      }
      recipe_clean_nutrients: {
        Args: { p_raw: Json; p_strict?: boolean }
        Returns: Json
      }
      recipe_ingredients_from_lines: {
        Args: { p_lines: Json; p_recipe: string }
        Returns: undefined
      }
      recipe_per_serving: {
        Args: { p_basis: string; p_declared: Json; p_yield: number }
        Returns: Json
      }
      record_care_event: {
        Args: {
          p_client: string
          p_dedupe: string
          p_entity: string
          p_kind: string
          p_nutritionist: string
          p_summary: Json
          p_version: number
        }
        Returns: undefined
      }
      record_meal_check: {
        Args: {
          p_date: string
          p_items: Json
          p_meal: string
          p_note: string
          p_operation: string
          p_plan: string
          p_status: string
        }
        Returns: Json
      }
      redeem_nutritionist_invite: { Args: { p_code: string }; Returns: string }
      remove_plan_items_of: {
        Args: { p_food: string; p_label: string; p_recipe: string }
        Returns: undefined
      }
      request_food_swap: {
        Args: {
          p_day: number
          p_item?: string
          p_meal: string
          p_option_group: number
          p_original_food: string
          p_original_label: string
          p_original_recipe: string
          p_plan: string
          p_reason: string
          p_requested_food: string
          p_requested_grams: number
          p_requested_label: string
          p_requested_recipe: string
          p_requested_servings: number
        }
        Returns: string
      }
      resolve_food_swap: {
        Args: {
          p_approve: boolean
          p_counter_food: string
          p_counter_grams: number
          p_counter_label: string
          p_counter_recipe: string
          p_counter_servings: number
          p_note: string
          p_request: string
        }
        Returns: boolean
      }
      review_crn_verification: {
        Args: { p_approve: boolean; p_reason: string; p_user: string }
        Returns: undefined
      }
      save_appointment: {
        Args: {
          p_client: string
          p_duration_min: number
          p_id: string
          p_location: string
          p_mode: string
          p_notes: string
          p_starts_at: string
        }
        Returns: string
      }
      save_meal_check: {
        Args: {
          p_chosen?: Json
          p_date: string
          p_entries?: Json
          p_meal: string
          p_note?: string
          p_plan: string
          p_status: string
        }
        Returns: {
          check_date: string
          chosen: Json
          client_id: string
          created_at: string
          id: string
          meal: string | null
          meal_id: string
          meal_name: string | null
          note: string
          plan_id: string
          status: string
          updated_at: string
          version_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "meal_plan_checks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_meal_plan: {
        Args: {
          p_client: string
          p_items: Json
          p_notes: string
          p_plan: string
          p_title: string
        }
        Returns: string
      }
      save_plan_draft: {
        Args: {
          p_client: string
          p_expected_revision: number
          p_items: Json
          p_meals?: Json
          p_notes: string
          p_operation: string
          p_plan: string
          p_publish: boolean
          p_title: string
        }
        Returns: Json
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: undefined
      }
      save_recipe: {
        Args: {
          p_data: Json
          p_ingredients: Json
          p_operation?: string
          p_recipe: string
        }
        Returns: Json
      }
      search_key: { Args: { p_text: string }; Returns: string }
      search_match: {
        Args: { p_haystack: string; p_query: string }
        Returns: boolean
      }
      search_recipes: {
        Args: {
          p_category?: string
          p_difficulty?: string
          p_min_rating?: number
          p_prep?: string
          p_query?: string
        }
        Returns: {
          author_id: string
          category: string
          created_at: string | null
          description: string
          difficulty: string
          final_weight_g: number | null
          hidden_at: string | null
          id: string
          image: string
          ingredients: Json
          instructions: Json
          meal_types: string[]
          nutrition_basis: string
          nutrition_declared: Json
          nutrition_facts: Json
          nutrition_needs_review: boolean
          nutrition_reviewed_at: string | null
          nutrition_reviewed_by: string | null
          nutrition_source: string
          nutrition_status: string
          premium_only: boolean
          prep_time: number
          rating: number | null
          recipe_version: number
          review_count: number
          serving_label: string
          serving_weight_g: number | null
          title: string
          updated_at: string | null
          yield_servings: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seed_demo_data: {
        Args: { p_nutri: string; p_patient: string }
        Returns: undefined
      }
      select_active_plan: { Args: { p_plan: string }; Returns: undefined }
      send_appointment_reminders: { Args: never; Returns: number }
      submit_crn_verification: {
        Args: {
          p_card_path: string
          p_crn_number: string
          p_crn_region: number
          p_full_name: string
          p_selfie_path: string
        }
        Returns: undefined
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
