"use client";

/**
 * Form que pede confirmação antes de uma ação destrutiva (ex.: excluir foto)
 * — dedo escorrega fácil no celular (R19).
 */
export default function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: () => Promise<void>;
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
