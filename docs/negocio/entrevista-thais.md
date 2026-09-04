# Roteiro de entrevista — o que a Cora precisa saber sobre a MedConsultoria

> **Para quem lê isto:** este documento é o roteiro que o Thiago vai usar (ou repassar)
> para conversar com a Thaís. Ele não tem nada para preencher sozinho — as perguntas
> abaixo só a dona do negócio sabe responder de verdade, e a Cora não deve **nunca**
> inventar resposta para elas. O que já foi possível confirmar sozinho (site, PDFs da
> marca, sistema) está na Seção 1, só para não perguntar de novo o que já se sabe.
>
> **Tempo estimado:** 20–30 minutos, se for feito numa conversa só. Dá para responder por
> partes também — cada bloco da Seção 2 é independente.
>
> **O que acontece depois:** as respostas viram o texto fixo que a Cora carrega em
> **toda** conversa (`apps/server/src/engine/persona.ts`) — por isso a pergunta certa aqui
> vale mais do que qualquer ajuste de código depois.

---

## Sumário

1. [O que já sabemos, sem perguntar de novo](#1-o-que-já-sabemos-sem-perguntar-de-novo)
2. [Perguntas para a Thaís](#2-perguntas-para-a-thaís)
   - [A. Identidade e tom de voz](#a-identidade-e-tom-de-voz)
   - [B. Público e serviços](#b-público-e-serviços)
   - [C. Regras do processo de credenciamento](#c-regras-do-processo-de-credenciamento)
   - [D. O que a Cora pode e não pode dizer](#d-o-que-a-cora-pode-e-não-pode-dizer)
   - [E. Equipe e quem decide o quê](#e-equipe-e-quem-decide-o-quê)
   - [F. Glossário — termos que a Cora vai ouvir e usar](#f-glossário--termos-que-a-cora-vai-ouvir-e-usar)
   - [G. Prioridade — por onde a Cora ajuda primeiro](#g-prioridade--por-onde-a-cora-ajuda-primeiro)
3. [O que o sistema já faz hoje](#3-o-que-o-sistema-já-faz-hoje-contexto-não-é-pergunta)

---

## 1. O que já sabemos, sem perguntar de novo

Levantado em `medconsultoria.com.br`, no Manual da Marca, na Apresentação institucional e
nos dois documentos de credenciamento guardados no Workspace (`brand/identidade/`) —
**cada afirmação abaixo tem fonte**, e nenhuma foi inventada.

**O negócio.** A MedConsultoria é uma consultoria para clínicas e profissionais de saúde.
Frase de abertura da própria apresentação institucional: *"Nós, da MedConsultoria,
cuidamos de todos os processos da sua clínica e proporcionamos mais tempo e tranquilidade
para você fazer o que mais gosta: CUIDAR DE VIDAS."*

**Quatro frentes de serviço** (Apresentação institucional):
| Frente | O que inclui |
|---|---|
| Gestão Operacional | Mapeamento de recursos, organização do fluxo de atendimento, treinamento de equipe, monitoramento de resultados |
| Networking | Relacionamento com operadoras e médicos parceiros, negociação de contratos e tabelas, **credenciamento médico e odontológico** |
| Marketing | Identidade visual, manual da marca, sites e conteúdo com SEO |
| Faturamento | Auditoria, processamento, conciliação, recurso de glosa, relatórios gerenciais |

**A fundadora.** Thaís Garcia Fristachi, administradora de empresas, 20 anos de
experiência em saúde — foi executiva de relacionamento nas operadoras Omint, Lincx, One
Health e Prevent Senior antes de fundar a MedConsultoria. Assina propostas como
consultora comercial.

**O processo de credenciamento**, com regras comerciais explícitas (lidas de uma proposta
real de credenciamento junto à Omint):
- Honorário cobrado **só em caso de sucesso** (após a operadora assinar o contrato) —
  sem adiantamento, sem despesa extra.
- **Uma única tentativa** por operadora: depois de uma negativa, encerra — a não ser que
  se combine uma nova tentativa à parte.
- Documentação exigida em três blocos (PJ, clínica, pessoal) — inclui conselho
  profissional (CRM, mas também CRP, CRN, Crefito, CRFa: a MedConsultoria não atende só
  médico).
- Cláusula de confidencialidade sobre os dados dos profissionais.

**Identidade visual** (Manual da Marca, 2022): verde `#30AD73`, azul claro `#2DA8E1`, azul
escuro `#002463` (fundo), azul `#003591` (texto); tipografia Montserrat + uma fonte
própria ("Brother 1816") só no letreiro do logotipo. O manual é técnico — não fala de tom
de voz nem de valores.

## 2. Perguntas para a Thaís

### A. Identidade e tom de voz

1. Quando a Cora conversa com alguém (equipe ou cliente final), ela deve soar **formal**
   (como as propostas comerciais) ou **próxima/acolhedora** (como o texto do site, "cuidar
   de vidas")? Pode ser uma mistura — se for, em que situação pende para qual lado?
2. Tem alguma palavra ou expressão que a MedConsultoria **nunca usa** (por imagem, por
   regra do setor, ou porque soa errado)? E alguma que é praticamente uma marca registrada
   de vocês (algo que sempre aparece)?
3. A Cora deve se apresentar como "assistente da MedConsultoria" para todo mundo, ou isso
   muda dependendo de quem está do outro lado (equipe interna vs. cliente no Portal)?

### B. Público e serviços

4. O relatório levantado não achou uma definição clara de público-alvo — só inferiu pelos
   serviços (clínicas e profissionais de saúde). **Tem um recorte** (região, porte de
   clínica, especialidade que vocês priorizam ou evitam)?
5. A lista de operadoras encontrada nos documentos (Omint, Care Plus, Amil One, Lincx, One
   Health, Prevent Senior) é a lista **atual** de operadoras parceiras, ou a MedConsultoria
   negocia com qualquer operadora sob demanda do cliente?
6. Hoje, das quatro frentes (Gestão Operacional, Networking/Credenciamento, Marketing,
   Faturamento), qual é a que mais gera trabalho no dia a dia — e é aquela que a Cora
   deveria conhecer com mais profundidade primeiro?

### C. Regras do processo de credenciamento

7. O valor de honorário visto no exemplo (R$ 2.000,00) e a regra de "uma tentativa só"
   ainda valem exatamente assim hoje, ou variam por operadora/cliente? Se variam, a Cora
   **nunca** deve citar um valor — só confirma isso?
8. Existe uma sequência de status do credenciamento que a equipe usa por fora do sistema
   (ex.: "a protocolar → protocolado → em análise → aprovado/negado") que a Cora deveria
   reconhecer quando alguém mencionar em texto livre?
9. Quando um credenciamento é negado, o que a MedConsultoria costuma orientar o cliente a
   fazer — tentar outra operadora, esperar um tempo, ajustar documentação?

### D. O que a Cora pode e não pode dizer

10. Existe alguma promessa que a MedConsultoria **nunca** faz (ex.: prazo fechado de
    aprovação, garantia de credenciamento, valor final antes de negociar)? Isso é o tipo
    de regra que vai virar instrução fixa da Cora — quanto mais explícita, melhor.
11. Se alguém perguntar algo que foge do que a Cora sabe (preço, prazo, decisão
    comercial), qual é a resposta certa: "não sei, vou verificar com a equipe" ou
    encaminhar para uma pessoa específica?
12. Tem algum assunto que a Cora **nunca** deve tratar sozinha, mesmo que pareça simples
    (ex.: cancelamento de contrato, reclamação, dado de outro cliente)?

### E. Equipe e quem decide o quê

13. Além de você, quem mais na MedConsultoria vai usar a Cora no dia a dia — e para
    o quê cada pessoa? (Isso ajuda a saber se a Cora precisa reconhecer papéis diferentes.)
14. Quando a Cora tiver dúvida sobre algo que só uma pessoa da equipe sabe responder,
    para quem ela direciona?

### F. Glossário — termos que a Cora vai ouvir e usar

15. Veja a lista abaixo, montada do que já foi encontrado nos documentos. Tem algum termo
    errado, faltando, ou usado de outro jeito na prática?

| Termo | Definição levantada |
|---|---|
| Credenciamento | Vincular um médico/clínica a uma operadora de saúde |
| Operadora | Empresa de plano de saúde/convênio |
| Glosa / recurso de glosa | Contestação de valor não pago (ou reduzido) pela operadora |
| CNES | Cadastro Nacional dos Estabelecimentos de Saúde |
| Responsável técnico | Profissional responsável perante o Conselho pela clínica |
| Networking | Frente comercial de relacionamento com operadoras e médicos parceiros |

### G. Prioridade — por onde a Cora ajuda primeiro

16. Hoje a Cora só sabe consultar e criar tarefa no sistema interno. Pensando nas quatro
    frentes do negócio, **qual tarefa do seu dia a dia você mais gostaria de tirar das suas
    costas primeiro?** (Essa resposta não muda o texto fixo da Cora — mas decide o que
    a gente constrói a seguir, depois desta entrevista.)

## 3. O que o sistema já faz hoje (contexto, não é pergunta)

Levantado direto do código do Workspace (`workspace-medconsultoria`), para dar uma ideia
do tamanho real da aplicação por trás do negócio — a Thaís não precisa confirmar nada
disto, é só para situar quem for revisar este documento depois.

**Área da equipe** (login interno): Dashboard, Clientes (CRM), Credenciamentos, Leads
(funil), Serviços, Projetos, Agenda, Tarefas, Financeiro, Mensagens, E-mail, Documentos
(+ Modelos de documento), Configurações, Usuários, Administração de e-mails, Ajustes,
Sistema (acesso restrito).

**Portal do cliente** (login separado): Início, Documentos, Credenciamento, Serviços,
Suporte, Equipe.

**Já existe geração por IA dentro do Workspace** (`apps/api/src/lib/ai.ts`): rascunho de
texto e transcrição de áudio — mas isso é interno ao Workspace, roda com **outro**
provedor de IA (o Workspace foi pedir a configuração do Gemini para nós, sinal de que
estão migrando), e não tem nenhuma relação direta com a Cora.
