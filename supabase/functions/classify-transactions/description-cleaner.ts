/**
 * NORMALIZAÇÃO DE DESCRIÇÕES BANCÁRIAS (classificador v2)
 *
 * Módulo puro (sem APIs do Deno) — testável em qualquer runtime.
 *
 * Correções em relação à v1:
 *  - v1 usava `[^\w\s]` sem flag `u`: letras acentuadas eram APAGADAS
 *    ("SÃO LUIZ" virava "s o luiz") e nenhum merchant acentuado casava.
 *    Agora os acentos são dobrados (NFD) antes de qualquer regex.
 *  - Prefixos de sub-adquirente/gateway ("IFD*", "PAG*", "MP*", "EC *",
 *    "PAYPAL *"...) são tratados: o gateway some e a entidade real fica; quando
 *    o prefixo identifica o merchant ("IFD*" = iFood) vira uma dica explícita.
 *  - camelCase ("DiskAguaEGas") é separado só em texto de caixa mista.
 *  - Datas, horários, parcelas ("PARC 02/10"), máscaras de cartão e códigos
 *    longos saem da assinatura canônica usada para cache e aprendizado.
 */

export interface NormalizedDescription {
  /** Texto dobrado (sem acento, minúsculo, pontuação vira espaço). */
  text: string;
  /** Tokens significativos (sem stopword, sem número puro, sem ruído). */
  tokens: string[];
  /** Assinatura estável para cache/aprendizado (sem datas/códigos/parcelas). */
  signature: string;
  /** Merchants sugeridos pelo prefixo do gateway (ex.: IFD* -> ifood). */
  hints: string[];
  /** Gateways removidos (auditoria em features_used). */
  gateways: string[];
}

const STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra',
  'com', 'sem', 'por', 'ao', 'aos', 'pela', 'pelo', 'o', 'a', 'os', 'as', 'e',
  'ref', 'cod', 'codigo', 'num', 'numero', 'nr', 'n', 'data', 'hora', 'tipo',
  'ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'br', 'bra', 'brasil', 'www',
  'com', 'net', 'org', 'loja', 'filial', 'unidade', 'estabelecimento',
]);

/**
 * Ruído exclusivo de EXTRATO (não se aplica às frases do dicionário — lá
 * "pix enviado" precisa continuar com 2 tokens para não colapsar em "pix").
 */
const DESCRIPTION_NOISE = new Set([
  'des', 'rem', 'destinatario', 'remetente', 'favorecido', 'fav', 'chave', 'ag', 'cc', 'ct',
  'agencia', 'efetuado', 'efetuada', 'realizado', 'realizada', 'enviado', 'enviada', 'recebido',
  'recebida', 'obrigado', 'aprovada', 'aprovado', 'pelo', 'via', 'hora', 'valor', 'doc', 'id',
]);

/** Localidades: nunca decidem um match sozinhas (ex.: "PORTO ALEGRE" ≠ Porto Seguro). */
export const LOCATION_TOKENS = new Set([
  'sao', 'paulo', 'rio', 'janeiro', 'belo', 'horizonte', 'curitiba', 'porto', 'alegre',
  'brasilia', 'salvador', 'fortaleza', 'recife', 'goiania', 'campinas', 'osasco',
  'guarulhos', 'santo', 'andre', 'bernardo', 'campo', 'grande', 'florianopolis',
  'manaus', 'belem', 'natal', 'vitoria', 'maceio', 'joao', 'pessoa', 'teresina',
  'londrina', 'joinville', 'niteroi', 'sorocaba', 'ribeirao', 'preto', 'uberlandia',
  'santos', 'barueri', 'jundiai', 'contagem', 'cuiaba', 'aracaju', 'maringa',
  'blumenau', 'petropolis', 'caxias', 'sul', 'norte', 'centro', 'bh', 'sp', 'rj',
  'mg', 'pr', 'rs', 'sc', 'ba', 'pe', 'ce', 'go', 'df', 'es', 'pa', 'am', 'mt',
  'ms', 'rn', 'pb', 'al', 'se', 'pi', 'ma', 'to', 'ro', 'ac', 'ap', 'rr',
]);

/**
 * Sub-adquirentes / gateways cujo prefixo "XXX*" não é o merchant.
 * O que vem depois do "*" é o estabelecimento real.
 */
const GATEWAY_PREFIXES = new Set([
  'pag', 'pagseguro', 'pgs', 'pg', 'mp', 'mercadopago', 'merpago', 'mercpago',
  'ec', 'ebanx', 'ebn', 'dl', 'dlocal', 'paypal', 'pp', 'sumup', 'sq', 'hna',
  'zp', 'zoop', 'iz', 'izettle', 'cielo', 'stone', 'getnet', 'rede', 'safrapay',
  'ton', 'infinitepay', 'picpay', 'pic', 'asaas', 'pagarme', 'iugu', 'vindi',
  'adyen', 'stripe', 'moip', 'wirecard', 'payu', 'paghiper', 'juno', 'pix',
  'htm', 'lp', 'bpg', 'cpg', 'sympla',
]);

