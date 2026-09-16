# Radar e-Sfinge — Pequenas e Médias Contas

Dashboard dos chamados **em aberto** com funcionalidade **e-Sfinge** nos portfólios
**Pequenas Contas** e **Médias Contas** (Betha Sistemas / TCE-SC).

- Página publicada: https://arimanoelgomes-ctrl.github.io/esfinge_pequenas_medias/
- Fonte: Jira Atendimento (`atendimento.betha.com.br`)
- Recorte: `Portfólio de Atendimento` em Pequenas/Médias Contas + `Funcionalidades` com e-Sfinge
  + `Equipe responsável` em Suporte, Serviço ou Serviços Especializados
  + status não concluído, excluindo o tipo `Melhoria`

## Como se atualiza

Um projeto do **Google Apps Script**, preso a uma planilha, roda `atualizar()` de 5 em 5 minutos:

1. consulta o Jira pela REST API com a JQL de `jql.txt`;
2. reescreve a aba **Chamados em aberto** da planilha com a foto do momento;
3. publica o `data.json` neste repositório pela API do GitHub.

A página lê o `data.json` ao abrir e a cada 5 minutos — os dados embutidos no `index.html`
servem apenas de reserva, para a dashboard abrir pronta caso o arquivo não seja alcançado.
Nenhuma etapa depende de agendamento por IA.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | a dashboard (filtros, SLO, tom claro/escuro) com dados de reserva embutidos |
| `data.json` | o conjunto de dados vivo, sobrescrito a cada coleta |
| `jql.txt` | a consulta JQL exata do recorte |
| `apps-script/Codigo.gs` | o script da coleta — colar no editor do Apps Script da planilha |

## Configuração do Apps Script

Em **Projeto → Configurações do projeto → Propriedades do script**:

| Propriedade | Valor |
| --- | --- |
| `JIRA_BASE` | `https://atendimento.betha.com.br` |
| `JIRA_USER` | usuário do Jira |
| `JIRA_PASS` | senha do Jira |
| `GH_TOKEN` | token do GitHub com escrita neste repositório |
| `GH_REPO` | `arimanoelgomes-ctrl/esfinge_pequenas_medias` |
| `GH_BRANCH` | `main` |
| `GH_PATH` | `data.json` |

Depois, no editor: `testarConexao()` → `atualizar()` → `criarGatilho()`.
`removerGatilhos()` desliga a automação.

## Filtros da página

Portfólio, vertical, município, entidade, responsável, equipe responsável, tipo, status,
SLO (estourado / dentro do prazo), funcionalidade e busca livre, além do seletor de tom claro/escuro.
