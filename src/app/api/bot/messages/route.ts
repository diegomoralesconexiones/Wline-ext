import {
  MAX_REPLY_PARTS,
  MAX_TEXT_CHARS_ANY_CHANNEL,
  replyParts,
  TEXT_TOO_LONG_ANY_CHANNEL,
} from "@/server/channels/capabilities";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { apiError, parseBody } from "@/lib/api";
import { requireBotKey, resolveInstanceOrg } from "@/server/bot/auth";
import { SendError, sendText } from "@/server/inbox/send";
import { guardarRespuestaDePrueba } from "@/server/lab/sandbox";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  // 022: el tope de aquí es el del canal que más admite; el de cada canal
  // lo resuelve el envío partiendo el texto (Wline 031 · D8, abajo).
  text: z.string().min(1).max(MAX_TEXT_CHARS_ANY_CHANNEL, TEXT_TOO_LONG_ANY_CHANNEL),
});

/**
 * Envío del cerebro externo A TRAVÉS del CRM: el token de WhatsApp nunca sale
 * de aquí. Usa el mismo camino que el composer de la bandeja (`sendText`), así
 * que el mensaje queda en el hilo marcado como IA, respeta la ventana de 24 h
 * y hereda el guard de sandbox del Laboratorio.
 *
 * 033 — En una conversación de prueba del Laboratorio (`is_test`) la
 * respuesta se GUARDA en el hilo y no se envía: es como un cerebro externo
 * contesta una corrida. Antes respondía 409 `sandbox_violation`.
 *
 * Wline 031 · D8 — Un texto que no cabe en el canal (1.000 bytes en
 * Instagram, 2.000 en Messenger, 4.096 caracteres en WhatsApp) sale en varios
 * mensajes que sí caben, en orden, en vez de rechazarse con 422: el cerebro no
 * tiene que saber el tope de cada canal. Lo que cabe sale entero, como
 * siempre. `messageId` es el de la primera parte y `messageIds` trae todas.
 * Si una parte falla, las que faltan no se mandan y se responde el error de
 * esa parte, igual que con un solo mensaje.
 *
 * 409 tipados: ai_paused (un humano tomó la conversación) · window_closed ·
 * sandbox_violation · message_limit (022: el canal no admite más mensajes
 * hasta que el cliente escriba; hoy, el tope de TikTok).
 */
export async function POST(req: Request) {
  const denied = requireBotKey(req);
  if (denied) return denied;

  const organizationId = await resolveInstanceOrg();
  if (!organizationId) {
    return apiError(409, "no_org", "La instancia aún no tiene organización");
  }

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  // Gate de handoff: el bot JAMÁS habla sobre una conversación pausada. Se
  // relee aquí porque entre que el bot pidió el contexto y armó su respuesta
  // (segundos de un LLM) el dueño pudo haber tomado la conversación.
  const db = getDb();
  const convs = await db
    .select({
      aiEnabled: schema.conversation.aiEnabled,
      handoffAt: schema.conversation.handoffAt,
      isTest: schema.conversation.isTest,
      channel: schema.conversation.channel,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.id, body.data.conversationId)
      )
    )
    .limit(1);
  const conv = convs[0];
  if (!conv) return apiError(404, "not_found", "Conversación no encontrada");
  if (!conv.aiEnabled || conv.handoffAt) {
    return apiError(409, "ai_paused", "La IA está en pausa en esta conversación");
  }

  // Se parte ANTES de separar el Laboratorio, para que la corrida guarde las
  // mismas partes que recibiría el cliente.
  const partes = replyParts(conv.channel, body.data.text);
  if (partes.length === MAX_REPLY_PARTS) {
    // Solo el id: el texto del cliente no va a los logs.
    console.warn(
      `[bot] ${body.data.conversationId}: la respuesta ocupó el tope de ${MAX_REPLY_PARTS} mensajes; si era más larga, se recortó.`
    );
  }

  const messageIds: string[] = [];
  if (conv.isTest) {
    for (const parte of partes) {
      const guardada = await guardarRespuestaDePrueba({
        organizationId,
        conversationId: body.data.conversationId,
        text: parte,
      });
      messageIds.push(guardada.messageId);
    }
    return Response.json({ messageId: messageIds[0], messageIds, status: "sent" });
  }

  try {
    for (const parte of partes) {
      const result = await sendText({
        conversationId: body.data.conversationId,
        organizationId,
        text: parte,
        aiGenerated: true,
      });
      messageIds.push(result.messageId);
    }
    return Response.json({ messageId: messageIds[0], messageIds });
  } catch (err) {
    if (messageIds.length > 0) {
      console.warn(
        `[bot] ${body.data.conversationId}: salieron ${messageIds.length} de ${partes.length} partes; las demás no se mandaron.`
      );
    }
    if (err instanceof SendError) {
      if (err.code === "window_closed") {
        return apiError(409, "window_closed", err.message);
      }
      if (err.code === "sandbox_violation") {
        return apiError(409, "sandbox_violation", err.message);
      }
      if (err.code === "message_limit") {
        return apiError(409, "message_limit", err.message);
      }
      // Un texto de más de 4,096 caracteres por WhatsApp ya daba 422
      // `invalid_body` (lo cortaba el esquema): se conserva el código.
      if (err.code === "text_too_long") {
        return apiError(422, "invalid_body", err.message);
      }
      return apiError(502, err.code, err.message);
    }
    throw err;
  }
}
