/**
 * MOTOR DE REGRAS BANCÁRIAS BRASILEIRAS (classificador v2)
 *
 * Módulo puro. Opera sobre o texto já normalizado (sem acento, minúsculo,
 * sem pontuação) de `description-cleaner.ts`.
 *
 * O dicionário (`merchants_dictionary`) já cobre merchants, concessionárias e
 * frases bancárias por extenso ("tarifa mensal", "iof de atraso", "pix
 * enviado"...). Aqui entra o que ele NÃO cobre e não cabe em linha de tabela:
 * as SIGLAS e abreviações dos extratos (TAR, CESTA, SISPAG, TBI, RSHOP, CP
 * ELO, PAGTO ELO, INT PAG TIT, DEB AUT, APLIC/RESG CDB/RDB, REND PAGO APLIC,
 * CRED SAL, PROVENTOS...) e a DIREÇÃO do lançamento (a mesma sigla significa
 * coisas diferentes em crédito e débito).
 *
 * Dois tipos de regra:
 *  - terminal: decide a categoria (tarifa, IOF, juros, salário, aplicação...).
 *    Fica abaixo apenas do que o PRÓPRIO usuário já ensinou.
 *  - context:  só descreve o canal (PIX, TED, boleto, compra no débito). O
 *    trecho casado é removido e o RESTO vai para a busca de entidade — "PAGTO
 *    ELO DROGASIL" é farmácia, não "pagamento". Sem entidade, usa o default.
 *
 * A ordem importa: a primeira regra terminal compatível com a direção vence.
 * Por isso "tarifa saque" (taxa) vem antes de "saque" (retirada).
 */

export const CAT = {
  TARIFAS: 'Tarifas Bancárias / Juros / Impostos / Taxas',
  OUTROS: 'Outros',
  OUTRAS_RECEITAS: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
  SALARIO: 'Salário / 13° Salário / Férias',
  PRO_LABORE: 'Pró Labore',
  PLR: 'Participação de Lucros / Comissões',
  RENDA_INVEST: 'Renda de Investimentos',
  INVESTIMENTOS: 'Investimentos (pelo menos 20% da receita)',
  EMPRESTIMOS: 'Empréstimos / Financiamentos',
  CASA: 'Casa',
  TRANSPORTE: 'Transporte',
  LAZER: 'Lazer',
  ASSINATURAS: 'Assinaturas',
} as const;

export type Direction = 'income' | 'expense';

export interface BankingRule {
  id: string;
  kind: 'terminal' | 'context';
  re: RegExp;
  /** Direção em que a regra vale. Ausente = ambas. */
  direction?: Direction;
  /** Não dispara se o texto também casar com este padrão. */
  unless?: RegExp;
  category: string;
  subcategory: string;
  confidence: number;
}

export interface RuleHit {
  rule: BankingRule;
  /** Texto com o trecho da regra removido (para regras de contexto). */
  residual: string;
}

const INVEST_PRODUCTS =
  '(cdb|rdb|lci|lca|lc|cri|cra|debentures?|tesouro|poupanca|poup|fundos?|fundo\\s+inv|fii|previdencia|pgbl|vgbl|cofrinho|caixinha|conta\\s*max|rende\\s+facil|bb\\s+rende|invest\\s+facil|aut\\s+mais|aplic\\s+aut|renda\\s+fixa|acoes|cripto)';

/**
 * Regras TERMINAIS. Ordem = precedência.
 */
