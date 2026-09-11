## assets

Papel: Diretor de mídia. Pergunta que guiou cada item: **essa imagem existe, é livre, é
leve e combina?** Resposta curta: nada preexistia (busquei em `apps/`, `packages/` e na raiz
— não há logo, ícone nem wordmark no repositório hoje), tudo abaixo foi gerado por código
(skill `imagem-por-codigo`), então "livre" é automático, "leve" é medido (SVG puro, sem
raster embutido, cada arquivo abaixo de 1,5 KB) e "combina" porque cada cor vem literalmente
dos tokens de `design.md` — nenhum hex novo foi inventado.

Origem, autor e licença de cada arquivo — inclusive o gerado — estão em
`assets/CREDITOS.md`, como a regra do repositório exige.

### A marca

Um monograma geométrico — um arco "C" aberto à direita (traço, não glifo de fonte, para
ficar nítido em 16 px) sobre fundo `--color-primary`. Único elemento visual novo desta fase;
tudo o mais deriva dele.

- **`assets/favicon.svg`** — 32×32, aba do navegador e atalho do PWA. Inclui
  `prefers-color-scheme` embutido no próprio arquivo (troca de cor sozinho no tema escuro do
  SO, sem depender de o app estar aberto).
- **`assets/icon-any.svg`** — 512×512, ícone "any" do `manifest.json` (fundo arredondado,
  cantos próprios, não preenche a borda).
- **`assets/icon-maskable.svg`** — 512×512, ícone "maskable" do `manifest.json`: sangria até
  a borda, marca contida no círculo de segurança de 40% — o Android pode recortar em
  qualquer forma (círculo, "squircle") sem cortar o "C".
- **`assets/icon-windows-source.svg`** — 1024×1024, fonte para o instalador Windows/Tauri.

### A marca com o nome

- **`assets/wordmark-lockup.svg`** — marca + "Cora" em Inter 600, para o cabeçalho da tela de
  login e do chat.
- **`assets/wordmark-only.svg`** — só o nome, para espaço estreito.

Os dois usam `var(--color-*, <fallback oklch>)`: herdam o tema quando inseridos inline no
HTML (recomendado) e caem no valor claro se algum dia forem usados como arquivo solto.

### Estados da tela

- **`assets/ilustracao-vazio.svg`** — "sem pendências" e "primeira conversa" (lista vazia).
  Cartão de lista + selo de concluído, na cor `--color-sucesso` — a mesma cor semântica do
  chip `sem_pendencias` em `resumo.ts`, de propósito, para a ilustração não inventar um
  significado que o dado não tem.
- **`assets/ilustracao-erro-conexao.svg`** — "não consegui consultar" / falha de rede. Sinal
  cortado + selo de alerta, na cor `--color-erro`. É visualmente distinta da anterior em
  forma e cor, não só em texto — a mesma disciplina que `design.md` exige dos chips de
  estado (restrição 1 do painel).

Todas as ilustrações e wordmarks usam `var(--color-*)` com fallback e devem ser **inseridas
inline no HTML** (não via `<img src>`), para herdar claro/escuro automaticamente. Os quatro
ícones de app (`favicon`, `icon-any`, `icon-maskable`, `icon-windows-source`) são arquivos
autônomos por natureza — cor gravada em `oklch()` direto no arquivo, porque um favicon ou um
ícone de PWA é carregado fora do documento e não vê as variáveis CSS da página.

### O que falta — e por quê não está aqui

Nenhuma foto. A avaliação da ordem de trabalho se confirmou: isto é uma ferramenta interna
de chat, não site de marketing, e nada na tela pede imagem realista — login, lista, vazio e
erro em 360px, exatamente o que `design.md` desenha. Não há geração de foto realista dentro
do Claude Code (limite declarado), e mesmo se houvesse, não haveria onde usá-la aqui.

O que falta é **trabalho de build, não de mídia**, e fica registrado para quem escrever
`apps/web`/`apps/desktop` (nenhum dos dois existe ainda neste repositório):

- **PNG 192×192 e 512×512** para o `manifest.json` (a partir de `icon-any.svg` e
  `icon-maskable.svg`) — este ambiente não tem `sharp`, ImageMagick nem `rsvg-convert`
  instalados para rasterizar agora; é um passo de build de um comando (`pwa-asset-generator`
  ou `sharp-cli`), não um asset que falta desenhar.
- **`icon.ico`** do Windows — não se desenha à mão: o comando `tauri icon
  icon-windows-source.svg` (Tauri v2 CLI) já gera todos os tamanhos e o `.ico` sozinho a
  partir do arquivo entregue aqui, na máquina Windows do dono, no momento do build do
  instalador (`spec.md` já marca esse build como manual, fora de CI).
- **Apple touch icon / manifest iOS** — não falta: iOS está fora de escopo desta fase
  (`spec.md`, PWA é Android).
