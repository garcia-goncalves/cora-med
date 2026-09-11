# Publicação manual na TineHost

Este documento **escreve, não executa.** Ninguém rodou este roteiro ainda — nenhum passo
abaixo aconteceu. Executá-lo é trabalho de outra sessão, **com o sim do dono**, e nunca
por push automático (ver "O que esta fase não faz" no fim).

Baseado no processo real já usado no mesmo provedor para o site institucional:
`C:\Users\Desktop\source\repos\medconsultoria-bkp\DEPLOY.md` (DirectAdmin Node.js App
Selector, CloudLinux). A Cora usa a mesma peça de painel, com uma aplicação nova.

## 0. Antes de tudo: testar o `@node-rs/argon2` no servidor (risco 1 do plano)

`@node-rs/argon2` é binário nativo pré-compilado. A TineHost é hospedagem compartilhada
(CloudLinux Node.js Selector) e não há acesso para confirmar de antemão que o binário
`linux-x64-gnu` sobe lá. **Não publique a aplicação inteira sem testar isto primeiro:**

```bash
cd /caminho/da/aplicacao
node -e "require('@node-rs/argon2').hashSync('teste')"
```

- **Se imprimir um hash** (começa com `$argon2id$`): o binário funciona, siga para a
  seção 1.
- **Se falhar** (erro de módulo nativo/plataforma): plano B nomeado no plano da fase —
  trocar a implementação por argon2id em WASM, mudança de **um arquivo**
  (`apps/server/src/auth/senha.ts`, atrás da porta `PortaDeHashDeSenha`). Pare e reporte
  antes de prosseguir; não force a publicação com login quebrado.

## 1. Build local (na máquina de quem publica, nunca no servidor)

```bash
cd C:\Users\Desktop\source\repos\cora-med
pnpm install
pnpm run test
pnpm run typecheck
pnpm --filter @cora/server run build   # gera apps/server/dist/servidor.mjs
pnpm --filter @cora/web run build      # gera apps/web/dist/
```

`servidor.mjs` é um único arquivo — o bundler (`esbuild`) embute `@cora/contracts`,
`@cora/policy`, `@cora/workspace-client` e `zod`. Ficam **de fora** do bundle (continuam
como dependência de runtime normal, instalada no servidor): `@node-rs/argon2` (binário
nativo, não pode ser embutido) e `@anthropic-ai/sdk`.

## 2. Criar o subdomínio e o certificado

1. No painel DirectAdmin, criar o subdomínio **`cora.medconsultoria.com.br`**
   (recomendado — mantém o domínio principal livre para o site institucional).
2. Emitir o certificado **Let's Encrypt pelo painel** (seção SSL do DirectAdmin) para o
   subdomínio novo. Sem isso o cookie de sessão com `Secure` (padrão, ver
   `docs/OPERATIONS.md`) não é aceito por nenhum navegador em produção.

## 3. Enviar os arquivos

Estrutura no servidor (dentro da pasta da aplicação):

```
/domains/medconsultoria.com.br/cora/
├── dist/                    # apps/server/dist/servidor.mjs (build da Etapa 2)
├── web/                     # conteúdo de apps/web/dist/ (a SPA)
├── package.json             # apenas as dependências de runtime do @cora/server
├── package-lock.json / pnpm-lock.yaml
└── .env                     # criado no servidor, nunca enviado por upload
```

**Arquivos a enviar:** `apps/server/dist/servidor.mjs`, `apps/server/package.json`
(só precisa das `dependencies`, não das `devDependencies`), o lockfile, e todo o
conteúdo de `apps/web/dist/` para a pasta que `CORA_RAIZ_ESTATICA` vai apontar.

**Não enviar:** `node_modules` (instalado no servidor pelo botão "Install" — seção 5),
`.env`, código-fonte TypeScript, nada de `apps/desktop`.

## 4. Criar a aplicação Node.js no DirectAdmin

1. Painel DirectAdmin → **"Node.js App"** (Node.js App Selector).
2. **Criar nova aplicação:**
   - **Application Root**: a pasta do passo 3 (ex.:
     `/domains/medconsultoria.com.br/cora/`).
   - **Application URL**: `cora.medconsultoria.com.br`.
   - **Application Startup File**: `dist/servidor.mjs`.
   - **Node.js Version**: **20.x** (a mesma faixa usada em desenvolvimento e testada no
     build, `target: 'node20'`).
   - **Environment**: `production`.

## 5. Preencher as variáveis de ambiente no painel

**Nenhum segredo entra em arquivo versionado nem em documentação.** As variáveis abaixo
são preenchidas **direto no painel do Node.js App**, nunca num `.env` commitado — a
lista completa, com o papel de cada uma e sem nenhum valor real, está em
`docs/OPERATIONS.md`.

Ordem prática:

