// ============================================================================
// VALIDACAO E SANITIZACAO DE INPUT DO USUARIO (camada de cliente)
// ============================================================================
// Este arquivo NAO e a fronteira de seguranca — o PostgREST esta exposto e
// qualquer token valido escreve direto na API REST. A fronteira real sao as
// policies de RLS e as CHECK constraints das migrations
// `20260910000000_zero_trust_rls_force.sql` e
// `20260910000001_input_validation_constraints.sql`.
//
// O papel daqui e duplo:
//   1. Rejeitar payload malformado ANTES de gastar uma ida ao banco, com
//      mensagem em portugues em vez de erro cru de constraint;
//   2. Sanitizar o que entra: remover caracteres de controle (vetor de CSV /
//      log injection nos exports) e recusar URL com esquema perigoso
//      (`javascript:`) antes que ela vire `<img src>` / `<a href>`.
//
// Os limites abaixo sao ESPELHO EXATO das CHECK constraints do banco — ao
// mexer em um, mexer no outro.
// ============================================================================

import { z } from "zod";

// Caracteres de controle U+0000..U+001F e U+007F.
// CONTROL_ALL remove todos (campos de uma linha).
// CONTROL_EXCEPT_BREAKS preserva TAB (09), LF (0A) e CR (0D).
const CONTROL_ALL = new RegExp("[\\u0000-\\u001F\\u007F]", "g");
const CONTROL_EXCEPT_BREAKS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
  "g",
);

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

/** Remove caracteres de controle (NUL, ESC, CR/LF) e normaliza espacos. */
export function sanitizeSingleLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_ALL, " ").replace(/\s+/g, " ").trim();
}

/** Idem, mas preserva quebras de linha e tabs (campos de texto longo). */
export function sanitizeMultiLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_EXCEPT_BREAKS, "").trim();
}

const requiredText = (max: number, label: string) =>
  z.preprocess(
    sanitizeSingleLine,
    z.string().min(1, `${label} e obrigatorio`).max(max, `Maximo de ${max} caracteres`),
  );

const optionalText = (max: number) =>
  z.preprocess(
    (v) => {
      const s = sanitizeSingleLine(v);
      return s === "" ? null : s;
    },
    z.string().max(max, `Maximo de ${max} caracteres`).nullable(),
  );

export const uuidSchema = z.string().uuid("Identificador invalido");
export const optionalUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  uuidSchema.nullable(),
);

/** Faixa monetaria: acima disso e abuso, nao financa pessoal. */
const MONEY_MAX = 1000000000;
export const moneySchema = z
  .number({ invalid_type_error: "Valor invalido" })
  .finite("Valor invalido")
  .min(-MONEY_MAX, "Valor fora da faixa permitida")
  .max(MONEY_MAX, "Valor fora da faixa permitida");

export const positiveMoneySchema = moneySchema.min(0, "Valor nao pode ser negativo");

/** `YYYY-MM-DD` — o formato que o repo usa em toda coluna `date`. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00`)), "Data invalida");

/** Cor vai para style/CSS: so hexadecimal, nunca texto livre. */
export const hexColorSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(/^#[0-9A-Fa-f]{3,8}$/, "Cor deve ser um hexadecimal (ex.: #1D4ED8)")
    .nullable(),
);

/**
 * URL exibida na UI. Allowlist de esquema: `javascript:`, `vbscript:` e
 * `data:text/html` sao XSS armazenado quando a string vai para src/href.
 */
export const displayUrlSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .max(1500000, "Imagem excede o tamanho permitido")
    .refine(
      (v) => /^https:\/\//i.test(v) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(v),
      "Endereco de imagem nao permitido",
    )
    .nullable(),
);

// ---------------------------------------------------------------------------
// Enums do dominio (espelho das whitelists SQL)
// ---------------------------------------------------------------------------

export const transactionTypeSchema = z.enum(["expense", "income", "transfer"]);
export const transactionStatusSchema = z.enum(["PENDING", "PAID", "CANCELED"]);
export const paymentMethodSchema = z.enum(["debit", "credit"]);
export const categoryTypeSchema = z.enum(["expense", "income"]);
export const frequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
export const accountTypeSchema = z.enum([
  "Corrente",
  "Poupanca",
  "Poupança",
  "Dinheiro",
  "Investimento",
  "Carteira",
]);

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  name: requiredText(120, "Nome da conta"),
  type: accountTypeSchema,
  initial_balance: moneySchema,
  color: hexColorSchema.optional(),
});

export const creditCardSchema = z.object({
  name: requiredText(120, "Nome do cartao"),
  brand: optionalText(60).optional(),
  limit: positiveMoneySchema.nullable().optional(),
  // Fora de 1..31 o calculo de periodo de fatura vira lixo silencioso.
  statement_date: z.number().int().min(1, "Dia invalido").max(31, "Dia invalido").nullable().optional(),
  due_date: z.number().int().min(1, "Dia invalido").max(31, "Dia invalido").nullable().optional(),
  connected_account_id: optionalUuid.optional(),
});

