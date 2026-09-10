# Radar e-Sfinge — Pequenas e Médias Contas

Dashboard estática dos chamados **em aberto** com funcionalidade **e-Sfinge** nos portfólios
**Pequenas Contas** e **Médias Contas** (Betha Sistemas / TCE-SC).

- Página publicada: https://arimanoelgomes-ctrl.github.io/esfinge_pequenas_medias/
- Fonte: Jira Atendimento (`atendimento.betha.com.br`), via MCP `jira-atendimento`
- Recorte: `Portfólio de Atendimento` em Pequenas/Médias Contas + `Funcionalidades` com e-Sfinge
  + `Equipe responsável` em Suporte, Serviço ou Serviços Especializados
  + status não concluído, excluindo o tipo `Melhoria`

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | dashboard completa, com os dados embutidos (não depende de servidor) |
| `data.json` | mesmo conjunto de dados em JSON, para reuso |
| `jql.txt` | a consulta JQL exata usada na coleta |

## Filtros disponíveis na página

Portfólio, vertical, município, entidade, responsável, equipe responsável, tipo, status,
SLO (estourado / dentro do prazo), funcionalidade e busca livre — além de tom claro/escuro.

## Atualização

Os dados são regerados por uma tarefa agendada (de hora em hora) que consulta o Jira,
atualiza `index.html` e `data.json` e publica o commit nesta branch.
O campo "Atualizado" no topo da página mostra o horário da última coleta (America/Sao_Paulo).