const TERMINAL_RULES: BankingRule[] = [
  // ---------------------------------------------------------------- tarifas
  {
    id: 'tarifa_sigla',
    kind: 'terminal',
    re: /\b(tar(if)?|tarifas?)\s+(pacote|pct|manut(encao)?|mensal(idade)?|cesta|pix|ted|doc|tef|saque|saq|extrato|adicional|bancaria|serv(icos?)?|cartao|emissao|avulsa|renov(acao)?|cadastro|dep(osito)?|transf|cheque|excesso|sms|agendamento|boleto|cobranca|conta|folha|op(eracao)?|limite)\b/,
    category: CAT.TARIFAS,
    subcategory: 'Tarifas Bancárias',
    confidence: 95,
  },
  {
    id: 'tarifa_pacote',
    kind: 'terminal',
    re: /\b(cesta\s+(de\s+)?(serv|servicos|basica|relacionamento|b)|pacote\s+(de\s+)?serv(icos?)?|pct\s+serv|mensalidade\s+(do\s+)?pacote|manut(encao)?\s+(de\s+)?conta|tx\s+(saque|manut|adm|servico)|taxa\s+(de\s+)?(saque|manutencao|administracao|administrativa|servico|emissao|boleto|transferencia|cadastro))\b/,
    category: CAT.TARIFAS,
    subcategory: 'Tarifas Bancárias',
    confidence: 93,
  },
  {
    id: 'iof',
    kind: 'terminal',
    re: /\b(iof|i\s+o\s+f)\b/,
    direction: 'expense',
    category: CAT.TARIFAS,
    subcategory: 'IOF',
    confidence: 96,
  },
  {
    id: 'renda_jcp',
    kind: 'terminal',
    re: /\b(jcp|juros\s+(s\s+)?(sobre\s+)?cap(ital)?(\s+proprio)?|dividendos?|div\s+pago|proventos?\s+(de\s+)?(acoes|fii|fundos?|b3|ativos)|rend(imento)?s?\s+(pago|pagos|credit(ado|o)|aplic|poup|cdb|rdb|fii)|rendimentos?|remuneracao\s+(aplic|conta|poup)|cupom\s+(tesouro|de\s+juros)|amortizacao\s+(fii|cri|cra|debenture))\b/,
    direction: 'income',
    category: CAT.RENDA_INVEST,
    subcategory: 'Rendimentos',
    confidence: 92,
  },
  {
    id: 'juros_encargos',
    kind: 'terminal',
    re: /\b(juros?|encargos?|mora|juros\s+lis|juros\s+cheque\s+esp(ecial)?|rotativo|multa|multas|anuidade|encargo\s+limite|adiant(amento)?\s+(a\s+)?depositante|seguro\s+(prestamista|protecao\s+(de\s+)?cartao|cartao))\b/,
    direction: 'expense',
    unless: /\bjuros\s+(s\s+)?(sobre\s+)?cap(ital)?\b|\brotativo\s+digital\b/,
    category: CAT.TARIFAS,
    subcategory: 'Juros e Encargos',
    confidence: 92,
  },
  {
    id: 'impostos_guias',
    kind: 'terminal',
    re: /\b(darf|gps|gru|gare|dare|icms|iss|issqn|irpf|irrf|imposto(\s+de\s+renda)?|receita\s+federal|simples\s+nacional|pag(to)?\s+inss|inss\s+contrib|licenciamento|detran|dpvat|multa\s+transito|taxa\s+bombeiro|tributos?)\b/,
    direction: 'expense',
    category: CAT.TARIFAS,
    subcategory: 'Impostos e Taxas',
    confidence: 90,
  },

  // --------------------------------------------------------------- receitas
  {
    id: 'salario',
    kind: 'terminal',
    re: /\b(salario|sal|salarios|folha(\s+(de\s+)?pag(amento|to)?)?|pgto\s+sal|pag(to|amento)?\s+(de\s+)?salario|cred(ito)?\s+(de\s+)?sal(ario)?|vencimentos|remuneracao|proventos?|13o?\s*sal(ario)?|decimo\s+terceiro|ferias|adiant(amento)?\s+sal(arial)?|rescisao|holerite|ordenado)\b/,
    direction: 'income',
    unless: /\b(proventos?\s+(de\s+)?(acoes|fii|fundos?|b3|ativos)|rend)/,
    category: CAT.SALARIO,
    subcategory: 'Salário',
    confidence: 90,
  },
  {
    id: 'pro_labore',
    kind: 'terminal',
    re: /\bpro\s*labore\b/,
    direction: 'income',
    category: CAT.PRO_LABORE,
    subcategory: 'Pró Labore',
    confidence: 94,
  },
  {
    id: 'plr_comissao',
    kind: 'terminal',
    re: /\b(plr|ppr|participacao\s+(nos?\s+)?(lucros?|resultados?)|comiss(ao|oes)|bonus|bonificacao|premiacao)\b/,
    direction: 'income',
    category: CAT.PLR,
    subcategory: 'PLR / Comissões',
    confidence: 90,
  },
  {
    id: 'beneficios',
    kind: 'terminal',
    re: /\b(inss|aposentadoria|beneficio|bolsa\s+familia|auxilio|fgts|seguro\s+desemprego|abono(\s+salarial)?|pis\s+pasep|pasep|restituicao(\s+ir)?)\b/,
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Benefícios e Restituições',
    confidence: 88,
  },
  {
    id: 'estorno_cashback',
    kind: 'terminal',
    re: /\b(estorno|estornado|cashback|reembolso|devolucao|devol|chargeback|contestacao|credito\s+(de\s+)?ajuste|ajuste\s+(a\s+)?credito|cancelamento\s+(de\s+)?compra)\b/,
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Estornos e Reembolsos',
    confidence: 90,
  },

  // --------------------------------------------------------- investimentos
  {
    id: 'resgate_investimento',
    kind: 'terminal',
    re: new RegExp(`\\b((resg(ate)?|res|rsg|resgate\\s+automatico)\\s+(aplic(acao)?\\s+)?(de\\s+)?${INVEST_PRODUCTS}|(bb\\s+)?rende\\s+facil)`),
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Resgate de Investimento',
    confidence: 90,
  },
  {
    id: 'aplicacao_investimento',
    kind: 'terminal',
    re: new RegExp(`\\b((apl(ic(acao)?)?|aplicacao|aporte|invest(imento)?)\\s+(automatica\\s+)?(em\\s+|de\\s+|no\\s+|na\\s+)?${INVEST_PRODUCTS}|guardad[oa]\\s+(na|no)\\s+(caixinha|cofrinho)|(bb\\s+)?rende\\s+facil|compra\\s+(de\\s+)?(titulo|tesouro|acoes|cotas))`),
    direction: 'expense',
    category: CAT.INVESTIMENTOS,
    subcategory: 'Aplicação',
    confidence: 90,
  },

  // --------------------------------------------------------------- crédito
  {
    id: 'emprestimo_recebido',
    kind: 'terminal',
    re: /\b((cred(ito)?|liberacao|lib)\s+(de\s+)?(emprest(imo)?|consignado|financiamento|credito\s+pessoal|cdc)|emprestimo\s+(contratado|liberado|recebido))\b/,
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Empréstimo Recebido',
    confidence: 88,
  },
  {
    id: 'emprestimo_parcela',
    kind: 'terminal',
    re: /\b(emprest(imo)?|consignado|financiamento|financ|parc(ela)?\s+(emprest|financ|credito\s+pessoal|cdc)|credito\s+pessoal|prest(acao)?\s+(hab(itacional)?|imovel|veiculo|carro|casa)|cdc|leasing|consorcio|renegociacao|acordo\s+(de\s+)?divida)\b/,
    direction: 'expense',
    category: CAT.EMPRESTIMOS,
    subcategory: 'Parcela de Empréstimo/Financiamento',
    confidence: 88,
  },
  {
    id: 'pagamento_fatura',
    kind: 'terminal',
    re: /\b((pag(amento|to)?|pgto|int\s+pag|deb(ito)?)\s+(de\s+)?(fatura|fat)(\s+(do\s+)?cartao)?|fatura\s+(paga|cartao|do\s+cartao)|pag(amento|to)?\s+(de\s+)?cartao\s+(de\s+)?cred(ito)?|pagamento\s+minimo|pagamento\s+efetuado$)\b/,
    direction: 'expense',
    category: CAT.OUTROS,
    subcategory: 'Pagamento de Fatura',
    confidence: 88,
  },
  {
    id: 'pagamento_fatura_credito',
    kind: 'terminal',
    re: /\b((pag(amento|to)?|pgto)\s+(de\s+)?(fatura|fat)|pagamento\s+(recebido|efetuado)(\s+obrigado)?$|pagamento\s+(em\s+)?(dia|recebido)|credito\s+(de\s+)?pagamento)\b/,
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Pagamento de Fatura',
    confidence: 88,
  },

  // ------------------------------------------------------------- dinheiro
  {
    id: 'saque',
    kind: 'terminal',
    re: /\b(saque|saq|retirada\s+(em\s+)?(dinheiro|especie)|saque\s+(24h|banco\s*24\s*horas|atm|terminal))\b/,
    direction: 'expense',
    category: CAT.OUTROS,
    subcategory: 'Saque em Dinheiro',
    confidence: 85,
  },
  {
    id: 'deposito',
    kind: 'terminal',
    re: /\b(dep(osito)?(\s+(em\s+)?(dinheiro|especie|cheque|atm|terminal|lotérica|loterica))?|dep\s+din)\b/,
    direction: 'income',
    unless: /\bpix\b/,
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Depósitos',
    confidence: 82,
  },
  {
    id: 'loterias',
    kind: 'terminal',
    re: /\b(loterica|loterias?|mega\s*sena|lotofacil|quina|lotomania|timemania|dupla\s+sena|dia\s+de\s+sorte|super\s+sete)\b/,
    direction: 'expense',
    category: CAT.LAZER,
    subcategory: 'Loterias',
    confidence: 85,
  },
  {
    id: 'recarga_celular',
    kind: 'terminal',
    re: /\b(recarga\s+(de\s+)?(celular|cel|telefone|pre\s*pago|vivo|claro|tim|oi)|recarga\s+pre)\b/,
    direction: 'expense',
    category: CAT.ASSINATURAS,
    subcategory: 'Telefonia',
    confidence: 88,
  },
  {
    id: 'condominio_aluguel',
    kind: 'terminal',
    re: /\b(condominio|cond\s+(edif|resid)|taxa\s+condominial|aluguel|locacao\s+(de\s+)?imovel)\b/,
    direction: 'expense',
    category: CAT.CASA,
    subcategory: 'Moradia',
    confidence: 86,
  },
  {
    id: 'aluguel_recebido',
    kind: 'terminal',
    re: /\b(aluguel|locacao)\b/,
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Aluguéis',
    confidence: 86,
  },
  {
    id: 'mobilidade_pedagio',
    kind: 'terminal',
    re: /\b(pedagio|estacionamento|estac|zona\s+azul|rotativo\s+digital|tag\s+pedagio)\b/,
    direction: 'expense',
    category: CAT.TRANSPORTE,
    subcategory: 'Pedágio e Estacionamento',
    confidence: 86,
  },
];

