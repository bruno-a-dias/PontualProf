# Pontual — Grade, Ponto e Diário de classe

Aplicativo para professores organizarem a grade de aulas, lembrarem de bater o ponto e **prepararem o livro diário** (número da aula, data, conteúdo ministrado e observações) para depois lançar nos sistemas das instituições.

**Acesse:** <https://pontualprof.vercel.app/>

- Não precisa criar conta nem instalar nada da loja: abre no navegador e pode ser instalado na tela inicial.
- Seus dados ficam **no seu aparelho** (não vão para nenhum servidor). Faça backups — veja o [capítulo 9](#9-backup-e-segurança-dos-dados).
- O Pontual **não registra o ponto por você**: ele abre o portal da sua instituição na hora certa e anota que você foi lá.

---

## Índice

**Para quem usa**

1. [Instalar no celular ou computador](#1-instalar-no-celular-ou-computador)
2. [Primeiros passos (5 minutos)](#2-primeiros-passos-5-minutos)
3. [Cadastrar a grade de aulas](#3-cadastrar-a-grade-de-aulas)
4. [Registrar o ponto](#4-registrar-o-ponto)
5. [Diário de classe (passo a passo)](#5-diário-de-classe-passo-a-passo)
6. [Levar o diário para o sistema da instituição](#6-levar-o-diário-para-o-sistema-da-instituição)
7. [Lembretes e agenda do celular](#7-lembretes-e-agenda-do-celular)
8. [Vários semestres](#8-vários-semestres)
9. [Backup e segurança dos dados](#9-backup-e-segurança-dos-dados)
10. [Trocar de aparelho](#10-trocar-de-aparelho)
11. [Problemas comuns](#11-problemas-comuns)
12. [Perguntas frequentes](#12-perguntas-frequentes)

**Para quem mantém o código**

13. [Executar localmente](#13-executar-localmente)
14. [Testes](#14-testes)
15. [Publicar na Vercel](#15-publicar-na-vercel)
16. [Estrutura do projeto](#16-estrutura-do-projeto)

---

# Guia do professor

## O app em um minuto

O menu tem cinco telas:

| Tela | Para que serve |
|---|---|
| **Ponto** | Início. Mostra a aula de hoje, o relógio, as janelas de ponto, o botão que abre o portal da instituição e os alertas (ponto esquecido, diário pendente, backup). |
| **Grade** | Todas as suas aulas da semana, em lista ou em quadro semanal, com carga horária e aviso de choque de horários. |
| **Diário** | O livro diário por disciplina: tabela com número da aula, data, conteúdo e observações. |
| **Ajustes** | Perfil, instituições, links de ponto, tema (claro/escuro), lembretes, calendário e semestres. |
| **Dados** | Backup, importação de planilha de aulas, histórico de ponto e proteção do armazenamento. |

No computador o menu fica no topo; no celular, embaixo.

---

## 1. Instalar no celular ou computador

Instalar é opcional, mas **recomendado**: o app abre em tela cheia, funciona sem internet depois de carregado, e os dados ficam mais protegidos contra limpeza automática do navegador.

**Android (Chrome)**
1. Abra <https://pontualprof.vercel.app/>.
2. Toque nos três pontinhos **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).

**iPhone / iPad (Safari)**
1. Abra o endereço no **Safari** (o passo abaixo não existe em outros navegadores).
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.

**Computador (Chrome ou Edge)**
1. Abra o endereço.
2. Clique no ícone de instalar, no canto direito da barra de endereço (ou menu **⋮** → **Instalar Pontual**).

> No iPhone, instalar na tela inicial é especialmente importante: o Safari pode apagar dados de sites que ficam muito tempo sem uso, e um app instalado tem tratamento melhor.

---

## 2. Primeiros passos (5 minutos)

Na primeira vez, a tela **Ponto** mostra o cartão **“Configure o Pontual em 3 passos”**. Siga na ordem:

### Passo 1 — Seu perfil (opcional)
**Ajustes → Perfil docente**: preencha **Nome** e **Vínculo / cargo** e toque em **Salvar perfil**. Dá para **Trocar foto**. O nome aparece na Home e no cabeçalho do diário impresso.

### Passo 2 — Cadastre a instituição e o link do ponto
**Ajustes → Instituições**:
1. **Nome / sigla**: por exemplo `UFX` ou `Colégio Central`.
2. **Link padrão de ponto**: o endereço do portal onde você bate o ponto. Copie do navegador, começando por `https://`.
3. (Opcional) **Escolher logo**.
4. Toque em **+ Instituição**.

Dá para cadastrar várias instituições. Para editar, use o lápis ✎ da lista; para remover, o ×.

### Passo 3 — Cadastre as aulas
Veja o [capítulo 3](#3-cadastrar-a-grade-de-aulas). Quando as três etapas estiverem completas, o cartão de boas-vindas some sozinho.

### Opcional: regras de ponto por dia e turno
Se a mesma instituição usa links diferentes (por exemplo, um para o turno da noite), vá em **Ajustes → Regras de ponto**: escolha **Instituição**, **Dia**, **Turno**, informe a **URL do sistema** e toque em **Salvar regra de ponto**.

O app escolhe o link nesta ordem de prioridade:
1. regra com o **dia e o turno** da aula;
2. regra só do **turno** (todos os dias);
3. regra só do **dia** (todos os turnos);
4. o **link padrão** da instituição.

---

## 3. Cadastrar a grade de aulas

### Uma aula por vez
**Grade → + Aula** (ou **Ponto → + Aula**) e preencha:

| Campo | O que colocar |
|---|---|
| **Disciplina** | Nome da disciplina. Use **sempre o mesmo nome** nas aulas da mesma turma: é ele que junta os dias da semana no mesmo diário. |
| **Instituição** | Uma das instituições cadastradas. |
| **Dia da semana** | Dia em que a aula acontece. |
| **Turno** | Matutino, Especial, Vespertino ou Noturno. |
| **Campus** | Unidade/campus. |
| **Início / Término** | Horário da aula, por exemplo `08:15` e `09:55`. |
| **Espaço** e **Sala / laboratório** | Sala ou laboratório e o número. |
| **Observações** | Opcional. |

Toque em **Salvar aula**. Uma disciplina que acontece em dois dias (ex.: segunda e quarta) vira **duas aulas** com o mesmo nome.

> Se duas aulas se sobrepõem no mesmo dia, o app avisa ao salvar e marca **Conflito de horário** na Grade. É só um aviso: você pode manter assim.

### Várias aulas de uma vez: planilha
Em **Dados → Planilha de aulas**:
1. Toque em **Baixar modelo (.csv)**.
2. Abra no Excel ou Planilhas Google, preencha uma aula por linha e salve como **CSV**.
3. Toque em **Importar planilha de aulas** e escolha o arquivo.

Colunas obrigatórias: **Disciplina, Dia, Início, Término**. Opcionais: **Instituição, Turno, Campus, Espaço, Sala, Observações**.

```text
Disciplina;Instituição;Dia;Início;Término;Turno;Campus;Espaço;Sala;Observações
Cálculo I;UFX;Segunda;08:15;09:55;Matutino;Campus Sul;Sala;B-104;
Banco de Dados;UFX;Quarta;19:00;20:40;Noturno;Campus Sul;Laboratório;L-02;Levar notebook
```

- O **Dia** aceita `Segunda`, `Terça`, `seg`, `qua`… (com ou sem acento) ou o número de 0 (domingo) a 6 (sábado).
- Horários como `8:15`, `08:15` ou `8h15`.
- Instituições que ainda não existem são criadas automaticamente. **Depois, informe o link de ponto delas em Ajustes.**
- Linhas com erro são ignoradas e o app mostra o motivo antes de importar.

### Conferir a grade
- **Lista**: aulas agrupadas por dia, com os botões ✎ (editar) e × (excluir).
- **Semana**: quadro com horários; toque em um bloco para editar. Aulas que se sobrepõem aparecem em vermelho, lado a lado.
- No topo: **carga semanal** total e por instituição.

---

## 4. Registrar o ponto

Na tela **Ponto**, o app mostra a aula de hoje (ou do dia escolhido na faixa **Dom–Sáb**), com:

- o **relógio** e quanto falta para a aula começar ou terminar;
- as **janelas de ponto**: de 15 minutos antes a 15 minutos depois do **início** (entrada) e do **término** (saída);
- o botão **ABRIR SISTEMA DE PONTO**.

### Fluxo
1. Dentro da janela, toque em **ABRIR SISTEMA DE PONTO**. O portal da instituição abre em outra aba.
2. Bata o ponto no portal, como sempre.
3. Volte ao Pontual. Ele pergunta **“Você concluiu o registro?”**:
   - **Sim, registrei** → fica **confirmado** no histórico.
   - **Ainda não** → o app continua te lembrando.

### Ponto esquecido
Se a janela de uma aula de hoje já fechou e não há registro confirmado, aparece o cartão **“Possível ponto esquecido hoje”**:
- **Abrir** leva ao portal;
- **Já registrei** anota que você fez (use se bateu o ponto fora do app).

### Histórico
**Dados → Batidas de ponto** lista tudo, com a situação (confirmado, não concluído, aguardando confirmação). **Exportar CSV** gera uma planilha para conferir com o RH.

> Não consegue abrir o portal? Veja [Problemas comuns](#11-problemas-comuns).

---

## 5. Diário de classe (passo a passo)

O diário é feito **por disciplina** (a mesma disciplina na mesma instituição, no semestre ativo). Abra a tela **Diário** e escolha a disciplina em **Disciplina / turma**.

### Como funciona a numeração
- O **número da aula** é calculado automaticamente pela **ordem das datas**.
- Aula com mais de um período no dia (ex.: 2 aulas de 50 min) usa **Aulas no dia = 2** e aparece como **“3–4”**. O app sugere esse valor pela duração da aula na grade (50 min por período); você pode mudar.
- **Falta do professor** e **Sem aula (feriado/recesso)** **não consomem número**.
- Se você inserir uma aula no meio ou mudar uma data, a numeração se ajusta sozinha.

### Situações de uma aula
| Situação | Quando usar | Conta no número? |
|---|---|---|
| **Realizada** | Aula normal dada | Sim |
| **Reposição** | Aula de reposição | Sim |
| **Prevista** | Gerada antes de acontecer | Sim (para visualizar) |
| **Falta do professor** | Você não pôde dar a aula | Não |
| **Sem aula (feriado/recesso)** | Feriado, recesso, evento | Não |

### Caminho A — Preencher no dia (mais simples)
1. Depois da aula, na Home ou no topo do **Diário**, toque em **Registrar** na aula de hoje (ou, na lista de aulas da Home, no botão **✎ Diário**).
2. O formulário já vem com a disciplina, a data e as aulas do dia.
3. Escreva o **Conteúdo ministrado** e, se quiser, as **Observações** (prova marcada, material, pendências).
4. Toque em **Salvar**.

### Caminho B — Gerar o semestre inteiro e ir preenchendo
1. No **Diário**, escolha a disciplina e toque em **Gerar datas do semestre**.
2. Informe **Primeiro dia** e **Último dia** do período letivo e toque em **Gerar datas**.
3. O app cria uma linha **Prevista** para cada aula do período, já numerada.
4. **Marque os feriados**: toque no lápis ✎ da linha, mude a **Situação** para **Sem aula (feriado/recesso)** e salve — a numeração das seguintes se corrige.
5. A cada aula dada, abra a linha (✎), escreva o conteúdo e mude a situação para **Realizada**.

> Dica: o filtro **Pendentes** mostra só as aulas que já passaram e ainda estão sem conteúdo — ótimo para uma “faxina” semanal do diário. Linhas pendentes ficam destacadas.

### Editar e excluir
Use ✎ na linha para editar. No formulário há **Excluir** para remover o registro.

### Regras úteis
- Não é possível criar duas aulas iguais na mesma data e horário; o app avisa.
- Se você renomear uma disciplina na Grade, o diário acompanha o novo nome (desde que o nome antigo não seja usado em outra aula).

---

## 6. Levar o diário para o sistema da instituição

A tela **Diário** tem botões para cada jeito de trabalho:

| Botão | O que faz | Quando usar |
|---|---|---|
| **Copiar tabela** | Copia a tabela (com cabeçalho) separada por tabulação | Colar direto no **Excel / Planilhas Google**; alguns sistemas aceitam colar tabela |
| **⧉** (em cada linha) | Copia **só o conteúdo** daquela aula | Colar no campo “conteúdo” do sistema da instituição, aula por aula |
| **Baixar CSV** | Baixa a tabela da disciplina | Guardar, enviar à coordenação, abrir no Excel (acentos corretos) |
| **CSV de todas as disciplinas** | Uma planilha com todas as turmas do semestre | Prestação de contas geral |
| **Imprimir / PDF** | Abre a impressão só com a tabela | Imprimir ou **Salvar como PDF** |

Colunas exportadas: **Nº da aula; Data; Conteúdo ministrado; Observações; Situação** (e, no CSV geral, também **Disciplina** e **Instituição**).

Exemplo de CSV:

```text
Nº da aula;Data;Conteúdo ministrado;Observações;Situação
1–2;03/03/2027;Revisão de SQL: SELECT, JOIN e GROUP BY;Entregar lista 1;Realizada
—;10/03/2027;;;Sem aula (feriado/recesso)
3–4;17/03/2027;Normalização;;Prevista
```

> **Excel em português**: o CSV usa ponto e vírgula e codificação UTF-8 com BOM, então abre com colunas separadas e acentos corretos ao dar duplo clique. No Planilhas Google, use **Arquivo → Importar** e escolha o separador **Ponto e vírgula**.

---

## 7. Lembretes e agenda do celular

Em **Ajustes → Lembretes e calendário**.

### Notificações do app
1. Toque em **Ativar** e permita as notificações quando o navegador perguntar.
2. Em **Avisar antes da janela abrir**, escolha 5, 10 ou 15 minutos.

Você recebe um aviso antes da janela de **entrada** e da de **saída** de cada aula do dia.

**Limites (importante):** são notificações locais, geradas pelo navegador.
- Funcionam com o app **aberto ou em segundo plano**, e podem deixar de chegar se o sistema encerrar o app para economizar bateria. **Não conte com elas com o app fechado.**
- No iPhone, só funcionam com o app **instalado na tela inicial**.
- Se você bloqueou as notificações, o botão fica desativado: libere nas configurações do navegador/aparelho.

### Alarmes garantidos: agenda do celular (.ics)
É a forma confiável de ser avisado. Sua agenda dispara o alarme mesmo com o Pontual fechado.
1. Em **Exportar para a agenda do celular**, informe **De** e **Até** (o período do semestre).
2. Escolha o **Alarme antes da aula** (10, 15, 30 ou 60 min).
3. Toque em **Baixar calendário (.ics)** e abra o arquivo: o Google Agenda, o Calendário da Apple ou o Outlook adicionam todas as aulas, repetindo toda semana, com alarme.

> Se você mudar a grade depois, exporte e importe novamente. Para evitar duplicatas, apague na agenda o calendário antigo “Pontual — Grade docente” antes de importar o novo.

---

## 8. Vários semestres

O seletor no canto superior direito (por exemplo `2027/1`) escolhe o **semestre ativo**. Grade, diário e alertas mostram só o que pertence a ele.

Para começar um novo semestre: **Ajustes → Semestres**, escreva o nome em **Novo semestre** (ex.: `2027/2`), deixe marcado **Clonar aulas do semestre ativo** (para reaproveitar a grade) e toque em **Criar**. O diário do semestre anterior fica guardado e acessível trocando o seletor.

---

## 9. Backup e segurança dos dados

Seus dados ficam no armazenamento do próprio navegador. Isso é bom para a privacidade, mas significa que **limpar os dados do navegador, trocar de celular ou desinstalar o app apaga tudo** se você não tiver backup.

### Fazer backup
**Dados → Exportar ou importar → Exportar backup JSON**. O arquivo `pontual_backup_<semestre>.json` inclui grade, instituições, regras, histórico de ponto **e o diário inteiro**.

Guarde o arquivo em um lugar seguro (Google Drive, e-mail para você mesmo, pen drive).

**Quando fazer:** pelo menos uma vez por mês. O app mostra o cartão **“Seus dados só existem neste aparelho”** quando o último backup passa de 30 dias. Em **Dados → Backup e proteção** você vê o **Último backup**.

### Proteger o armazenamento
Em **Dados → Backup e proteção**, se aparecer **“pode ser apagado pelo navegador em pouco espaço”**, toque em **Proteger**. O navegador pode ou não conceder; mantenha os backups em dia de qualquer forma.

### Restaurar
**Dados → Importar backup JSON**, escolha o arquivo e confirme. **Atenção:** importar **substitui** tudo o que está neste navegador.

---

## 10. Trocar de aparelho

1. No aparelho antigo: **Dados → Exportar backup JSON**.
2. Envie o arquivo para o aparelho novo (e-mail, Drive, cabo…).
3. No aparelho novo: abra o Pontual → **Dados → Importar backup JSON** e escolha o arquivo.

Cada aparelho tem a sua própria cópia — **não há sincronização automática**. Se usar o app no celular e no computador, exporte e importe quando quiser alinhá-los.

**Vindo do aplicativo antigo (Expo)?** Exporte o JSON por lá e importe do mesmo jeito em **Dados → Importar backup JSON**.

---

## 11. Problemas comuns

| Problema | O que fazer |
|---|---|
| **O botão de ponto não abre o portal** | Verifique em **Ajustes → Instituições** se o link começa com `https://` e está certo. Permita pop-ups/novas abas para o site. Se aparecer “Configure o link de ponto”, falta cadastrar o link ou uma regra. |
| **A aula de hoje não aparece** | Confira o **Dia da semana** da aula e o **semestre ativo** (seletor no topo). |
| **A disciplina não aparece no Diário** | O diário lista disciplinas do **semestre ativo**. Cadastre a aula na Grade ou troque o semestre. |
| **Dois dias da mesma disciplina viraram diários separados** | O nome está escrito diferente (ex.: `Cálculo I` e `Calculo 1`). Padronize o nome em **Grade** (✎ na aula); o diário se junta quando a instituição e o nome coincidem. |
| **Numeração estranha** | Confira **Aulas no dia** e a **Situação** das linhas. Faltas e feriados não contam. As datas determinam a ordem. |
| **Não recebo notificações** | Ative em **Ajustes → Lembretes e calendário**, permita no navegador, e no iPhone instale o app na tela inicial. Para garantir, use o **.ics**. |
| **O CSV abre tudo em uma coluna** | No Excel: **Dados → De Texto/CSV**, delimitador **Ponto e vírgula**. No Planilhas Google: **Arquivo → Importar**. |
| **Perdi os dados** | Importe o último backup em **Dados**. Sem backup não há como recuperar, porque nada é guardado em servidor. |
| **O app mostra versão antiga** | Feche e abra o app duas vezes (o navegador atualiza em segundo plano). No navegador, recarregue a página (Ctrl+F5 / puxar para atualizar). |
| **“Não foi possível abrir seus dados”** | Seu navegador pode estar em navegação privada ou bloqueando armazenamento. Use a janela normal e permita dados do site. |

---

## 12. Perguntas frequentes

**O Pontual bate o ponto por mim?**
Não. Ele abre o portal da sua instituição e registra no seu histórico que você foi lá (e, se confirmar, que concluiu).

**O Pontual é ligado à minha instituição?**
Não. É um app independente de organização pessoal. Ele não acessa nem envia nada aos sistemas da instituição.

**Meus dados vão para a internet?**
Não. Ficam no seu aparelho. O servidor só entrega o app. Os arquivos que você exporta ou importa (backup, CSV, planilha, calendário) são processados no próprio aparelho.

**Funciona sem internet?**
Sim, depois de carregado uma vez. Abrir o portal de ponto, claro, exige internet.

**Posso usar no celular e no computador?**
Sim, mas cada um tem seus próprios dados. Use exportar/importar para alinhar.

**Tem anúncio ou cadastro?**
Não há contas nem anúncios.

**Posso editar um registro antigo do diário?**
Sim, quando quiser: ✎ na linha, ajuste e salve; a numeração se corrige.

---

# Para quem mantém o código

Aplicativo Django que apenas **serve** uma PWA estática. Não há modelos, endpoints de gravação nem banco de dados persistente de dados pessoais no servidor.

## 13. Executar localmente

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py runserver
```

Abra `http://127.0.0.1:8000/`. O servidor de desenvolvimento é local e não deve ser exposto diretamente à internet.

## 14. Testes

```powershell
python manage.py check
python manage.py test
node --test tests_js/lib.test.js
```

- `python manage.py test`: verifica o shell da aplicação (páginas, manifest, service worker, arquivos estáticos).
- `node --test tests_js/lib.test.js`: cobre as funções puras de `static/core/lib.js` — numeração do diário, CSV/TSV, calendário `.ics`, conflitos de horário, lembretes e importação de planilha. Requer Node.js 18 ou mais novo.

## 15. Publicar na Vercel

O projeto já inclui `vercel.json` (`"framework": "python"`) e `app.py`, que expõe o WSGI do Django. Basta conectar o repositório ao projeto Vercel; cada push em `main` publica.

Variáveis de ambiente opcionais (Settings → Environment Variables):

| Variável | Efeito |
|---|---|
| `DJANGO_SECRET_KEY` | Chave secreta do Django. **Defina uma própria em produção.** |
| `DJANGO_DEBUG` | `1` liga o modo debug (na Vercel o padrão é desligado). |
| `DJANGO_ALLOWED_HOSTS` | Domínios extras (separados por vírgula), além de `.vercel.app`. |

Os arquivos estáticos são servidos com WhiteNoise direto da pasta `static/`, sem `collectstatic`.

> Ao alterar `app.css`, `app.js` ou `lib.js`, aumente a versão `?v=N` no `templates/core/index.html` e em `static/core/service-worker.js` (e o `CACHE_NAME`, e o teste em `core/tests.py`), para os usuários receberem a atualização.

## 16. Estrutura do projeto

```text
core/                 views (home, manifest, service worker) e testes Django
pontual/              configurações do projeto Django
templates/core/       index.html (shell, diálogos e navegação)
static/core/
  app.js              interface e estado (IndexedDB)
  lib.js              funções puras testáveis (sem DOM)
  app.css             estilos responsivos (mobile primeiro)
  service-worker.js   cache offline e cliques em notificações
  manifest.webmanifest  PWA e atalhos (Ponto, Diário, Grade)
tests_js/             testes Node das funções puras
app.py, vercel.json   entrada e configuração da Vercel
```

Modelo de dados (um único documento no IndexedDB do navegador): `activeSemester`, `semesters`, `userProfile`, `institutions`, `pontoRules`, `classes`, `pontoLogs`, `diary` e `settings`. O backup JSON é exatamente esse documento.
