/**
 * Radar e-Sfinge — coleta automática
 *
 * Lê os chamados em aberto de e-Sfinge no Jira Atendimento, grava a foto atual
 * numa aba da planilha e publica o data.json no repositório do GitHub Pages.
 *
 * Configuração (Projeto > Configurações do projeto > Propriedades do script):
 *   JIRA_BASE   https://atendimento.betha.com.br
 *   JIRA_USER   seu usuário do Jira
 *   JIRA_PASS   sua senha do Jira
 *   GH_TOKEN    token do GitHub com permissão de escrita no repositório
 *   GH_REPO     arimanoelgomes-ctrl/esfinge_pequenas_medias
 *   GH_BRANCH   main
 *   GH_PATH     data.json
 *   ABA         Chamados em aberto        (opcional; este é o padrão)
 *
 * Primeiros passos, nesta ordem:
 *   1) testarConexao()   — confere o login no Jira e mostra quantos chamados o recorte tem
 *   2) atualizar()       — roda a coleta completa uma vez (autorize os acessos quando pedir)
 *   3) criarGatilho()    — instala o gatilho de 5 em 5 minutos
 *   removerGatilhos()    — desliga a automação
 */

var JQL = 'cf[32400] in ("Portfólio Pequenas Contas","Portfólio Médias Contas")'
  + ' AND cf[10335] in ("Geração arquivos TCE-SC (e-Sfinge)","E-Sfinge","Integração e-Sfinge","e-Sfinge",'
  + '"TCE-SC - e-Sfinge","Prestação de Contas e-Sfinge","e-SFINGE - UG","e-SFINGE - Planejamento",'
  + '"TCE-SC - e-SFINGE","e-SFINGE - CI","e-SFINGE UG","e-SFINGE WebService - 2016","e-SFINGE - CI - 2011","e-SFINGE")'
  + ' AND statusCategory != Done'
  + ' AND issuetype != Melhoria'
  + ' AND cf[21500] in ("Suporte","Serviço","Serviços Especializados")'
  + ' ORDER BY created DESC';

var CAMPOS = ['summary', 'status', 'assignee', 'priority', 'issuetype', 'created', 'updated',
  'customfield_10335',  // Funcionalidades
  'customfield_32400',  // Portfólio de Atendimento
  'customfield_10300',  // Vertical
  'customfield_10202',  // Entidade
  'customfield_10331',  // Município
  'customfield_21500',  // Equipe responsável
  'customfield_24813']; // SLO Atendimento

var PRIORIDADES = {
  '1': '1 - Muito alta', '2': '2 - Alta', '3': '3 - Media', '4': '4 - Baixa', '5': '5 - Muito baixa'
};

var CABECALHO = ['Chave', 'Resumo', 'Portfólio', 'Vertical', 'Entidade', 'Município', 'Equipe responsável',
  'Tipo', 'Status', 'Responsável', 'Prioridade', 'Funcionalidade', 'Criado em', 'Atualizado em',
  'Dias em aberto', 'SLO estourado', 'SLO pausado', 'Tempo de SLO', 'Link'];

// ---------------------------------------------------------------- utilidades

function prop_(nome, padrao) {
  var v = PropertiesService.getScriptProperties().getProperty(nome);
  if (v === null || v === '') {
    if (padrao !== undefined) return padrao;
    throw new Error('Falta a propriedade do script: ' + nome);
  }
  return v;
}

function cabecalhosJira_() {
  var cred = Utilities.base64Encode(prop_('JIRA_USER') + ':' + prop_('JIRA_PASS'), Utilities.Charset.UTF_8);
  return {
    Authorization: 'Basic ' + cred,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Atlassian-Token': 'no-check'
  };
}

function valor_(campo) {
  if (campo === null || campo === undefined) return '';
  if (typeof campo === 'object') return campo.value || campo.name || '';
  return campo;
}

function agora_() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// ------------------------------------------------------------------ coleta

