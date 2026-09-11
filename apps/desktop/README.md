# `@cora/desktop`

Janela Tauri v2 que embrulha a Cora publicada — não é um app com tela própria, é o
navegador mínimo apontado para a URL de produção. A configuração vive neste pacote; o
instalador (`.msi`/`.exe`) não é gerado nesta máquina (ver "Pré-requisitos de build").

## Onde muda a URL

**Um único lugar:** `src-tauri/tauri.conf.json`, chave `build.frontendDist`. Hoje aponta
para `https://cora.medconsultoria.com.br` (recomendação de subdomínio da `spec.md` da
Fase 4 — trocar para o nome real quando o subdomínio for criado no DirectAdmin).

Trocar de servidor (homologação, outro domínio etc.) é editar essa única linha e rodar
`pnpm build` de novo — **a URL fica embutida no binário no momento do build**, não é lida
em tempo de execução. Não há segundo lugar com a URL: não duplique em `main.rs` nem em
variável de ambiente.

## Pré-requisitos de build (Windows, máquina do dono)

Esta etapa entrega configuração, ícones e documentação — não o instalador. `cargo`/`rustc`
não existem na máquina onde este pacote foi escrito, então `tauri build` **não roda aqui**.
Para gerar o `.msi`/`.exe`, na máquina do dono:

- Rust stable com toolchain MSVC, `rustc` 1.77 ou mais novo.
- Microsoft C++ Build Tools (workload "Desktop development with C++").
- Node 20 ou mais novo.
- WebView2 **não precisa ser instalado à parte**: já vem de fábrica no Windows 10 1803+ e
  no Windows 11 (fonte em `docs/esteira/fase-4-acesso-windows-e-pwa-android/spec.md`,
  seção `fontes_externas`, apontando para
  <https://v2.tauri.app/start/prerequisites/>).

Com os pré-requisitos instalados:

```bash
pnpm install
pnpm --filter @cora/desktop run build
```

O instalador sai em `apps/desktop/src-tauri/target/release/bundle/`. Esse resultado —
rodar `tauri build` de verdade numa máquina com Rust — é evidência a ser registrada na
Etapa 20, não desta etapa.

## Ícones

Gerados a partir de
`docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/icon-windows-source.svg`
(1024×1024) com o CLI do Tauri, e commitados em `src-tauri/icons/`:

```bash
pnpm --filter @cora/desktop run icons
```

Rodar de novo só é necessário se o SVG de origem mudar.

## Aviso do SmartScreen

O instalador ainda não é conhecido do Windows na primeira publicação, então o Windows
mostra o aviso azul "O Windows protegeu o computador" (SmartScreen). O texto que acompanha
o instalador para a pessoa que vai instalar está em `ANTES-DE-INSTALAR.md`.

## Permissões

A janela só carrega a URL remota configurada. Nenhum comando nativo, nenhum acesso a
sistema de arquivos, nenhum plugin de atualização automática — ver
`src-tauri/capabilities/default.json` e `src-tauri/Cargo.toml`.
