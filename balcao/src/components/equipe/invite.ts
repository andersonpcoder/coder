"use client";

import type { Db } from "@/lib/store";
import type { Invite, Role } from "@/lib/types";

/** Cria um convite e devolve o id e o link para enviar à pessoa. */
export async function createInvite(
  db: Db,
  role: Role,
  opts: { email?: string; professionalId?: string } = {},
): Promise<{ id: string; link: string } | null> {
  const invite: Invite = {
    id: crypto.randomUUID(),
    role,
    email: opts.email,
    professionalId: opts.professionalId,
    token: Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join(""),
    createdAt: new Date().toISOString(),
  };
  const ok = await db.upsert("invites", [invite]);
  return ok ? { id: invite.id, link: `${window.location.origin}/convite/${invite.token}` } : null;
}