/** Prefixos que JÁ identificam o merchant (ex.: "IFD*RESTAURANTE X"). */
const MERCHANT_PREFIX_HINTS: Record<string, string> = {
  ifd: 'ifood',
  ifood: 'ifood',
  uber: 'uber',
  ubr: 'uber',
  '99app': '99',
  '99': '99',
  rappi: 'rappi',
  netflix: 'netflix',
  spotify: 'spotify',
  hotmart: 'hotmart',
  htm: 'hotmart',
  steam: 'steam',
  shopee: 'shopee',
  shein: 'shein',
  zedelivery: 'ze delivery',
  ze: 'ze delivery',
};

export function foldAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Remove ruído estrutural que nunca identifica a entidade: datas, horas,
 * parcelas, máscaras de cartão, CPF/CNPJ, códigos de autenticação.
 */
function stripStructuralNoise(value: string): string {
  return value
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')      // datas e parcelas 02/10
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')              // horários
    .replace(/\bparc(ela)?\.?\s*\d+\s*(de|\/)\s*\d+\b/g, ' ') // "parcela 2 de 10"
    .replace(/[x•*.]{2,}\s*\d{2,4}\b/g, ' ')                  // máscara "•••• 0040"
    .replace(/\b\d{2,3}\.\d{3}\.\d{3}[-/]?\d{0,4}[-]?\d{0,2}\b/g, ' ') // CPF/CNPJ
    .replace(/\b[a-z]*\d[a-z\d]{7,}\b/g, ' ')                 // códigos alfanuméricos longos
    .replace(/\b\d{4,}\b/g, ' ');                              // números longos
}

/** Separa camelCase apenas quando o texto não é todo maiúsculo/minúsculo. */
function splitCamelCase(raw: string): string {
  if (!/[a-z]/.test(raw) || !/[A-Z]/.test(raw)) return raw;
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

/**
 * Trata "PREFIXO*RESTO". Retorna o texto sem o gateway e as dicas de merchant.
 * Opera sobre o texto já dobrado/minúsculo.
 */
function extractGatewayPrefixes(text: string): { text: string; hints: string[]; gateways: string[] } {
  const hints: string[] = [];
  const gateways: string[] = [];

  const out = text.replace(/(^|\s)([a-z0-9]{2,14})\s?\*\s?/g, (_m, lead: string, prefix: string) => {
    if (GATEWAY_PREFIXES.has(prefix)) {
      gateways.push(prefix);
      return `${lead} `;
    }
    const hint = MERCHANT_PREFIX_HINTS[prefix];
    if (hint) {
      hints.push(hint);
      return `${lead}${prefix} `;
    }
    return `${lead}${prefix} `;
  });

  return { text: out, hints, gateways };
}

/** Normalização base, usada TANTO na descrição quanto nas frases do dicionário. */
export function normalizeText(raw: string): string {
  const withCamel = splitCamelCase(raw ?? '');
  return foldAccents(withCamel)
    .toLowerCase()
    .replace(/([a-z0-9])&([a-z0-9])/g, '$1e$2')   // c&a -> cea (espelha aliases do dicionário)
    .replace(/\+/g, ' plus ')                      // disney+ -> disney plus
    .replace(/[^a-z0-9*/:.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !DESCRIPTION_NOISE.has(t) && !/^\d+$/.test(t));
}

/** Tokeniza uma frase do dicionário (mantém números curtos como "99"). */
export function tokenizePhrase(raw: string): string[] {
  return normalizeText(raw)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 1 && !STOPWORDS.has(t));
}

export function normalizeDescription(description: string): NormalizedDescription {
  const base = normalizeText(description);
  const { text: noGateway, hints, gateways } = extractGatewayPrefixes(base);
  const cleaned = stripStructuralNoise(noGateway)
    .replace(/\.(com|net|org)(\.br)?\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "99" é o único número curto com significado de merchant; preserva quando
  // aparece junto de pistas de mobilidade (99app, 99 pop, 99 taxi, 99food).
  const tokens = tokenize(cleaned);
  if (/(^|\s)99(\s|$)/.test(cleaned) && /\b(app|pop|taxi|moto|food|pay|corrida|tecnologia)\b/.test(cleaned)) {
    hints.push('99');
  }

  return {
    text: cleaned,
    tokens,
    signature: tokens.join(' '),
    hints: [...new Set(hints)],
    gateways: [...new Set(gateways)],
  };
}
