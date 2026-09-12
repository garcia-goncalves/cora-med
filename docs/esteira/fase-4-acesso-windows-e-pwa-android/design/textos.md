## textos

Todo texto visível da interface da Fase 4 (tela de login, chat, PWA, app Windows), mais os
dados de demonstração. Convenções: nenhuma palavra em inglês na interface; botão nomeia a
ação; erro diz o que fazer; os cinco estados do resumo operacional (`resumo.ts`) nunca se
fundem. Vocabulário fixo: **"pendência"** (não "tarefa" na interface, mesmo que o dado interno
use `InboxItem`/status — a pessoa não vê schema), **"entrar"** (nunca "login"), **"mensagem"**
(nunca "chat" como substantivo na UI, só como nome do produto quando necessário).

---

### Tela de login

Campos:
- Rótulo do campo de e-mail: `E-mail`
- Rótulo do campo de senha: `Senha`
- Texto de ajuda abaixo do campo de e-mail (fixo, antes de qualquer erro): `Use o e-mail cadastrado pelo administrador.`
- Botão principal: `Entrar`
- Botão em estado de carregamento (texto muda, botão desabilitado): `Entrando…`

Erros (aparecem junto do formulário, não em alerta solto no topo — e nunca dizem qual dos dois campos errou, por segurança):
- Senha ou e-mail errados: `E-mail ou senha não conferem. Confira os dois campos e tente de novo.`
- Conta bloqueada por tentativas: `Conta bloqueada por excesso de tentativas. Espere alguns minutos e tente de novo. Se continuar bloqueada, fale com o administrador.`
- Campo de e-mail vazio ao tentar entrar: `Digite seu e-mail para entrar.`
- Campo de senha vazio ao tentar entrar: `Digite sua senha para entrar.`
- Servidor fora do ar durante o login: `Não conseguimos falar com o servidor agora. Verifique sua conexão e tente de novo.`

Nota de implementação (para quem constrói a tela, não é texto de interface): o campo de senha
não deve mostrar "pontos preenchidos" residuais de uma tentativa anterior depois de um erro —
limpar o campo ou deixar claro que está vazio, para não repetir o fracasso já documentado em
`LoginPage.tsx` do Workspace. Mesma cautela com autofill: se o navegador preencher e-mail e
senha de outra conta, a pessoa precisa perceber isso antes de clicar em "Entrar" — o rótulo
do e-mail preenchido deve ficar visível e legível, nunca escondido atrás do próprio valor.

---

### Tela principal de chat

Cabeçalho:
- Nome do produto na barra superior: `Cora`
- Legenda abaixo do nome (opcional, se houver espaço): `Assistente da MedConsultoria`

Estado vazio — primeira vez aqui (antes de qualquer mensagem):
```
Oi! Eu sou a Cora.
Pergunte "como estão minhas pendências" ou me escreva livremente.
```
Campo de entrada, texto de exemplo (placeholder, some ao digitar): `Escreva uma mensagem…`
Botão de enviar: `Enviar`

Mensagem enviando (aparece junto da mensagem da própria pessoa, enquanto não confirma):
`Enviando…`

Mensagem com erro de envio (a mensagem continua visível, com aviso e ação ao lado — nunca some):
```
Não foi enviada. A conexão falhou no meio do caminho.
[Tentar de novo]
```
Nota: o texto digitado não pode ser perdido — se a pessoa reabrir o rascunho, ele continua lá.

Resposta chegando (indicador de "pensando", já que streaming está fora de escopo):
`Cora está digitando…`

Campo de entrada desabilitado durante o envio (texto de apoio, se necessário): `Aguarde a resposta anterior.`

---

### Os 5 estados do resumo operacional, como citados na conversa

Estes textos vêm do motor (`resumo.ts`, `descreverResumo`) e a tela exibe a frase como
mensagem da Cora, sem reescrever o conteúdo — só formata a moldura da bolha de chat. Listados
aqui para conferência de tom e para os dados de demonstração abaixo baterem com eles.

1. **`erro_de_acesso`** (chip vermelho, ícone de alerta, rótulo `Erro de acesso`):
   > Não consegui consultar tudo: [frase da fonte que falhou]. Isso NÃO quer dizer que você
   > esteja sem pendências — só que não dá para confirmar agora.

2. **`sincronizacao_incompleta`** (chip âmbar preenchido, ícone de relógio, rótulo `Sincronização incompleta`):
   > Vi só parte das suas tarefas (li [N] página(s) e parei). A lista abaixo pode estar
   > faltando item:

3. **`sem_registros`** (chip neutro, sem ícone de alerta, rótulo `Sem registros`):
   > Consultei a lista inteira e o Workspace não devolveu nenhuma tarefa.

4. **`sem_pendencias`** (chip verde, ícone de check, rótulo `Sem pendências`):
   > Consultei a lista inteira: há [N] tarefa(s), e nenhuma está parada esperando por você.

5. **`com_pendencias`** (chip teal, ícone de lista, rótulo `Com pendências`):
   > Você tem [N] tarefa(s) pendente(s):

Regra de exibição herdada do `design.md`: o chip mostra sempre ícone + rótulo em texto — a cor
é reforço, nunca o único sinal (`com_pendencias` e a cor primária são vizinhas de matiz de
propósito).

---

### Erro de conexão

PWA sem internet (banner fixo no topo da tela, some quando a conexão volta):
`Sem conexão com a internet. Suas mensagens serão enviadas quando ela voltar.`

Servidor fora do ar (ao tentar enviar mensagem ou abrir o app, com conexão de internet normal):
```
Não conseguimos falar com o servidor da Cora agora.
Tente de novo em alguns minutos.
[Tentar de novo]
```

