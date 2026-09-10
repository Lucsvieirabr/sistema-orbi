import { LEGAL_CONTROLLER, type LegalDocument } from "./legal-types";

const { productName, legalName, privacyEmail, dpoName } = LEGAL_CONTROLLER;

/**
 * Política de Privacidade do Orbi — LGPD (Lei nº 13.709/2018).
 *
 * Descreve o tratamento real do produto: dados financeiros lançados pelo
 * usuário, importação de extratos (CSV/PDF/OCR), classificação por IA,
 * cobrança via gateway (Asaas), isolamento por linha no banco (RLS) e
 * retenção vinculada ao plano contratado.
 */
export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy-policy",
  path: "/legal/politica-de-privacidade",
  appPath: "/sistema/legal/politica-de-privacidade",
  title: "Política de Privacidade",
  shortTitle: "Política de Privacidade",
  eyebrow: "Documentos legais",
  version: "1.0",
  updatedAt: "2026-09-10",
  summary:
    "Como o Orbi coleta, usa, compartilha, protege e elimina seus dados pessoais e financeiros, com quais bases legais, por quanto tempo, e como você exerce os direitos garantidos pela LGPD.",
  sections: [
    {
      id: "controlador",
      title: "1. Quem trata seus dados e a quem esta Política se aplica",
      blocks: [
        {
          type: "paragraph",
          text: `${legalName}, responsável pela plataforma ${productName}, atua como CONTROLADORA dos dados pessoais tratados na prestação do serviço, nos termos do art. 5º, VI, da Lei nº 13.709/2018 (LGPD).`,
        },
        {
          type: "paragraph",
          text: "Esta Política se aplica ao site, à aplicação web e a todas as funcionalidades do Orbi, e complementa os Termos de Uso. Ela não se aplica a serviços de terceiros que você acesse a partir da plataforma (por exemplo, a página de pagamento do gateway), que possuem políticas próprias.",
        },
        {
          type: "paragraph",
          text: `Encarregado (DPO): ${dpoName} — contato por ${privacyEmail}.`,
        },
      ],
    },
    {
      id: "coleta-de-dados",
      title: "2. Dados que coletamos",
      blocks: [
        { type: "paragraph", text: "Coletamos apenas o necessário para operar o serviço:" },
        {
          type: "list",
          items: [
            "Dados de cadastro e conta: nome completo, e-mail, senha (armazenada apenas como hash irreversível pelo provedor de autenticação), data de criação e preferências de interface.",
            "Dados financeiros que você registra: contas, saldos iniciais, cartões (nome, bandeira, limite, dias de fechamento e vencimento — nunca o número completo do cartão), categorias, lançamentos com valor, data, descrição e status, parcelamentos, recorrências e notas.",
            "Dados de pessoas com quem você divide despesas: nome e, se você informar, chave PIX. Você é responsável por ter base legal para registrar dados de terceiros.",
            "Arquivos que você importa: extratos e faturas em CSV, PDF ou imagem, e o texto extraído deles por leitura automática ou OCR.",
            "Dados de assinatura e cobrança: plano, ciclo, status, histórico de pagamentos e identificadores da cobrança no gateway. Dados completos de cartão de crédito são coletados e guardados pelo gateway, não pelo Orbi.",
            "Dados técnicos: endereço IP, data e hora de acesso, identificador de sessão, tipo de navegador e dispositivo, além de registros de erro e de auditoria administrativa, mantidos por segurança e por exigência do art. 15 do Marco Civil da Internet.",
          ],
        },
        {
          type: "callout",
          text: "Não coletamos intencionalmente dados pessoais sensíveis (origem racial, convicção religiosa, opinião política, saúde, vida sexual, biometria ou dado genético). Não solicitamos senha de banco, token bancário, CVV nem credenciais de acesso a instituições financeiras — não peça, não envie e desconfie de quem pedir.",
        },
      ],
    },
    {
      id: "finalidades-e-bases-legais",
      title: "3. Para que usamos e com qual base legal",
      blocks: [
        {
          type: "list",
          items: [
            "Criar e manter sua conta, calcular saldos e projeções, exibir extratos e faturas e executar as funcionalidades contratadas — base: execução de contrato (art. 7º, V, LGPD).",
            "Processar assinatura, cobrança, renovação, estorno e prevenção a fraude no pagamento — base: execução de contrato e legítimo interesse (art. 7º, V e IX).",
            "Classificar lançamentos automaticamente, sugerir categorias, ler extratos importados e reconhecer padrões recorrentes — base: execução de contrato, por ser funcionalidade essencial do plano contratado, e consentimento quando a funcionalidade for opcional e ativada por você.",
            "Aprimorar heurísticas e dicionários de classificação a partir das suas correções, em base agregada e sem identificação pessoal — base: legítimo interesse, com salvaguardas de anonimização (art. 7º, IX, e art. 12).",
            "Enviar comunicações operacionais e contratuais (confirmações, avisos de cobrança, mudanças destes documentos) — base: execução de contrato e cumprimento de obrigação legal.",
            "Enviar comunicações de marketing, quando houver — base: consentimento, revogável a qualquer momento sem prejuízo do serviço.",
            "Manter registros de acesso, segurança da informação, auditoria e defesa em processos — base: cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).",
            "Cumprir obrigações fiscais e contábeis relativas às cobranças — base: obrigação legal (art. 7º, II).",
          ],
        },
      ],
    },
    {
      id: "uso-da-ia",
      title: "4. Uso de inteligência artificial e decisões automatizadas",
      blocks: [
        {
          type: "paragraph",
          text: "A classificação de lançamentos e a leitura de extratos combinam regras heurísticas próprias, dicionários de estabelecimentos, padrões aprendidos das suas próprias correções e, em determinadas funcionalidades, modelos de linguagem executados por provedores contratados como operadores.",
        },
        {
          type: "list",
          items: [
            "Enviamos ao provedor de modelo apenas o conteúdo necessário à execução da funcionalidade (por exemplo, a descrição do lançamento ou o trecho do extrato), pelo tempo necessário ao processamento.",
            "Exigimos contratualmente dos provedores que os dados enviados não sejam utilizados para treinar modelos de uso geral e sejam eliminados após o processamento e eventual janela de retenção antiabuso.",
            "Os padrões aprendidos ficam vinculados à sua conta ou são mantidos em forma agregada e não identificável quando usados para melhorar o dicionário geral.",
            "Nenhuma decisão com efeito jurídico ou impacto significativo sobre você (concessão de crédito, score, exclusão de direitos) é tomada de forma exclusivamente automatizada pela plataforma. Ainda assim, você pode solicitar informações claras sobre os critérios utilizados e pedir revisão humana de qualquer sugestão automática, nos termos do art. 20 da LGPD, pelo canal do Encarregado.",
            "Toda saída de IA é sugestão editável: você pode alterar, recusar ou desfazer classificações automáticas.",
          ],
        },
      ],
    },
    {
      id: "compartilhamento",
      title: "5. Com quem compartilhamos",
      blocks: [
        {
          type: "paragraph",
          text: "Não vendemos, alugamos nem cedemos seus dados pessoais. O compartilhamento ocorre apenas com operadores necessários à prestação do serviço, vinculados por contrato às finalidades desta Política:",
        },
        {
          type: "list",
          items: [
            "Infraestrutura de banco de dados, autenticação, armazenamento de arquivos e funções de servidor (provedor de backend como serviço).",
            "Hospedagem e distribuição da aplicação web, incluindo rede de entrega de conteúdo e proteção contra ataques e abuso.",
            "Asaas Gestão Financeira S.A., para emissão, processamento e liquidação das cobranças da assinatura, inclusive prevenção a fraude.",
            "Provedores de modelos de inteligência artificial, exclusivamente para as funcionalidades descritas na seção 4.",
            "Provedor de envio de e-mails transacionais.",
            "Autoridades públicas, quando houver requisição legal, ordem judicial ou necessidade de exercício regular de direitos.",
          ],
        },
        {
          type: "paragraph",
          text: "Parte desses operadores mantém servidores fora do Brasil. Nesses casos, a transferência internacional observa o art. 33 da LGPD e se apoia em cláusulas contratuais específicas e em garantias de segurança compatíveis com a lei brasileira. Em caso de reorganização societária, os dados podem ser transferidos ao sucessor, mantidas as condições desta Política e com comunicação prévia a você.",
        },
      ],
    },
    {
      id: "seguranca",
      title: "6. Segurança e isolamento dos dados",
      blocks: [
        {
          type: "list",
          items: [
            "Isolamento por usuário aplicado no próprio banco de dados (Row Level Security): as políticas de acesso vinculam cada linha ao identificador do seu usuário autenticado, de modo que consultas de uma conta não alcançam dados de outra, ainda que a requisição parta diretamente da API.",
            "Tráfego cifrado em trânsito (TLS) e criptografia em repouso no provedor de banco de dados.",
            "Senhas armazenadas como hash irreversível; nós não temos acesso à sua senha em texto claro.",
            "Controle de acesso administrativo restrito, com registro de auditoria das ações administrativas.",
            "Limites de requisição, validação de entrada e consultas parametrizadas para mitigar abuso e injeção de comandos.",
            "Backups periódicos mantidos pela infraestrutura de banco de dados.",
          ],
        },
        {
          type: "paragraph",
          text: "Nenhum sistema é absolutamente seguro. Havendo incidente de segurança com risco relevante aos seus direitos, comunicaremos você e a Autoridade Nacional de Proteção de Dados em prazo razoável, com a descrição do ocorrido, os dados afetados e as medidas adotadas, conforme o art. 48 da LGPD.",
        },
      ],
    },
    {
      id: "retencao",
      title: "7. Por quanto tempo guardamos",
      blocks: [
        {
          type: "list",
          items: [
            "Dados financeiros lançados: enquanto a conta estiver ativa, respeitado o período de retenção do plano contratado, exibido na página de planos.",
            "Após o cancelamento ou encerramento da assinatura: 30 (trinta) dias corridos para permitir reativação e exportação, findos os quais os dados são eliminados ou anonimizados de forma irreversível.",
            "Arquivos de extrato importados: eliminados após o processamento e a confirmação da importação, ou em até 30 dias, o que ocorrer primeiro.",
            "Dados de cobrança, notas fiscais e histórico de pagamentos: 5 (cinco) anos, por obrigação fiscal e prescricional.",
            "Registros de acesso à aplicação: 6 (seis) meses, conforme o art. 15 do Marco Civil da Internet, podendo ser estendidos por determinação judicial.",
            "Registro do consentimento aos Termos e a esta Política (data, hora e versão aceita): enquanto durar a relação e pelo prazo prescricional aplicável, como prova exigida pelo art. 8º, §1º, da LGPD.",
          ],
        },
      ],
    },
    {
      id: "direitos-do-titular",
      title: "8. Seus direitos como titular",
      blocks: [
        {
          type: "paragraph",
          text: "O art. 18 da LGPD garante a você, gratuitamente, os direitos de:",
        },
        {
          type: "list",
          items: [
            "confirmar se tratamos seus dados e acessá-los;",
            "corrigir dados incompletos, inexatos ou desatualizados;",
            "solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;",
            "solicitar a portabilidade dos dados a outro fornecedor;",
            "obter a eliminação dos dados tratados com base em consentimento;",
            "ser informado sobre com quem compartilhamos seus dados;",
            "ser informado sobre a possibilidade de não consentir e as consequências disso;",
            "revogar o consentimento a qualquer momento;",
            "opor-se a tratamento fundado em legítimo interesse e pedir revisão de decisões automatizadas.",
          ],
        },
        {
          type: "paragraph",
          text: `Para exercer qualquer desses direitos, escreva para ${privacyEmail} a partir do e-mail cadastrado na conta. Responderemos em até 15 (quinze) dias, podendo solicitar informações adicionais para confirmar sua identidade e evitar que terceiros acessem seus dados. Alguns pedidos podem ser parcialmente recusados quando houver obrigação legal de retenção — nesse caso, explicaremos o motivo e a base.`,
        },
      ],
    },
    {
      id: "cookies",
      title: "9. Cookies e armazenamento local",
      blocks: [
        {
          type: "paragraph",
          text: "Utilizamos armazenamento local do navegador e cookies estritamente necessários para manter sua sessão autenticada, lembrar preferências de interface (como o tema claro ou escuro) e guardar temporariamente o plano selecionado antes do login. Esses recursos são indispensáveis ao funcionamento e não dependem de consentimento (art. 7º, V, LGPD).",
        },
        {
          type: "paragraph",
          text: "Não utilizamos cookies de publicidade comportamental de terceiros. Caso venhamos a adotar medição de audiência ou análise de uso, faremos por meio de dados agregados e informaremos previamente nesta Política. Você pode limpar o armazenamento local pelo próprio navegador, ciente de que isso encerrará sua sessão.",
        },
      ],
    },
    {
      id: "criancas",
      title: "10. Crianças e adolescentes",
      blocks: [
        {
          type: "paragraph",
          text: "A plataforma é destinada a maiores de 18 anos e não coleta intencionalmente dados de crianças ou adolescentes. Identificado cadastro dessa natureza, a conta é encerrada e os dados eliminados. Se você é responsável legal e suspeita de cadastro indevido, contate o Encarregado.",
        },
      ],
    },
    {
      id: "alteracoes-politica",
      title: "11. Alterações desta Política",
      blocks: [
        {
          type: "paragraph",
          text: "Esta Política pode ser atualizada a qualquer momento. A versão vigente, com número e data, fica sempre disponível dentro do sistema e em rota pública. Alterações materiais — nova finalidade, nova categoria de dado, novo operador relevante — serão comunicadas por e-mail e/ou aviso na plataforma com antecedência mínima de 30 dias, com novo aceite quando a mudança depender de consentimento.",
        },
        {
          type: "paragraph",
          text: `Dúvidas, solicitações ou reclamações sobre privacidade: ${privacyEmail}. Você também pode peticionar diretamente à Autoridade Nacional de Proteção de Dados (ANPD).`,
        },
      ],
    },
  ],
};
