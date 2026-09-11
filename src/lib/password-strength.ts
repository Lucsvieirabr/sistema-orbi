/**
 * ============================================================================
 * FORÇA DE SENHA — avaliação client-side (UX)
 * ============================================================================
 * A autoridade final é o GoTrue (Supabase Auth): ele recusa senha fraca com
 * `weak_password` e senha igual à atual com `same_password`. Este módulo existe
 * para o usuário descobrir isso ANTES de enviar, com critérios legíveis.
 *
 * Regras obrigatórias (bloqueiam o envio):
 *   - 8 a 72 caracteres (72 = teto do bcrypt usado pelo GoTrue; o excedente
 *     seria silenciosamente ignorado);
 *   - letras E números;
 *   - não conter a parte local do e-mail da conta.
 *
 * O medidor (1-4) vai além do mínimo: variedade de classes, comprimento e
 * penalidade para padrões previsíveis.
 * ============================================================================
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordRule {
  id: "length" | "letters_numbers" | "not_email";
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  score: PasswordScore;
  label: string;
  rules: PasswordRule[];
  /** Todas as regras obrigatórias atendidas e dentro do teto de tamanho. */
  isValid: boolean;
  /** Mensagem do primeiro problema bloqueante, pronta para o campo. */
  error: string | null;
}

const SCORE_LABEL: Record<PasswordScore, string> = {
  0: "",
  1: "Fraca",
  2: "Razoável",
  3: "Boa",
  4: "Forte",
};

// Sequências que qualquer ataque de dicionário testa primeiro.
const PREDICTABLE = [
  "12345678",
  "123456789",
  "87654321",
  "password",
  "senha123",
  "qwerty",
  "abc123",
  "abcdefgh",
  "orbi",
  "iloveyou",
  "admin",
];

function emailLocalPart(email?: string | null): string {
  const local = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  // Parte local curta ("jo") gera falso positivo em qualquer senha.
  return local.length >= 4 ? local : "";
}

function isPredictable(password: string): boolean {
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password)) return true;
  return PREDICTABLE.some((pattern) => lower.includes(pattern));
}

export function evaluatePassword(password: string, email?: string | null): PasswordEvaluation {
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(password);
  const hasDigit = /\d/.test(password);
  const local = emailLocalPart(email);
  const containsEmail = local !== "" && password.toLowerCase().includes(local);

  const rules: PasswordRule[] = [
    { id: "length", label: `${PASSWORD_MIN_LENGTH} caracteres ou mais`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "letters_numbers", label: "Letras e números", met: hasLetter && hasDigit },
    { id: "not_email", label: "Sem o seu e-mail", met: password.length > 0 && !containsEmail },
  ];

  const tooLong = password.length > PASSWORD_MAX_LENGTH;
  const isValid = rules.every((rule) => rule.met) && !tooLong;

  let error: string | null = null;
  if (password.length === 0) error = "Digite a nova senha.";
  else if (tooLong) error = `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  else if (!rules[0].met) error = `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  else if (!rules[1].met) error = "Combine letras e números.";
  else if (!rules[2].met) error = "A senha não pode conter o seu e-mail.";

  if (password.length === 0) {
    return { score: 0, label: SCORE_LABEL[0], rules, isValid: false, error };
  }

  const variety = [/[a-zà-ÿ]/, /[A-ZÀ-Ý]/, /\d/, /[^A-Za-zÀ-ÿ\d]/].filter((re) => re.test(password)).length;

  let score: PasswordScore;
  if (!isValid || isPredictable(password)) {
    score = 1;
  } else {
    let points = 2; // mínimo atendido
    if (variety >= 3) points += 1;
    if (password.length >= 12 && variety >= 3) points += 1;
    else if (password.length >= 14) points += 1;
    score = Math.min(4, points) as PasswordScore;
  }

  return { score, label: SCORE_LABEL[score], rules, isValid, error };
}
