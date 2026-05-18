"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { useAuth } from "@/hooks/use-auth";

export function ForgotPasswordForm() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = forgotPasswordSchema.safeParse({ email });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Informe um e-mail valido.");
      return;
    }

    setIsSubmitting(true);
    await resetPassword(parsed.data.email);
    setIsSubmitting(false);
    setMessage("Se o e-mail estiver cadastrado, voce recebera um link de recuperacao.");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {message ? <div className="auth-alert">{message}</div> : null}

      <label className="label" htmlFor="email">
        E-mail
      </label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar link"}
      </Button>

      <Link href="/login" className="auth-link">
        Voltar para o login
      </Link>
    </form>
  );
}