function buscarChamados_() {
  var base = prop_('JIRA_BASE').replace(/\/+$/, '');
  var url = base + '/rest/api/2/search';
  var chamados = [];
  var startAt = 0;
  var total = 0;

  do {
    var corpo = { jql: JQL, startAt: startAt, maxResults: 100, fields: CAMPOS };
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: cabecalhosJira_(),
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true
    });
    var codigo = resp.getResponseCode();
    if (codigo !== 200) {
      throw new Error('Jira respondeu ' + codigo + ': ' + resp.getContentText().slice(0, 500));
    }
    var dados = JSON.parse(resp.getContentText());
    total = dados.total;
    chamados = chamados.concat(dados.issues || []);
    startAt += 100;
  } while (startAt < total && startAt < 2000);

  return { issues: chamados, total: total };
}

function normalizar_(issue) {
  var f = issue.fields || {};
  var slo = f.customfield_24813 || {};
  var atual = slo.ongoingCycle || null;
  var ciclos = slo.completeCycles || [];
  var estourado = !!(atual && atual.breached);
  if (!estourado) {
    for (var i = 0; i < ciclos.length; i++) { if (ciclos[i].breached) { estourado = true; break; } }
  }
  var restante = atual ? atual.remainingTime : null;
  if (restante === null && ciclos.length) {
    var ultimo = ciclos[ciclos.length - 1];
    restante = (ultimo.goalTime || 0) - (ultimo.elapsedTime || 0);
  }
  var entidade = f.customfield_10202 || '';
  var municipio = f.customfield_10331 || '';
  if (!municipio && entidade.indexOf(' - ') >= 0) {
    municipio = entidade.split(' - ').pop().split('/')[0];
  }
  return {
    k: issue.key,
    proj: issue.key.split('-')[0],
    s: f.summary || '',
    st: f.status ? f.status.name : '',
    sc: f.status && f.status.statusCategory ? f.status.statusCategory.name : '',
    a: f.assignee ? f.assignee.displayName : 'Sem responsável',
    p: PRIORIDADES[f.priority ? f.priority.id : ''] || (f.priority ? f.priority.name : '-'),
    t: f.issuetype ? f.issuetype.name : '',
    c: f.created || null,
    u: f.updated || null,
    f: f.customfield_10335 || '',
    pf: valor_(f.customfield_32400) || 'Nao definido',
    v: valor_(f.customfield_10300) || 'Nao definida',
    e: entidade,
    m: municipio,
    eq: valor_(f.customfield_21500) || 'Nao definida',
    br: estourado,
    rem: restante === undefined ? null : restante,
    paused: !!(atual && atual.paused)
  };
}

function montarPayload_() {
  var bruto = buscarChamados_();
  var vistos = {};
  var lista = [];
  bruto.issues.forEach(function (issue) {
    if (vistos[issue.key]) return;
    vistos[issue.key] = true;
    lista.push(normalizar_(issue));
  });
  lista.sort(function (a, b) {
    if (a.br !== b.br) return a.br ? -1 : 1;
    return String(a.c).localeCompare(String(b.c));
  });
  return {
    generatedAt: agora_(),
    total: bruto.total,
    fetched: lista.length,
    jql: JQL,
    issues: lista
  };
}

// ---------------------------------------------------------------- planilha

function gravarPlanilha_(payload) {
  var nomeAba = prop_('ABA', 'Chamados em aberto');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(nomeAba) || ss.insertSheet(nomeAba);
  var agora = new Date();

  var linhas = payload.issues.map(function (r) {
    var criado = r.c ? new Date(r.c) : null;
    var dias = criado ? Math.max(0, Math.floor((agora - criado) / 86400000)) : '';
    var horas = r.rem === null || r.rem === undefined ? '' : Math.round(r.rem / 3600000 * 10) / 10;
    return [r.k, r.s, r.pf, r.v, r.e, r.m, r.eq, r.t, r.st, r.a, r.p, r.f,
      criado, r.u ? new Date(r.u) : '', dias, r.br ? 'Sim' : 'Não', r.paused ? 'Sim' : 'Não', horas,
      'https://atendimento.betha.com.br/browse/' + r.k];
  });

  aba.clear();
  aba.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO])
    .setFontWeight('bold').setBackground('#E4F0EA');
  if (linhas.length) {
    aba.getRange(2, 1, linhas.length, CABECALHO.length).setValues(linhas);
  }
  aba.setFrozenRows(1);
  aba.getRange(1, 13, Math.max(linhas.length + 1, 2), 2).setNumberFormat('dd/mm/yyyy hh:mm');

  var carimbo = 'Atualizado em ' + Utilities.formatDate(agora, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')
    + ' · ' + payload.issues.length + ' chamados · '
    + payload.issues.filter(function (r) { return r.br; }).length + ' com SLO estourado';
  aba.getRange(1, CABECALHO.length + 2).setValue(carimbo).setFontColor('#6C7871');
}

