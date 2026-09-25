import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { fromRow, type CollectionName } from "./mappers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RemoteEvent =
  | { type: "upsert"; collection: CollectionName; item: any }
  | { type: "remove"; collection: CollectionName; id: string }
  | { type: "message"; conversationId: string; message: ReturnType<typeof fromRow.message> };

const watched: [string, CollectionName | "messages", (r: any) => any][] = [
  ["appointments", "appointments", fromRow.appointment],
  ["queue_entries", "queue", fromRow.queue],
  ["conversations", "conversations", fromRow.conversation],
  ["messages", "messages", fromRow.message],
  ["internal_notifications", "notifications", fromRow.notification],
];

/** Assina as mudanças da empresa: fila, agenda e conversas atualizam em todas as telas. */
export function subscribeCompany(sb: SupabaseClient, companyId: string, onEvent: (e: RemoteEvent) => void): () => void {
  let channel: RealtimeChannel = sb.channel(`empresa:${companyId}`);
  for (const [table, collection, map] of watched) {
    channel = channel.on(
      "postgres_changes" as never,
      { event: "*", schema: "public", table, filter: `company_id=eq.${companyId}` },
      (payload: any) => {
        if (payload.eventType === "DELETE") {
          if (collection !== "messages") onEvent({ type: "remove", collection, id: payload.old.id });
          return;
        }
        if (collection === "messages") {
          onEvent({ type: "message", conversationId: payload.new.conversation_id, message: map(payload.new) });
        } else {
          onEvent({ type: "upsert", collection, item: map(payload.new) });
        }
      },
    );
  }
  channel.subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}