1. Gerar os hashes das duas senhas **dentro do servidor** (nunca na máquina do dono nem
   na do Thiago — regra 0.8 do `CLAUDE.md` global: senha real não passa por chat,
   repositório, memória nem commit):

   ```bash
   printf 'a-senha-real' | pnpm exec tsx scripts/hash-senha.ts
   ```

   (Precisa do repositório clonado temporariamente no servidor, com `pnpm install`
   rodado nele — não é o mesmo diretório da aplicação publicada. Apague o clone depois
   de copiar o hash.)

   A senha vem por **stdin**, nunca por argumento de linha de comando (argumento fica
   salvo no histórico do shell). A única linha impressa é o hash — cole-a direto em
   `CORA_CONTA_N_SENHA_HASH` no painel.

2. Preencher no painel, uma por uma: `WORKSPACE_BASE_URL`, `WORKSPACE_AGENT_CLIENT`,
   `WORKSPACE_AGENT_SECRET`, as quatro de `CORA_CONTA_1_*` e de `CORA_CONTA_2_*`,
   `ANTHROPIC_API_KEY` (ou `MOTOR_PROVIDER=gemini` + `GEMINI_API_KEY` enquanto a
   Anthropic não estiver ligada com chave paga — ver ADR 0003), `CORA_LOG_HASH_KEY`.

3. **Acrescentar o subdomínio a `CORA_HOSTS_PERMITIDOS`:**
   `CORA_HOSTS_PERMITIDOS=cora.medconsultoria.com.br` — sem isso todo pedido chega com
   `400 host_nao_permitido`, porque os padrões (`127.0.0.1`, `localhost`) não incluem o
   domínio publicado.

4. **Apontar `CORA_RAIZ_ESTATICA`** para a pasta do passo 3 que recebeu o conteúdo de
   `apps/web/dist/` (caminho absoluto no servidor).

5. `CORA_BIND` e `CORA_PORT` normalmente ficam **de fora**: o Node.js App Selector já
   decide a porta interna e o proxy reverso do DirectAdmin fala com ela — não force um
   valor sem necessidade confirmada.

6. `CORA_COOKIE_INSEGURO` **nunca** entra em produção (o padrão, sem a variável, já é
   `Secure` ligado — correto para HTTPS). Se entrar por engano, o processo nem sobe:
   ele recusa com `CORA_HOSTS_PERMITIDOS` já tendo o subdomínio do passo 3.

7. **Ligar `CORA_PROXY_CONFIAVEL=1` é obrigatório nesta publicação.** O proxy reverso
   do DirectAdmin fica entre o navegador e o processo Node — sem esta variável, todo
   pedido chega ao Node com o MESMO endereço (o do proxy), e o freio de tentativas de
   login (`docs/OPERATIONS.md`) bloquearia as duas contas reais com 5 requisições de
   qualquer atacante, renovando o bloqueio para sempre (`limpar()` só roda em login
   bem-sucedido, que não consegue mais acontecer). Com a variável ligada, o IP de quem
   fez a requisição vem de `X-Forwarded-For`, que o DirectAdmin sempre sobrescreve.

## 6. Instalar, iniciar, conferir

1. Botão **"Install"** — instala `node_modules` a partir do `package.json` enviado
   (`@node-rs/argon2` e `@anthropic-ai/sdk`, ver seção 1).
2. Botão **"Restart"** — sobe o processo.
3. Aba **"Status"** — confirma que não caiu na hora (variável faltando derruba o
   processo com código de saída 2 e a mensagem nomeando a variável, nunca um valor).

## 7. Conferência final

```bash
curl -s https://cora.medconsultoria.com.br/health
# {"status":"ok","contrato":"0.2.1"}
```

- **Entrar**: abrir `https://cora.medconsultoria.com.br` no navegador, logar com uma das
  duas contas configuradas.
- **Uma mensagem**: mandar uma mensagem qualquer no chat e confirmar resposta.
- **Sair**: usar o menu de conta para encerrar a sessão e confirmar que `GET /auth/sessao`
  volta a `401 sessao_ausente`.

## O que esta fase NÃO faz

- **Nenhum passo deste roteiro foi executado.** Escrever o roteiro não é publicar.
- **Nada de deploy automático.** Não existe workflow de CI/CD apontado para este
  servidor, e não é para existir nesta fase — regra 0.9 do `CLAUDE.md` global: deploy
  automático exige runner próprio dentro do servidor e gatilho `workflow_dispatch` com a
  palavra `PUBLICAR`, nada disso foi montado aqui.
- **Nenhum gatilho de `push` aciona publicação** — nem direto, nem por
  `workflow_dispatch` chamado de fora.
- **Nenhum segredo está neste repositório.** Hash de senha e token de delegação são
  digitados uma vez, direto no painel do Node.js App; nada disso passa por commit, log
  ou documentação.
- **O aplicativo desktop (`apps/desktop`) não faz parte deste roteiro** — ele aponta
  para a URL já publicada aqui; ver `apps/desktop/README.md`.