// ------------------------------------------------------------------ GitHub

function publicarNoGitHub_(payload) {
  var repo = prop_('GH_REPO');
  var branch = prop_('GH_BRANCH', 'main');
  var caminho = prop_('GH_PATH', 'data.json');
  var token = prop_('GH_TOKEN');
  var api = 'https://api.github.com/repos/' + repo + '/contents/' + caminho;
  var cabecalhos = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'radar-esfinge-apps-script'
  };

  var sha = null;
  var atual = UrlFetchApp.fetch(api + '?ref=' + encodeURIComponent(branch), {
    method: 'get', headers: cabecalhos, muteHttpExceptions: true
  });
  if (atual.getResponseCode() === 200) {
    sha = JSON.parse(atual.getContentText()).sha;
  } else if (atual.getResponseCode() !== 404) {
    throw new Error('GitHub (leitura) respondeu ' + atual.getResponseCode() + ': ' + atual.getContentText().slice(0, 300));
  }

  var conteudo = Utilities.base64Encode(JSON.stringify(payload), Utilities.Charset.UTF_8);
  var corpo = {
    message: 'Atualiza dados do Radar e-Sfinge (' + payload.issues.length + ' chamados, '
      + payload.issues.filter(function (r) { return r.br; }).length + ' com SLO estourado)',
    content: conteudo,
    branch: branch
  };
  if (sha) { corpo.sha = sha; }

  var resp = UrlFetchApp.fetch(api, {
    method: 'put', headers: cabecalhos, contentType: 'application/json',
    payload: JSON.stringify(corpo), muteHttpExceptions: true
  });
  var codigo = resp.getResponseCode();
  if (codigo !== 200 && codigo !== 201) {
    throw new Error('GitHub (escrita) respondeu ' + codigo + ': ' + resp.getContentText().slice(0, 300));
  }
}

// -------------------------------------------------------------- orquestração

function atualizar() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var payload = montarPayload_();
    gravarPlanilha_(payload);
    publicarNoGitHub_(payload);
    PropertiesService.getScriptProperties().setProperty('ULTIMA_EXECUCAO',
      agora_() + ' · ' + payload.issues.length + ' chamados');
    Logger.log('OK — %s chamados, %s com SLO estourado', payload.issues.length,
      payload.issues.filter(function (r) { return r.br; }).length);
  } finally {
    lock.releaseLock();
  }
}

function testarConexao() {
  var base = prop_('JIRA_BASE').replace(/\/+$/, '');
  var eu = UrlFetchApp.fetch(base + '/rest/api/2/myself', {
    headers: cabecalhosJira_(), muteHttpExceptions: true
  });
  Logger.log('Login: %s — %s', eu.getResponseCode(), eu.getContentText().slice(0, 200));
  if (eu.getResponseCode() !== 200) return;

  var busca = UrlFetchApp.fetch(base + '/rest/api/2/search', {
    method: 'post', headers: cabecalhosJira_(),
    payload: JSON.stringify({ jql: JQL, maxResults: 1, fields: ['summary'] }),
    muteHttpExceptions: true
  });
  Logger.log('Consulta: %s — %s', busca.getResponseCode(), busca.getContentText().slice(0, 300));
}

function criarGatilho() {
  removerGatilhos();
  ScriptApp.newTrigger('atualizar').timeBased().everyMinutes(5).create();
  Logger.log('Gatilho criado: atualizar() a cada 5 minutos.');
}

function removerGatilhos() {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === 'atualizar') ScriptApp.deleteTrigger(g);
  });
}
