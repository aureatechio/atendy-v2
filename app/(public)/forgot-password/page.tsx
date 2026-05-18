import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar senha" description="Enviaremos um link seguro para redefinir sua senha.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
