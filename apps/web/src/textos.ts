/**
 * Todo texto visível da interface da Fase 4, copiado literalmente da seção `textos` de
 * `docs/esteira/fase-4-acesso-windows-e-pwa-android/design.md`. Nenhuma frase aqui pode
 * ser inventada, encurtada ou reescrita — `textos.test.ts` confere isso lendo o próprio
 * documento. Componente algum declara string de interface fora deste arquivo.
 */
export const textos = {
  login: {
    rotuloEmail: 'E-mail',
    rotuloSenha: 'Senha',
    ajudaEmail: 'Use o e-mail cadastrado pelo administrador.',
    botaoEntrar: 'Entrar',
    botaoEntrando: 'Entrando…',
    erroCredenciaisInvalidas:
      'E-mail ou senha não conferem. Confira os dois campos e tente de novo.',
    erroBloqueadoPorTentativas:
      'Conta bloqueada por excesso de tentativas. Espere alguns minutos e tente de novo. ' +
      'Se continuar bloqueada, fale com o administrador.',
    erroEmailVazio: 'Digite seu e-mail para entrar.',
    erroSenhaVazia: 'Digite sua senha para entrar.',
    erroServidorForaDoAr:
      'Não conseguimos falar com o servidor agora. Verifique sua conexão e tente de novo.',
  },
  chat: {
    nomeProduto: 'Cora',
    legenda: 'Assistente da MedConsultoria',
    vazioLinha1: 'Oi! Eu sou a Cora.',
    vazioLinha2: 'Pergunte "como estão minhas pendências" ou me escreva livremente.',
    placeholderCampoDeEntrada: 'Escreva uma mensagem…',
    botaoEnviar: 'Enviar',
    mensagemEnviando: 'Enviando…',
    erroDeEnvio: 'Não foi enviada. A conexão falhou no meio do caminho.',
    botaoTentarDeNovo: 'Tentar de novo',
    coraEstaDigitando: 'Cora está digitando…',
    ajudaCampoDesabilitado: 'Aguarde a resposta anterior.',
  },
  chips: {
    erro_de_acesso: 'Erro de acesso',
    sincronizacao_incompleta: 'Sincronização incompleta',
    sem_registros: 'Sem registros',
    sem_pendencias: 'Sem pendências',
    com_pendencias: 'Com pendências',
  },
  erroDeConexao: {
    semInternet: 'Sem conexão com a internet. Suas mensagens serão enviadas quando ela voltar.',
    servidorForaDoArLinha1: 'Não conseguimos falar com o servidor da Cora agora.',
    servidorForaDoArLinha2: 'Tente de novo em alguns minutos.',
    sessaoExpiradaLinha1: 'Sua sessão expirou por segurança.',
    botaoEntrarDeNovo: 'Entrar de novo',
  },
  promptPwa: {
    titulo: 'Instalar a Cora no seu celular',
    corpo: 'Acesse mais rápido, direto da tela inicial, sem abrir o navegador.',
    botaoInstalar: 'Instalar',
    botaoAgoraNao: 'Agora não',
    nomeCurto: 'Cora',
    nomeCompleto: 'Cora — Assistente da MedConsultoria',
  },
  menuDeConta: {
    itemSairDaConta: 'Sair da conta',
    confirmarSairLinha1: 'Sair da conta da Cora?',
    confirmarSairLinha2: 'Você vai precisar entrar de novo para continuar usando.',
    botaoCancelar: 'Cancelar',
    botaoSair: 'Sair',
    itemTrocarDeUsuario: 'Trocar de usuário',
    confirmarTrocarLinha1: 'Trocar de usuário?',
    confirmarTrocarLinha2: 'A conversa atual não fica salva — ela é apagada ao sair.',
    botaoTrocar: 'Trocar',
  },
} as const
