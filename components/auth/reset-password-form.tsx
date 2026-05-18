"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { useAuth } from "@/hooks/use-auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("error") === "invalid_link" ? "Link invalido ou expirado. Solicite um novo link." : null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Revise a nova senha.");
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(parsed.data.password);

    if (result.error) {
      setMessage(result.error);
      setIsSubmitting(false);
      return;
    }

    await signOut();
    router.replace("/login?password_updated=1");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {message ? <div className="auth-alert">{message}</div> : null}

      <label className="label" htmlFor="password">
        Nova senha
      </label>
      <Input
        id="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      <label className="label" htmlFor="confirmPassword">
        Confirmar senha
      </label>
      <Input
        id="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        required
      />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Atualizando..." : "Atualizar senha"}
      </Button>

      <Link href="/login" className="auth-link">
        Voltar para o login
      </Link>
    </form>
  );
}
