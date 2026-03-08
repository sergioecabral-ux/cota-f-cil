import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados estruturados de cotações de fornecedores.
Dado o conteúdo de uma cotação (texto, imagem ou PDF), extraia as seguintes informações usando a tool fornecida.
Se um campo não estiver disponível, use null.
Para preços, use números decimais (ex: 12.50). Para quantidades, use números.
O campo "unit" deve ser a unidade de medida (kg, un, cx, lt, m, etc).`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Parse request
    const { evidence_id } = await req.json();
    if (!evidence_id) {
      return new Response(JSON.stringify({ error: "evidence_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch evidence
    const { data: evidence, error: evError } = await supabase
      .from("evidence")
      .select("*")
      .eq("id", evidence_id)
      .single();

    if (evError || !evidence) {
      return new Response(JSON.stringify({ error: "Evidence not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await supabase
      .from("evidence")
      .update({ processing_status: "processing" })
      .eq("id", evidence_id);

    // Build AI message content
    const userContent: any[] = [];

    if (evidence.kind === "text" && evidence.text_content) {
      userContent.push({
        type: "text",
        text: `Conteúdo da cotação (texto colado):\n\n${evidence.text_content}`,
      });
    } else if (evidence.storage_path) {
      // Get signed URL for the file
      const { data: signedUrl } = await supabase.storage
        .from("evidence_vault")
        .createSignedUrl(evidence.storage_path, 600);

      if (!signedUrl?.signedUrl) {
        throw new Error("Could not generate signed URL for evidence file");
      }

      if (evidence.kind === "pdf") {
        // For PDF, download and send as text description
        userContent.push({
          type: "text",
          text: `Analise o documento PDF desta cotação disponível na URL a seguir e extraia os dados estruturados.`,
        });
        userContent.push({
          type: "image_url",
          image_url: { url: signedUrl.signedUrl },
        });
      } else {
        // Image
        userContent.push({
          type: "text",
          text: "Analise esta imagem de cotação e extraia os dados estruturados:",
        });
        userContent.push({
          type: "image_url",
          image_url: { url: signedUrl.signedUrl },
        });
      }
    } else {
      throw new Error("Evidence has no content to process");
    }

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_quote",
              description:
                "Extract structured quote data from a supplier quotation document",
              parameters: {
                type: "object",
                properties: {
                  supplier_name: {
                    type: "string",
                    description: "Nome do fornecedor",
                  },
                  payment_terms: {
                    type: "string",
                    description: "Condições de pagamento (ex: 30/60/90 dias)",
                  },
                  lead_time_days: {
                    type: "integer",
                    description: "Prazo de entrega em dias",
                  },
                  shipping_terms: {
                    type: "string",
                    description: "Condições de frete (CIF, FOB, etc)",
                  },
                  shipping_cost: {
                    type: "number",
                    description: "Custo de frete",
                  },
                  validity_days: {
                    type: "integer",
                    description: "Validade da proposta em dias",
                  },
                  minimum_order_value: {
                    type: "number",
                    description: "Valor mínimo do pedido",
                  },
                  minimum_order_qty: {
                    type: "number",
                    description: "Quantidade mínima do pedido",
                  },
                  items: {
                    type: "array",
                    description: "Lista de itens da cotação",
                    items: {
                      type: "object",
                      properties: {
                        description_supplier: {
                          type: "string",
                          description: "Descrição do produto conforme o fornecedor",
                        },
                        qty: {
                          type: "number",
                          description: "Quantidade",
                        },
                        unit: {
                          type: "string",
                          description: "Unidade de medida (kg, un, cx, lt, m, etc)",
                        },
                        unit_price: {
                          type: "number",
                          description: "Preço unitário",
                        },
                        total_price: {
                          type: "number",
                          description: "Preço total do item",
                        },
                      },
                      required: ["description_supplier"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["supplier_name", "items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "extract_quote" },
        },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        await supabase
          .from("evidence")
          .update({ processing_status: "error", processing_error: "Rate limit exceeded" })
          .eq("id", evidence_id);
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        await supabase
          .from("evidence")
          .update({ processing_status: "error", processing_error: "Payment required" })
          .eq("id", evidence_id);
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured data");
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("Extracted data:", JSON.stringify(extracted));

    // Find or create supplier
    let supplierId = evidence.supplier_id;

    if (!supplierId && extracted.supplier_name) {
      // Check if supplier already exists
      const { data: existingSupplier } = await supabase
        .from("suppliers")
        .select("id")
        .eq("name_raw", extracted.supplier_name)
        .maybeSingle();

      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        const { data: newSupplier, error: supplierErr } = await supabase
          .from("suppliers")
          .insert({
            user_id: userId,
            name_raw: extracted.supplier_name,
            name_canonical: extracted.supplier_name,
            status_review: true,
          })
          .select("id")
          .single();

        if (supplierErr) {
          console.error("Error creating supplier:", supplierErr);
          throw new Error("Failed to create supplier");
        }
        supplierId = newSupplier.id;
      }

      // Link supplier to evidence
      await supabase
        .from("evidence")
        .update({ supplier_id: supplierId })
        .eq("id", evidence_id);
    }

    if (!supplierId) {
      throw new Error("Could not determine supplier");
    }

    // Create quote
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .insert({
        user_id: userId,
        event_id: evidence.event_id,
        supplier_id: supplierId,
        evidence_id: evidence_id,
        display_name: `Cotação IA - ${extracted.supplier_name || "Fornecedor"}`,
        lead_time_days: extracted.lead_time_days ?? null,
        shipping_terms: extracted.shipping_terms ?? null,
        shipping_cost: extracted.shipping_cost ?? null,
        minimum_order_value: extracted.minimum_order_value ?? null,
        minimum_order_qty: extracted.minimum_order_qty ?? null,
        payment_terms: extracted.payment_terms ?? null,
        validity_days: extracted.validity_days ?? null,
        confidence_overall: 0.7,
        needs_review: true,
        source_ref: { origin: "ai-extraction", model: "gemini-2.5-flash" },
      })
      .select("id")
      .single();

    if (quoteErr || !quote) {
      console.error("Error creating quote:", quoteErr);
      throw new Error("Failed to create quote");
    }

    // Create quote items
    const items = (extracted.items || []).map((item: any) => ({
      user_id: userId,
      quote_id: quote.id,
      description_supplier: item.description_supplier || "Sem descrição",
      qty: item.qty ?? null,
      unit: item.unit ?? null,
      unit_price: item.unit_price ?? null,
      total_price: item.total_price ?? null,
      needs_review: true,
      confidence: { source: "ai-extraction" },
      source_ref: { origin: "ai-extraction" },
    }));

    if (items.length > 0) {
      const { error: itemsErr } = await supabase
        .from("quote_items")
        .insert(items);

      if (itemsErr) {
        console.error("Error creating quote items:", itemsErr);
        throw new Error("Failed to create quote items");
      }
    }

    // Create review_queue entries
    const reviewItems = [
      { reason: "Prazo de entrega extraído por IA", severity: "medium" },
      { reason: "Frete extraído por IA", severity: "medium" },
      { reason: "Pedido mínimo extraído por IA", severity: "low" },
    ].map((r) => ({
      user_id: userId,
      event_id: evidence.event_id,
      entity_id: quote.id,
      entity_type: "quote",
      severity: r.severity,
      reason: r.reason,
    }));

    await supabase.from("review_queue").insert(reviewItems);

    // Mark evidence as done
    await supabase
      .from("evidence")
      .update({ processing_status: "done", processing_error: null })
      .eq("id", evidence_id);

    return new Response(
      JSON.stringify({
        success: true,
        quote_id: quote.id,
        items_count: items.length,
        supplier_name: extracted.supplier_name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("processar-cotacao error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