export const personSchema = z.object({
  name: requiredText(120, "Nome da pessoa"),
  pix: optionalText(140).optional(),
});

export const categorySchema = z.object({
  name: requiredText(80, "Nome da categoria"),
  category_type: categoryTypeSchema.default("expense"),
  icon: optionalText(60).optional(),
});

export const transactionSchema = z.object({
  description: requiredText(300, "Descricao"),
  value: moneySchema,
  date: isoDateSchema,
  type: transactionTypeSchema,
  status: transactionStatusSchema.default("PENDING"),
  payment_method: paymentMethodSchema.nullable().optional(),
  account_id: optionalUuid.optional(),
  credit_card_id: optionalUuid.optional(),
  category_id: optionalUuid.optional(),
  person_id: optionalUuid.optional(),
  series_id: optionalUuid.optional(),
  is_fixed: z.boolean().optional(),
  is_shared: z.boolean().optional(),
  installment_number: z.number().int().min(1).max(480).nullable().optional(),
  compensation_value: positiveMoneySchema.nullable().optional(),
  linked_txn_id: optionalUuid.optional(),
  composition_details: z
    .preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.string().max(20000, "Detalhamento excede o tamanho permitido").nullable(),
    )
    .optional(),
});

export const seriesSchema = z.object({
  description: requiredText(300, "Descricao"),
  total_value: moneySchema,
  total_installments: z
    .number()
    .int()
    .min(1, "Minimo de 1 parcela")
    .max(480, "Maximo de 480 parcelas"),
  is_fixed: z.boolean().optional(),
  frequency: frequencySchema.default("monthly"),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.nullable().optional(),
  category_id: optionalUuid.optional(),
});

/** `public.notes` — a tabela nao tem coluna `title`; o texto e so `content`. */
export const noteSchema = z.object({
  content: z.preprocess(
    sanitizeMultiLine,
    z.string().min(1, "Conteudo e obrigatorio").max(20000, "Maximo de 20000 caracteres"),
  ),
  priority: z.number().int().min(1).max(3).optional(),
  due_date: isoDateSchema.nullable().optional(),
});

export const monthStartSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Mes deve estar no formato AAAA-MM-01");

export const budgetSchema = z.object({
  category_id: uuidSchema,
  amount_limit: positiveMoneySchema.refine((v) => v > 0, "O teto precisa ser maior que zero"),
  period_month: monthStartSchema,
});

export const budgetLimitSchema = budgetSchema.shape.amount_limit;

export const lucideIconSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,32}$/, "Icone invalido");

const planningDateSchema = isoDateSchema.refine(
  (v) => v >= "2000-01-01" && v <= "2100-12-31",
  "Data fora da faixa permitida",
);

export const goalSchema = z.object({
  name: requiredText(80, "Nome da meta"),
  target_value: positiveMoneySchema.refine((v) => v > 0, "O objetivo precisa ser maior que zero"),
  deadline: planningDateSchema.nullable(),
  icon: lucideIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser um hexadecimal (ex.: #1D4ED8)"),
});

export const goalAllocationSchema = z.object({
  goal_id: uuidSchema,
  amount: moneySchema.refine((v) => v !== 0, "O valor nao pode ser zero"),
  allocated_on: planningDateSchema,
  note: optionalText(140),
});

export const bugReportStatusSchema = z.enum([
  "novo",
  "em-analise",
  "em-desenvolvimento",
  "resolvido",
  "rejeitado",
]);

/**
 * `public.bug_reports` — colunas reais: titulo/descricao/imagem_url/status.
 * `imagem_url` e renderizada no painel admin: sem allowlist de esquema, um
 * relato com `javascript:...` seria XSS contra o proprio administrador.
 */
export const bugReportSchema = z.object({
  titulo: requiredText(200, "Titulo"),
  descricao: z.preprocess(
    sanitizeMultiLine,
    z.string().max(10000, "Maximo de 10000 caracteres"),
  ),
  imagem_url: displayUrlSchema.optional(),
});

/**
 * Texto que sera usado como padrao de LIKE nas RPCs do classificador.
 * `%`, `_` e `\` viram espaco: sem isso, uma descricao com `%` casa com o
 * dicionario inteiro e uma com `%a%a%a...` forca backtracking exponencial no
 * matcher do Postgres. O banco repete a higienizacao em
 * `orbi_sanitize_search_text()` — o cliente nunca e a unica barreira.
 */
export const searchTermSchema = z.preprocess(
  (v) =>
    sanitizeSingleLine(v)
      .replace(/[%_\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200),
  z.string(),
);

export function sanitizeSearchTerm(value: unknown): string {
  return searchTermSchema.parse(value) as string;
}

// ---------------------------------------------------------------------------
// Helper de aplicacao
// ---------------------------------------------------------------------------

/**
 * Valida e devolve o payload higienizado, ou lanca `Error` com a primeira
 * mensagem legivel — encaixa no padrao try/catch + toast do repo.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path?.length ? `${first.path.join(".")}: ` : "";
    throw new Error(`${field}${first?.message ?? "Dados invalidos"}`);
  }
  return result.data;
}
