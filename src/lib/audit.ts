import { supabase } from "@/integrations/supabase/client";

export async function getActorLabel(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return user?.email ?? user?.id ?? "unknown";
}

export async function insertAuditLog(args: {
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  sourceRef?: Record<string, unknown>;
}) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("Não autenticado");

  const payload = {
    user_id: user.id,
    entity_type: args.entityType,
    entity_id: args.entityId,
    field_name: args.fieldName,
    old_value: (args.oldValue === undefined ? null : args.oldValue) as import("@/integrations/supabase/types").Json,
    new_value: (args.newValue === undefined ? null : args.newValue) as import("@/integrations/supabase/types").Json,
    source_ref: (args.sourceRef ?? {}) as import("@/integrations/supabase/types").Json,
  };

  const { error } = await supabase.from("audit_log").insert([payload]);
  if (error) throw error;
}