/**
 * Regras de CONTEXTO (canal). Não decidem sozinhas: removem a sigla e liberam
 * a busca de entidade no que sobrar.
 */
const CONTEXT_RULES: BankingRule[] = [
  {
    id: 'transferencia_propria',
    kind: 'context',
    re: /\b((transf(erencia)?|ted|doc|tef|pix)\s+)?(entre\s+contas|mesma\s+titularidade|conta\s+propria|mesmo\s+titular|p\/?\s*mesma\s+tit)\b/,
    category: CAT.OUTROS,
    subcategory: 'Transferência entre Contas',
    confidence: 80,
  },
  {
    id: 'pix_enviado',
    kind: 'context',
    re: /\b(pix\s+(enviado|env|transf(erencia)?|pagamento|pagto|pag|saida|debito|deb|qrs?|qr\s*code(\s+(dinamico|estatico))?|agendado|programado|devolvido)|transf(erencia)?\s+(enviada\s+)?(pelo\s+|via\s+)?pix|envio\s+(de\s+)?pix|pagamento\s+(via\s+)?pix|pix)\b/,
    direction: 'expense',
    category: CAT.OUTROS,
    subcategory: 'Transferências',
    confidence: 68,
  },
  {
    id: 'pix_recebido',
    kind: 'context',
    re: /\b(pix\s+(recebido|receb|rec|credito|cred|entrada|qrs?|devolvido|devolucao)|transf(erencia)?\s+(recebida\s+)?(pelo\s+|via\s+)?pix|cred(ito)?\s+pix|pix)\b/,
    direction: 'income',
    category: CAT.OUTRAS_RECEITAS,
    subcategory: 'Transferência Recebida',
    confidence: 68,
  },
  {
    id: 'ted_doc',
    kind: 'context',
    re: /\b((ted|doc|tef|tbi|tev)(\s+(enviada|enviado|recebida|recebido|cred(ito)?|deb(ito)?|em\s+conta|c\s*c|dif\s+tit|mesma\s+tit|interbancaria|internet|eletronica))?|transf(erencia)?(\s+(enviada|recebida|cc\s+para\s+cc|p\s+cc|entre\s+bancos|bancaria|online|internet))?|tr\s+(cc|ct|conta)|trans\s+(cc|conta))\b/,
    category: CAT.OUTROS,
    subcategory: 'Transferências',
    confidence: 66,
  },
  {
    id: 'boleto_titulo',
    kind: 'context',
    re: /\b((int\s+)?(pag(amento|to)?|pgto|pg)\s+(de\s+)?(boleto|bloqueto|tit(ulo)?|cobranca|conta|eletron(ico)?\s+cobranca|convenio|agua|luz|gas|telefone)|boleto|bloqueto|sispag(\s+(tit|forn|fornecedores|sal))?|cobranca|convenio|arrecadacao|deb\s+arrec|pag\s+tit\s+banco)\b/,
    direction: 'expense',
    category: CAT.OUTROS,
    subcategory: 'Boletos e Contas',
    confidence: 55,
  },
  {
    id: 'debito_automatico',
    kind: 'context',
    re: /\b(deb(ito)?\s+aut(om(atico)?)?|debito\s+autorizado|deb\s+autoriz|debito\s+em\s+conta|deb\s+cta|db\s+t\s+conta)\b/,
    direction: 'expense',
    category: CAT.OUTROS,
    subcategory: 'Débito Automático',
    confidence: 55,
  },
  {
    id: 'compra_cartao',
    kind: 'context',
    re: /\b((compra|cpra|cp|comp|pagto|pag|pgto)\s+(com\s+|no\s+)?(cartao|cart|crt|elo|maestro|visa(\s+electron)?|master(card)?|mc|debito|deb|credito|cred|hiper(card)?|amex)(\s+(debito|deb|credito|cred|nacional|internacional|nac|int|virtual|mc|visa|elo))*|visa\s+electron|maestro|rshop|redeshop|compra\s+(nacional|internacional|no\s+exterior|aprovada|parcelada|a\s+vista)|compra|elo\s+deb(ito)?|cartao\s+(virtual|fisico|adicional))\b/,
    category: CAT.OUTROS,
    subcategory: 'Compras no Cartão',
    confidence: 45,
  },
];

