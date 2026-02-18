
# Refatorar `saveFieldMutation` para usar `auditLog.ts` centralizado

## Objetivo
Substituir a lógica inline de auditoria e resolução de pendencias no `saveFieldMutation` pelo uso das funções centralizadas `getActorLabel` e `insertAuditLog` de `src/lib/auditLog.ts`.

## Alteracoes em `src/components/RevisaoTab.tsx`

### 1. Ajustar import
- Adicionar: `import { getActorLabel, insertAuditLog } from "@/lib/auditLog";`

### 2. Refatorar `saveFieldMutation.mutationFn` (linhas 122-151)
Substituir o corpo atual por:

- Chamar `getActorLabel()` para obter o label do ator
- Fazer o `update` na tabela `quotes`
- Chamar `insertAuditLog()` com `entityType: "quote"`, passando `oldValue`, `newValue` e `sourceRef: { from: "revisao_tab" }`
- Buscar a quote atualizada para verificar resolucao automatica na `review_queue`
- Usar o `actor` retornado por `getActorLabel()` no campo `resolved_by` (em vez do hardcoded `"user"`)

### 3. Remover codigo redundante
- Remover a chamada direta a `supabase.auth.getUser()` dentro do `saveFieldMutation` (a autenticacao sera verificada dentro de `insertAuditLog`)
- Remover o `insert` manual na `audit_log`

## Detalhes tecnicos

Corpo refatorado do `mutationFn`:

```typescript
mutationFn: async ({ quoteId, field, value, oldValue }) => {
  const actor = await getActorLabel();

  const { error } = await supabase.from("quotes").update({ [field]: value }).eq("id", quoteId);
  if (error) throw error;

  await insertAuditLog({
    entityType: "quote",
    entityId: quoteId,
    fieldName: field,
    oldValue,
    newValue: value,
    sourceRef: { from: "revisao_tab" },
  });

  const { data: updatedQuote } = await supabase
    .from("quotes")
    .select("id, lead_time_days, shipping_terms, shipping_cost, minimum_order_value, minimum_order_qty")
    .eq("id", quoteId)
    .single();

  if (updatedQuote) {
    for (const [reason, check] of Object.entries(REASON_MAP)) {
      if (check(updatedQuote)) {
        await supabase
          .from("review_queue")
          .update({ resolved_at: new Date().toISOString(), resolved_by: actor })
          .eq("entity_id", quoteId)
          .eq("entity_type", "quote")
          .eq("reason", reason)
          .is("resolved_at", null);
      }
    }
  }
},
```

Nenhuma outra alteracao de arquivo e necessaria.
