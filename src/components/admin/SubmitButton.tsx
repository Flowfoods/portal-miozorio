"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit com estado de envio — upload de foto pelo 4G demora alguns
 * segundos e a Mi precisa ver que algo está acontecendo (R19).
 */
export default function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