function matches(rule: BankingRule, text: string, direction: Direction): boolean {
  if (rule.direction && rule.direction !== direction) return false;
  if (!rule.re.test(text)) return false;
  if (rule.unless && rule.unless.test(text)) return false;
  return true;
}

/** Primeira regra terminal que casa com o texto na direção do lançamento. */
export function findTerminalRule(text: string, direction: Direction): BankingRule | null {
  for (const rule of TERMINAL_RULES) {
    if (matches(rule, text, direction)) return rule;
  }
  return null;
}

/**
 * Aplica TODAS as regras de contexto compatíveis em sequência, removendo o
 * trecho casado. Retorna a de maior confiança (o canal dominante) e o resíduo.
 */
export function applyContextRules(text: string, direction: Direction): { primary: BankingRule | null; residual: string; ids: string[] } {
  let residual = text;
  let primary: BankingRule | null = null;
  const ids: string[] = [];

  for (const rule of CONTEXT_RULES) {
    if (!matches(rule, residual, direction)) continue;
    ids.push(rule.id);
    if (!primary || rule.confidence > primary.confidence) primary = rule;
    const global = new RegExp(rule.re.source, 'g');
    residual = residual.replace(global, ' ').replace(/\s+/g, ' ').trim();
  }

  return { primary, residual, ids };
}

/** Exposto para testes. */
export const __rules = { TERMINAL_RULES, CONTEXT_RULES };
