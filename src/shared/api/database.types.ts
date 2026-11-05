
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "objects": {
                  Row: {
                    "address": string,"created_at": string,"created_by": string,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "objects_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"task_field_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"field": Database["public"]['Enums']["task_field"],"id": number,"new_value": string | null,"old_value": string | null,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"field": Database["public"]['Enums']["task_field"],"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"task_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"field"?: Database["public"]['Enums']["task_field"],"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_field_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_field_history_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_status_history": {
                  Row: {
                    "changed_at": string,"changed_by": string,"comment": string | null,"from_status": Database["public"]['Enums']["task_status"] | null,"id": number,"task_id": string,"to_status": Database["public"]['Enums']["task_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by": string,"comment"?: string | null,"from_status"?: Database["public"]['Enums']["task_status"] | null,"id"?: never,"task_id": string,"to_status": Database["public"]['Enums']["task_status"]
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string,"comment"?: string | null,"from_status"?: Database["public"]['Enums']["task_status"] | null,"id"?: never,"task_id"?: string,"to_status"?: Database["public"]['Enums']["task_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_status_history_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string,"author_id": string,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"description": string,"id": string,"object_id": string,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id": string,"author_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string,"id"?: string,"object_id": string,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string,"author_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string,"id"?: string,"object_id"?: string,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_object_id_fkey"
      columns: ["object_id"]
isOneToOne: false
      referencedRelation: "objects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "change_task_status":
{ Args: { "p_comment"?: string,"p_task_id": string,"p_to_status": Database["public"]['Enums']["task_status"] }; Returns: {
              "assignee_id": string,
"author_id": string,
"created_at": string,
"deleted_at": string | null,
"deleted_by": string | null,
"description": string,
"id": string,
"object_id": string,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"list_deleted_objects":
{ Args: Record<PropertyKey, never>; Returns: {
              "address": string,"deleted_at": string,"deleted_by_name": string,"id": string,"name": string
            }[]
                           },
"list_deleted_tasks":
{ Args: Record<PropertyKey, never>; Returns: {
              "deleted_at": string,"deleted_by_name": string,"id": string,"object_deleted": boolean,"object_id": string,"object_name": string,"title": string
            }[]
                           },
"restore_object":
{ Args: { "p_object_id": string }; Returns: undefined
                           },
"restore_task":
{ Args: { "p_task_id": string }; Returns: undefined
                           },
"soft_delete_object":
{ Args: { "p_object_id": string }; Returns: undefined
                           },
"soft_delete_task":
{ Args: { "p_task_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "task_field": "title"|"description"|"assignee_id"|"deleted_at","task_status": "new"|"in_progress"|"on_review"|"accepted"|"rework","user_role": "manager"|"executor"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "task_field": ["title", "description", "assignee_id", "deleted_at"],"task_status": ["new", "in_progress", "on_review", "accepted", "rework"],"user_role": ["manager", "executor"]
          }
        }
} as const
