import { LEGAL_CONTROLLER, type LegalDocument } from "./legal-types";

const { productName, legalName, supportEmail, privacyEmail } = LEGAL_CONTROLLER;

/**
 * Termos de Uso do Orbi.
 *
 * Vetores de risco endereçados explicitamente, porque são os que existem de
 * fato neste produto: (a) o Orbi não é instituição financeira e não movimenta
 * dinheiro; (b) há classificação automática por IA cujo resultado é sugestão,
 * não assessoria; (c) a cobrança da assinatura roda em gateway de terceiro
 * (Asaas); (d) os limites de plano são aplicados no banco e sua burla é
 * violação contratual.
 */
export const TERMS_OF_USE: LegalDocument = {
  slug: "terms-of-use",
  path: "/legal/termos-de-uso",
  appPath: "/sistema/legal/termos-de-uso",
  title: "Termos de Uso",
  shortTitle: "Termos de Uso",
  eyebrow: "Documentos legais",
  version: "1.0",
  updatedAt: "2026-09-10",
  summary:
    "Regras do contrato entre você e o Orbi: o que a plataforma faz, o que ela não faz, como funcionam assinatura, cancelamento e reembolso, e quais são os limites de responsabilidade — inclusive das funcionalidades de inteligência artificial.",
  sections: [
    {
      id: "aceite",
      title: "1. Aceite dos Termos e capacidade para contratar",
      blocks: [
        {
          type: "paragraph",
          text: `Estes Termos de Uso regem o acesso e o uso da plataforma ${productName}, oferecida por ${legalName} ("${productName}", "nós"). Ao marcar a caixa de aceite no cadastro, ao contratar um plano ou ao continuar utilizando a plataforma, você declara ter lido, compreendido e concordado integralmente com estes Termos e com a Política de Privacidade, que é parte inseparável deste contrato.`,
        },
        {
          type: "paragraph",
          text: "O uso da plataforma é permitido apenas a pessoas maiores de 18 anos, plenamente capazes, ou a pessoas jurídicas representadas por quem tenha poderes para contratar. Se você não concorda com qualquer cláusula, não crie conta e não utilize o serviço.",
        },
        {
          type: "paragraph",
          text: "O aceite é registrado com data, hora e versão do documento aceito. Você pode consultar a versão vigente a qualquer momento dentro do sistema, em Configurações › Documentos legais.",
        },
      ],
    },
    {
      id: "o-que-e-o-orbi",
      title: "2. O que o Orbi é — e o que ele não é",
      blocks: [
        {
          type: "paragraph",
          text: `O ${productName} é um software de organização e planejamento financeiro pessoal e familiar, fornecido no modelo SaaS (software como serviço). Ele permite registrar contas, cartões de crédito, categorias, pessoas, lançamentos, parcelamentos, despesas recorrentes e rateios; importar extratos em CSV, PDF ou imagem; e visualizar saldos atuais e projetados a partir dos dados que você mesmo informa.`,
        },
        {
          type: "callout",
          text: `O ${productName} NÃO é instituição financeira, banco, corretora, administradora de cartões, meio de pagamento nem consultoria de investimentos. A plataforma não movimenta dinheiro, não paga contas, não quita faturas, não emite cobranças em seu nome e não se conecta às suas contas bancárias para executar transações.`,
        },
        {
          type: "list",
          items: [
            "Saldos, projeções e faturas exibidos são cálculos sobre os dados que você lançou ou importou — não são extratos oficiais e não substituem o extrato do seu banco ou a fatura da administradora do cartão.",
            "O campo que vincula um cartão de crédito a uma conta pagadora é informativo: não existe débito automático da fatura pelo Orbi.",
            "Nada exibido na plataforma constitui recomendação de investimento, aconselhamento jurídico, contábil ou tributário.",
            "Divergências entre o que você registrou no Orbi e o que consta na sua instituição financeira prevalecem sempre a favor da instituição financeira.",
          ],
        },
      ],
    },
    {
      id: "conta-e-seguranca",
      title: "3. Cadastro, conta e segurança de acesso",
      blocks: [
        {
          type: "paragraph",
          text: "A conta é pessoal e intransferível. Você é responsável pela veracidade dos dados informados no cadastro, pela guarda da sua senha e por toda atividade realizada com suas credenciais.",
        },
        {
          type: "list",
          items: [
            "Não compartilhe credenciais. O compartilhamento de finanças com outra pessoa deve ser feito pelos recursos próprios da plataforma, e não pela cessão de senha.",
            "Comunique imediatamente qualquer uso não autorizado da sua conta pelo canal indicado na cláusula de contato.",
            `Cada conta opera sobre dados isolados por usuário no banco de dados, com regras de acesso aplicadas no servidor (Row Level Security). Ainda assim, o ${productName} não responde por acessos decorrentes de senha fraca, reutilizada ou entregue a terceiros.`,
            "Podemos exigir verificação de e-mail e aplicar limites de requisição (rate limiting) e outras medidas antiabuso para proteger a plataforma.",
          ],
        },
      ],
    },
    {
      id: "planos-e-limites",
      title: "4. Planos, funcionalidades e limites de uso",
      blocks: [
        {
          type: "paragraph",
          text: "A plataforma é oferecida em planos com conjuntos distintos de funcionalidades e limites quantitativos — número de contas, cartões, categorias, pessoas, lançamentos por mês e período de retenção de dados, entre outros. Os limites do seu plano ficam descritos na página de planos e são aplicados também no servidor.",
        },
        {
          type: "list",
          items: [
            "Tentar contornar limites de plano por chamadas diretas à API, automações, múltiplas contas para uma mesma pessoa ou qualquer artifício equivalente é violação contratual e autoriza suspensão imediata.",
            "Podemos criar, alterar, renomear ou descontinuar funcionalidades e planos. Alterações que reduzam materialmente o que você contratou serão comunicadas com antecedência mínima de 30 dias, e você poderá cancelar sem ônus antes de sua vigência.",
            "Funcionalidades marcadas como beta, experimentais ou em pré-visualização são oferecidas no estado em que se encontram e podem ser removidas sem aviso.",
          ],
        },
      ],
    },
    {
      id: "pagamentos",
      title: "5. Assinatura, cobrança e processamento de pagamentos (Asaas)",
      blocks: [
        {
          type: "paragraph",
          text: "Planos pagos são cobrados em reais (BRL), no ciclo escolhido no momento da contratação (mensal ou anual), pelo preço vigente exibido na tela de planos antes da confirmação.",
        },
        {
          type: "paragraph",
          text: "O processamento financeiro é realizado pela Asaas Gestão Financeira S.A., instituição de pagamento contratada como operadora. A confirmação, a captura e a liquidação do pagamento ocorrem no ambiente da Asaas, sujeitos também aos termos dela. Dados completos de cartão de crédito são digitados e armazenados no ambiente do gateway — o Orbi não recebe, não processa e não armazena número completo de cartão, CVV ou senha de banco.",
        },
        {
          type: "list",
          items: [
            "A assinatura é renovada automaticamente ao fim de cada ciclo, pelo preço então vigente, até que você cancele.",
            "Reajustes de preço são comunicados com no mínimo 30 dias de antecedência e só se aplicam a ciclos iniciados após a comunicação.",
            "Meios de pagamento disponíveis (PIX, boleto e cartão de crédito) podem variar conforme a disponibilidade do gateway.",
            "Falhas de comunicação do gateway podem atrasar a liberação do acesso; o acesso é liberado automaticamente após a confirmação recebida do processador.",
            "A emissão de documento fiscal, quando aplicável, segue a legislação brasileira e utiliza os dados cadastrais informados por você.",
          ],
        },
      ],
    },
    {
      id: "teste-cancelamento-reembolso",
      title: "6. Teste, cancelamento, arrependimento e estorno",
      blocks: [
        {
          type: "paragraph",
          text: "Não há fidelidade nem multa de cancelamento. O cancelamento pode ser solicitado a qualquer momento pela própria plataforma ou pelo canal de suporte.",
        },
        {
          type: "list",
          items: [
            "Direito de arrependimento (art. 49 do Código de Defesa do Consumidor): contratações feitas fora de estabelecimento físico podem ser desfeitas em até 7 (sete) dias corridos contados da contratação, com devolução integral do valor pago, pelo mesmo meio de pagamento.",
            "Após os 7 dias: no ciclo mensal, o cancelamento encerra a renovação e o acesso permanece ativo até o fim do período já pago, sem reembolso proporcional. No ciclo anual, o cancelamento após o 7º dia dá direito a reembolso proporcional aos meses cheios ainda não usufruídos, descontados eventuais custos de transação já suportados.",
            "Se um período de teste gratuito for oferecido, o cancelamento antes do término do teste não gera qualquer cobrança.",
            "Estornos são processados pelo mesmo gateway e podem levar até 2 (dois) ciclos de fatura do emissor do cartão para aparecer no seu extrato — prazo que não está sob controle do Orbi.",
            "O rebaixamento para um plano com limites menores pode tornar indisponíveis registros que excedam o novo limite; nenhum dado é apagado por esse motivo antes dos prazos da cláusula seguinte.",
          ],
        },
      ],
    },
    {
      id: "inadimplencia",
      title: "7. Inadimplência, suspensão e encerramento",
      blocks: [
        {
          type: "list",
          items: [
            "Não confirmado o pagamento no vencimento, o acesso às funcionalidades pagas pode ser suspenso, mantendo-se o acesso à tela de regularização.",
            "Persistindo a inadimplência por mais de 30 dias, a assinatura pode ser encerrada.",
            "Após o encerramento, seus dados permanecem recuperáveis por 30 (trinta) dias corridos, período em que você pode reativar a assinatura ou solicitar exportação. Vencido esse prazo, os dados podem ser eliminados de forma irreversível, ressalvadas as retenções legais descritas na Política de Privacidade.",
            "Você pode solicitar a exportação dos seus dados a qualquer momento, inclusive durante a suspensão.",
          ],
        },
      ],
    },
    {
      id: "inteligencia-artificial",
      title: "8. Funcionalidades de inteligência artificial e classificação automática",
      blocks: [
        {
          type: "paragraph",
          text: "A plataforma oferece recursos de classificação automática de lançamentos, sugestão de categorias, leitura de extratos (incluindo reconhecimento óptico de caracteres) e detecção de padrões recorrentes. Esses recursos combinam heurísticas próprias, dicionários de estabelecimentos, padrões aprendidos a partir das suas próprias correções e, em determinadas funcionalidades, modelos de linguagem executados por provedores terceiros contratados como operadores.",
        },
        {
          type: "callout",
          text: "Todo resultado produzido por inteligência artificial é SUGESTÃO, sujeita a erro, e deve ser conferido por você antes de ser usado para qualquer decisão. O Orbi não garante exatidão, completude ou adequação de classificações, leituras de documentos, projeções ou textos gerados automaticamente, e não responde por decisões financeiras tomadas com base neles.",
        },
        {
          type: "list",
          items: [
            "Você permanece responsável por revisar categorias, valores, datas e vínculos sugeridos automaticamente antes de considerá-los corretos.",
            "A leitura automática de extratos em PDF, CSV ou imagem depende da qualidade do arquivo enviado; erros de OCR, colunas invertidas, duplicidades e valores truncados são possíveis e devem ser conferidos na tela de revisão antes da importação.",
            "As sugestões não constituem análise de crédito, score, decisão sobre concessão de crédito nem qualquer avaliação de perfil com efeitos jurídicos. Nenhuma decisão com efeito jurídico sobre você é tomada exclusivamente por meio automatizado dentro da plataforma.",
            "Você não deve inserir nas funcionalidades de IA dados de terceiros que não possa legitimamente tratar, nem dados sensíveis (saúde, biometria, convicções) — a plataforma não foi desenhada para essa finalidade.",
            "O tratamento dos dados por esses recursos, inclusive o compartilhamento com provedores de modelo, está descrito na Política de Privacidade.",
          ],
        },
      ],
    },
    {
      id: "uso-aceitavel",
      title: "9. Uso aceitável e condutas vedadas",
      blocks: [
        { type: "paragraph", text: "É vedado, a qualquer título:" },
        {
          type: "list",
          items: [
            "tentar acessar dados de outro usuário, explorar falhas de autorização, injetar comandos SQL, scripts ou payloads maliciosos em campos da aplicação, ou testar segurança sem autorização escrita prévia;",
            "realizar engenharia reversa, descompilação ou extração do código-fonte, salvo nos limites autorizados por lei;",
            "automatizar acessos, raspar dados em massa, sobrecarregar a infraestrutura ou burlar limites de requisição;",
            "revender, sublicenciar, hospedar ou oferecer a plataforma a terceiros como se fosse serviço próprio;",
            "usar a plataforma para atividade ilícita, lavagem de dinheiro, fraude, ou para tratar dados pessoais de terceiros sem base legal;",
            "inserir conteúdo que viole direitos de terceiros ou que contenha malware.",
          ],
        },
        {
          type: "paragraph",
          text: "A constatação de qualquer dessas condutas autoriza a suspensão imediata da conta, sem reembolso do período em curso, e a adoção das medidas legais cabíveis. Falhas de segurança encontradas de boa-fé devem ser comunicadas de forma reservada para " + supportEmail + ", sem exploração, divulgação pública ou acesso a dados de terceiros.",
        },
      ],
    },
    {
      id: "propriedade-intelectual",
      title: "10. Propriedade intelectual e propriedade dos seus dados",
      blocks: [
        {
          type: "paragraph",
          text: `O software, a marca, a identidade visual, a interface, o código-fonte, os dicionários de classificação e a documentação do ${productName} são de titularidade exclusiva de ${legalName} e protegidos pela Lei nº 9.610/1998 e pela Lei nº 9.609/1998. O contrato concede apenas licença de uso pessoal, limitada, revogável e não exclusiva, enquanto vigente a assinatura.`,
        },
        {
          type: "paragraph",
          text: "Os dados financeiros que você registra ou importa continuam sendo seus. Você nos concede apenas a licença estritamente necessária para hospedar, processar, exibir, calcular, classificar e fazer cópia de segurança desses dados, com a finalidade de prestar o serviço contratado. Sugestões de melhoria enviadas voluntariamente podem ser implementadas sem gerar remuneração ou direito de coautoria.",
        },
      ],
    },
    {
      id: "disponibilidade",
      title: "11. Disponibilidade, manutenção e backup",
      blocks: [
        {
          type: "paragraph",
          text: "O serviço é prestado em regime de melhores esforços, sem garantia de disponibilidade ininterrupta. Janelas de manutenção programada serão comunicadas com antecedência sempre que possível; manutenções emergenciais podem ocorrer sem aviso.",
        },
        {
          type: "list",
          items: [
            "Rotinas de backup são mantidas pela infraestrutura de banco de dados contratada, mas não substituem a sua própria exportação periódica de dados.",
            "Interrupções causadas por terceiros (provedor de nuvem, gateway de pagamento, provedor de IA, operadora de internet) ou por caso fortuito e força maior não geram dever de indenizar.",
          ],
        },
      ],
    },
    {
      id: "limitacao-de-responsabilidade",
      title: "12. Limitação de responsabilidade",
      blocks: [
        {
          type: "paragraph",
          text: "Respeitados os direitos irrenunciáveis do consumidor previstos na legislação brasileira, e ressalvadas as hipóteses de dolo, o Orbi não responde por lucros cessantes, perda de oportunidade, danos indiretos, prejuízos decorrentes de decisões financeiras tomadas com base em dados lançados incorretamente, em sugestões automáticas não conferidas, ou em indisponibilidade temporária do serviço.",
        },
        {
          type: "paragraph",
          text: "Nas hipóteses em que houver dever de indenizar, a responsabilidade total fica limitada ao valor efetivamente pago por você pela assinatura nos 12 (doze) meses anteriores ao evento que deu causa ao pedido.",
        },
      ],
    },
    {
      id: "suporte",
      title: "13. Suporte e comunicações",
      blocks: [
        {
          type: "paragraph",
          text: `O suporte é prestado por e-mail em ${supportEmail} e pelo canal de relato de problemas dentro da plataforma, em dias úteis. Comunicações contratuais e avisos de alteração destes Termos são enviados para o e-mail cadastrado e/ou exibidos na própria plataforma — mantenha seu e-mail atualizado.`,
        },
      ],
    },
    {
      id: "alteracoes",
      title: "14. Alterações destes Termos",
      blocks: [
        {
          type: "paragraph",
          text: "Estes Termos podem ser alterados para refletir mudanças legais, técnicas ou de produto. Alterações materiais serão comunicadas com antecedência mínima de 30 dias e exigirão novo aceite no primeiro acesso após a vigência. A continuidade do uso após esse prazo, sem manifestação contrária, implica concordância com a nova versão. Cada versão publicada indica número e data no topo do documento.",
        },
      ],
    },
    {
      id: "rescisao",
      title: "15. Rescisão",
      blocks: [
        {
          type: "list",
          items: [
            "Por você: a qualquer tempo, nos termos da cláusula 6.",
            "Por nós: em caso de violação destes Termos, inadimplência, uso fraudulento, ordem judicial ou descontinuidade do serviço — hipótese em que devolveremos proporcionalmente o valor do período pago e não usufruído, com aviso prévio de 30 dias sempre que a descontinuidade for planejada.",
            "Encerrado o contrato, cessa a licença de uso e aplicam-se os prazos de retenção e eliminação previstos na Política de Privacidade.",
          ],
        },
      ],
    },
    {
      id: "lei-e-foro",
      title: "16. Legislação aplicável e foro",
      blocks: [
        {
          type: "paragraph",
          text: "Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial o Código Civil, o Código de Defesa do Consumidor (Lei nº 8.078/1990), o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Fica eleito o foro do domicílio do consumidor para dirimir controvérsias, sem prejuízo do uso de plataformas oficiais de solução de conflitos.",
        },
        {
          type: "paragraph",
          text: `Dúvidas sobre estes Termos: ${supportEmail}. Assuntos de proteção de dados: ${privacyEmail}.`,
        },
      ],
    },
  ],
};
