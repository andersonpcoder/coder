import { Camera, Globe, MessageCircle, Phone, Store } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { channelLabel, statusLabel } from "@/lib/format";
import type { AppointmentStatus, BookingChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

export const statusTone: Record<AppointmentStatus, BadgeTone> = {
  agendado: "neutral",
  confirmado: "primary",
  aguardando: "warning",
  em_atendimento: "accent",
  concluido: "success",
  faltou: "danger",
  cancelado: "danger",
};

/** Cor do ponto de status nos blocos da agenda. */
export const statusDot: Record<AppointmentStatus, string> = {
  agendado: "bg-muted",
  confirmado: "bg-primary",
  aguardando: "bg-warning",
  em_atendimento: "bg-accent",
  concluido: "bg-success",
  faltou: "bg-danger",
  cancelado: "bg-danger",
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <Badge tone={statusTone[status]} className={className}>
      <span className={cn("size-1.5 rounded-full", statusDot[status])} aria-hidden />
      {statusLabel[status]}
    </Badge>
  );
}

const channelIcon = {
  whatsapp: MessageCircle,
  instagram: Camera,
  site: Globe,
  presencial: Store,
  telefone: Phone,
} as const;

export const channelColor: Record<BookingChannel, string> = {
  whatsapp: "text-[#1f9d55] dark:text-[#5fd08e]",
  instagram: "text-[#c13584] dark:text-[#f07cc0]",
  site: "text-primary",
  presencial: "text-accent",
  telefone: "text-muted",
};

export function ChannelIcon({ channel, className }: { channel: BookingChannel; className?: string }) {
  const Icon = channelIcon[channel];
  return <Icon className={cn("size-4", channelColor[channel], className)} aria-label={channelLabel[channel]} />;
}

export function ChannelTag({ channel }: { channel: BookingChannel }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
      <ChannelIcon channel={channel} className="size-3.5" />
      {channelLabel[channel]}
    </span>
  );
}