Sessão expirada (ao tentar enviar mensagem depois de tempo sem uso):
```
Sua sessão expirou por segurança.
[Entrar de novo]
```

---

### Tela de "instale para acesso rápido" do PWA (prompt de instalação Android)

Título: `Instalar a Cora no seu celular`
Corpo: `Acesse mais rápido, direto da tela inicial, sem abrir o navegador.`
Botão principal: `Instalar`
Botão secundário: `Agora não`

Nome do app na tela inicial (campo `short_name` do manifest, visível embaixo do ícone): `Cora`
Nome completo do app (campo `name` do manifest, visível na loja/instalação): `Cora — Assistente da MedConsultoria`

---

### Mensagem de primeira execução do app Windows (aviso do SmartScreen)

Tela ou papel entregue junto do instalador, antes de a pessoa clicar em qualquer coisa:

```
Antes de instalar a Cora

O Windows vai mostrar um aviso azul chamado "O Windows protegeu o computador".
Isso é esperado — o instalador é novo e ainda não é conhecido do Windows, mas
foi enviado por nós.

O que fazer:
1. Na tela azul, clique em "Mais informações".
2. Clique em "Executar assim mesmo".
3. Siga a instalação normalmente.

Se aparecer qualquer outra mensagem, ou se tiver dúvida, entre em contato antes de continuar.
```

Texto curto, para dentro do próprio instalador (se houver tela de boas-vindas do Tauri):
`Bem-vindo à instalação da Cora. Clique em Avançar para continuar.`

---

### Rodapé/menu: sair da conta, trocar de usuário

Item de menu — encerrar sessão: `Sair da conta`
Confirmação ao clicar em "Sair da conta" (ação de baixo risco — reversível com novo login, então confirmação simples, não exige digitar nome):
```
Sair da conta da Cora?
Você vai precisar entrar de novo para continuar usando.
[Cancelar]  [Sair]
```

Item de menu — trocar de usuário (quando duas contas estão configuradas no mesmo aparelho): `Trocar de usuário`
Ao trocar, tela de confirmação curta:
```
Trocar de usuário?
A conversa atual não fica salva — ela é apagada ao sair.
[Cancelar]  [Trocar]
```

Rótulo do nome da conta logada, no rodapé/menu (exemplo de dado real do sistema, não é dado de demonstração): `[nome da pessoa] · [e-mail]`

---

## dados de demonstração

Fixtures de interface para telas de exemplo, capturas de tela e desenvolvimento local. Todo
identificador segue o prefixo `SYNTH-` do restante do repositório. Nenhum nome, convênio ou
horário aqui corresponde a pessoa ou clínica real.

### Contas de demonstração (login)

| Nome | E-mail | Papel |
|---|---|---|
| Thaís Amaral Bezerra | `SYNTH-thais@clinica-demo.teste` | fundadora |
| Rogério Vasconcelos Lima | `SYNTH-rogerio@clinica-demo.teste` | administrador |

### Pendências de exemplo (estado `com_pendencias`)

```
- Retorno de Dra. Camila Bittencourt Teixeira, convênio Amparo Saúde, 14h30
  [PENDENTE, prioridade alta, id SYNTH-TASK-0142, fonte workspace:tasks]
- Encaixe de avaliação inicial, convênio particular, aguardando confirmação de horário
  [PENDENTE, prioridade média, id SYNTH-TASK-0143, fonte workspace:tasks]
- Renovação de credenciamento com convênio Vitalis Planos de Saúde
  [PENDENTE, prioridade alta, id SYNTH-TASK-0144, fonte workspace:tasks]
- Confirmação de exame de imagem para retorno de segunda-feira
  [PENDENTE, prioridade baixa, id SYNTH-TASK-0145, fonte workspace:tasks]
```

Frase de exemplo completa, como apareceria na conversa:
> Você tem 4 tarefa(s) pendente(s):
>
> Fonte workspace:tasks:
> - Retorno de Dra. Camila Bittencourt Teixeira, convênio Amparo Saúde, 14h30 [PENDENTE, prioridade alta, id SYNTH-TASK-0142, fonte workspace:tasks]
> - Encaixe de avaliação inicial, convênio particular, aguardando confirmação de horário [PENDENTE, prioridade média, id SYNTH-TASK-0143, fonte workspace:tasks]
> - Renovação de credenciamento com convênio Vitalis Planos de Saúde [PENDENTE, prioridade alta, id SYNTH-TASK-0144, fonte workspace:tasks]
> - Confirmação de exame de imagem para retorno de segunda-feira [PENDENTE, prioridade baixa, id SYNTH-TASK-0145, fonte workspace:tasks]

### Exemplo de item com procedimento e horário (para telas de conversa livre)

```
- Consulta de retorno — Cardiologia, convênio Amparo Saúde, 09h00, sala 2
  [FAZENDO, prioridade média, id SYNTH-TASK-0151, fonte workspace:tasks]
- Primeira consulta — Ortopedia, particular, 11h15
  [PENDENTE, prioridade alta, id SYNTH-TASK-0152, fonte workspace:tasks]
```

### Exemplo de mensagem livre da pessoa, para captura de tela da conversa

`Quais convênios têm consulta marcada essa semana?`

### Exemplo de resposta livre da Cora (curta, sem markdown, conforme fora_de_escopo)

`Essa semana há consultas marcadas para Amparo Saúde e Vitalis Planos de Saúde, além de dois atendimentos particulares. Quer que eu liste os horários?`

### Exemplo de erro de fonte (para o estado `erro_de_acesso` em captura de tela)

`Não consegui acessar o Workspace agora — a conexão falhou.`
