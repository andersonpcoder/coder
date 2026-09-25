"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useActions } from "@/lib/actions";
import { money, paymentMethodLabel } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PaymentTarget {
  title: string;
  amountCents: number;
  appointmentId?: string;
  customerId?: string;
  professionalId?: string;
}

/** Registrar pagamento ao concluir um atendimento (Pix, dinheiro ou cartão). */
export function PaymentDialog({
  target,
  onClose,
  onPaid,
}: {
  target: PaymentTarget | null;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const { registerPayment } = useActions();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (target) {
      setMethod("pix");
      setAmount((target.amountCents / 100).toFixed(2).replace(".", ","));
    }
  }, [target]);

  const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100);
  const valid = Number.isFinite(cents) && cents > 0;

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title="Registrar pagamento"
      description={target?.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Pular
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!target) return;
              registerPayment({
                appointmentId: target.appointmentId,
                customerId: target.customerId,
                professionalId: target.professionalId,
                method,
                amountCents: cents,
              });
              onPaid?.();
              onClose();
            }}
          >
            Confirmar {valid ? money(cents) : ""}
          </Button>
        </>
      }
    >
      <fieldset className="mb-4">
        <legend className="mb-2 text-[13px] font-semibold">Forma de pagamento</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
            <label
              key={m}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium",
                method === m ? "border-primary bg-primary-soft text-primary" : "border-border",
              )}
            >
              <input
                type="radio"
                name="metodo"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="accent-[var(--primary)]"
              />
              {paymentMethodLabel[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Valor (R$)">
        {(id) => (
          <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        )}
      </Field>
    </Dialog>
  );
}
