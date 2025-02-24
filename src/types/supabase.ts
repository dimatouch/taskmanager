export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      task_statuses: {
        Row: {
          id: string
          name: string
          color: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          position: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          position?: number
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status_id: string
          position: number
          assignee_id: string | null
          due_date: string | null
          project_id: string | null
          owner_id: string
          created_at: string
          updated_at: string
          priority: number
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status_id: string
          position: number
          assignee_id?: string | null
          due_date?: string | null
          project_id?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
          priority?: number
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status_id?: string
          position?: number
          assignee_id?: string | null
          due_date?: string | null
          project_id?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
          priority?: number
        }
      },
      task_assignees: {
        Row: {
          task_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          task_id?: string
          user_id?: string
          created_at?: string
        }
      }
    }
  }
}