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
import { isValidPixKey } from "@/lib/pix";

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
  pix: optionalText(140)
    .refine((value) => !value || isValidPixKey(value), "Chave PIX inválida")
    .optional(),
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

// ---------------------------------------------------------------------------
// Contratos de rateio e acertos de viagem (migration 20260916021503)
// Espelho de split_contracts / ledgers / ledger_participants / ledger_entries.
// ---------------------------------------------------------------------------

export const splitContractSchema = z.object({
  person_id: uuidSchema,
  category_id: uuidSchema,
  proportion_percentage: z
    .number({ invalid_type_error: "Percentual invalido" })
    .finite("Percentual invalido")
    .min(0, "O percentual vai de 0 a 100")
    .max(100, "O percentual vai de 0 a 100"),
  note: optionalText(140),
  is_active: z.boolean(),
});

const ledgerWeightSchema = z
  .number({ invalid_type_error: "Peso invalido" })
  .finite("Peso invalido")
  .min(0, "O peso vai de 0 a 100")
  .max(100, "O peso vai de 0 a 100");

export const ledgerSchema = z
  .object({
    name: requiredText(80, "Nome do evento"),
    description: optionalText(280),
    start_date: planningDateSchema.nullable(),
    end_date: planningDateSchema.nullable(),
    owner_weight: ledgerWeightSchema,
    pix_key: optionalText(77),
    pix_name: optionalText(25),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: "O fim precisa ser igual ou depois do inicio",
    path: ["end_date"],
  });

export const ledgerParticipantSchema = z.object({
  ledger_id: uuidSchema,
  person_id: uuidSchema,
  weight: ledgerWeightSchema,
});

export const ledgerEntrySchema = z.object({
  ledger_id: uuidSchema,
  paid_by_person_id: uuidSchema,
  description: requiredText(140, "Descricao"),
  value: positiveMoneySchema.refine((v) => v > 0, "O valor precisa ser maior que zero"),
  entry_date: planningDateSchema,
});

export const projectKindSchema = z.enum(["event", "trip", "purchase", "home", "family", "other"]);

export const projectSchema = z
  .object({
    name: requiredText(80, "Nome do projeto"),
    description: optionalText(280),
    kind: projectKindSchema,
    icon: lucideIconSchema,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser um hexadecimal (ex.: #1D4ED8)"),
    budget: positiveMoneySchema.max(1000000000, "Orcamento acima do permitido"),
    start_date: planningDateSchema,
    end_date: planningDateSchema,
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "O fim precisa ser igual ou depois do inicio",
    path: ["end_date"],
  });

export const goalExecuteSchema = z
  .object({
    p_goal_id: uuidSchema,
    p_name: requiredText(80, "Nome do projeto"),
    p_start_date: planningDateSchema,
    p_end_date: planningDateSchema,
    p_kind: projectKindSchema,
    p_extra_budget: positiveMoneySchema.max(1000000000, "Valor acima do permitido"),
    p_with_ledger: z.boolean(),
  })
  .refine((v) => v.p_end_date >= v.p_start_date, {
    message: "O fim precisa ser igual ou depois do inicio",
    path: ["p_end_date"],
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
// Documento fiscal (CPF/CNPJ) — o Asaas recusa cobranca sem ele
// ---------------------------------------------------------------------------
// Espelho de `supabase/functions/_shared/asaas.ts` (isValidCpfCnpj): o backend
// revalida; aqui so evita a ida ao gateway com documento malformado.
// CNPJ aceita o formato alfanumerico da Receita (12 posicoes [0-9A-Z] + 2 DV).

/** Remove pontuacao e normaliza caixa: "123.456.789-09" -> "12345678909". */
export function normalizeCpfCnpj(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase().replace(/[^0-9A-Z]/g, "") : "";
}

export function isValidCpf(value: string): boolean {
  const d = normalizeCpfCnpj(value);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const d = normalizeCpfCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(.)\1{13}$/.test(d)) return false;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + (d.charCodeAt(i) - 48) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export function isValidCpfCnpj(value: string): boolean {
  const d = normalizeCpfCnpj(value);
  return d.length === 11 ? isValidCpf(d) : d.length === 14 ? isValidCnpj(d) : false;
}

const maskChunks = (value: string, cuts: number[], separators: string[]) => {
  let out = "";
  let start = 0;
  cuts.forEach((end, i) => {
    const chunk = value.slice(start, end);
    if (!chunk) return;
    out += (i > 0 ? separators[i - 1] : "") + chunk;
    start = end;
  });
  return out;
};

/** Mascara progressiva: CPF ate 11 digitos, CNPJ a partir do 12o caractere. */
export function formatCpfCnpj(value: string): string {
  const d = normalizeCpfCnpj(value).slice(0, 14);
  if (d.length <= 11 && /^\d*$/.test(d)) {
    return maskChunks(d, [3, 6, 9, 11], [".", ".", "-"]);
  }
  return maskChunks(d, [2, 5, 8, 12, 14], [".", ".", "/", "-"]);
}

export const cpfCnpjSchema = z.preprocess(
  normalizeCpfCnpj,
  z
    .string()
    .min(1, "CPF ou CNPJ e obrigatorio")
    .refine(isValidCpfCnpj, "CPF ou CNPJ invalido"),
);

/** Checkout de plano pago (SubscriptionConsentDialog). */
export const subscriptionCheckoutSchema = z.object({
  cpfCnpj: cpfCnpjSchema,
});

export type SubscriptionCheckoutValues = { cpfCnpj: string };

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
