/**
 * ============================================================================
 * SCHEMAS DOS FORMULÁRIOS DE AUTENTICAÇÃO (Zod + React Hook Form)
 * ============================================================================
 * Fronteira de UX, não de segurança: quem recusa senha fraca, e-mail inválido
 * ou conta duplicada é o GoTrue. Aqui o objetivo é que a pessoa descubra o
 * problema ANTES de gastar uma tentativa de rede — e em português.
 *
 * As regras de senha são as mesmas de `@/lib/password-strength`, que já é a
 * fonte única usada pela redefinição de senha. Um lugar só para mexer.
 * ============================================================================
 */

import { z } from "zod";

import { evaluatePassword, PASSWORD_MAX_LENGTH } from "@/lib/password-strength";

export const authEmailSchema = z
  .string({ required_error: "Digite seu e-mail." })
  .trim()
  .min(1, "Digite seu e-mail.")
  .max(254, "E-mail longo demais.")
  .email("Digite um e-mail válido.");

export const fullNameSchema = z
  .string({ required_error: "Digite seu nome completo." })
  .trim()
  .min(2, "Digite seu nome completo.")
  .max(80, "Use no máximo 80 caracteres.")
  .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Digite nome e sobrenome.");

// ---------------------------------------------------------------------------
// Entrar
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: authEmailSchema,
  password: z.string({ required_error: "Digite sua senha." }).min(1, "Digite sua senha."),
});

export type LoginValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Criar conta
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: authEmailSchema,
    password: z
      .string({ required_error: "Crie uma senha." })
      .min(1, "Crie uma senha.")
      .max(PASSWORD_MAX_LENGTH, `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`),
    confirmPassword: z.string({ required_error: "Repita a senha." }).min(1, "Repita a senha."),
    acceptedTerms: z.boolean(),
  })
  // Força da senha: mensagem dinâmica vinda da avaliação (inclui "não pode
  // conter o seu e-mail"), por isso `superRefine` e não `refine`.
  .superRefine((values, ctx) => {
    const evaluation = evaluatePassword(values.password, values.email);
    if (!evaluation.isValid && evaluation.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: evaluation.error });
    }
  })
  // As duas senhas precisam coincidir. O erro mora no campo de repetição —
  // é lá que a pessoa corrige.
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  })
  // Aceite legal explícito (LGPD art. 8º). Nunca pré-marcado.
  .refine((values) => values.acceptedTerms === true, {
    path: ["acceptedTerms"],
    message: "Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.",
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const REGISTER_DEFAULTS: RegisterValues = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

export const LOGIN_DEFAULTS: LoginValues = { email: "", password: "" };

/** Normaliza o e-mail antes de mandar para o GoTrue (que é case-insensitive). */
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
