type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          type: 'nutritionist' | 'client'
          profile: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          type: 'nutritionist' | 'client'
          profile?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          type?: 'nutritionist' | 'client'
          profile?: Json
          created_at?: string
          updated_at?: string
        }
      }
      recipes: {
        Row: {
          id: string
          title: string
          description: string
          image: string
          prep_time: number
          difficulty: 'easy' | 'medium' | 'hard'
          category: string
          ingredients: string[]
          instructions: string[]
          nutrition_facts: Json
          author_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          image: string
          prep_time: number
          difficulty: 'easy' | 'medium' | 'hard'
          category: string
          ingredients: string[]
          instructions: string[]
          nutrition_facts: Json
          author_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          image?: string
          prep_time?: number
          difficulty?: 'easy' | 'medium' | 'hard'
          category?: string
          ingredients?: string[]
          instructions?: string[]
          nutrition_facts?: Json
          author_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          recipe_id: string
          user_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipe_id: string
          user_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipe_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      favorites: {
        Row: {
          user_id: string
          recipe_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          recipe_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          recipe_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}