# Pontual

Aplicação web responsiva para grade docente, ponto eletrônico e diário de classe, servida por Django e instalada como PWA.

## Recursos

- **Diário de classe**: registre número da aula, data, conteúdo ministrado e observações por disciplina. A numeração é automática (aula dupla vira "3–4"; faltas e feriados não consomem número). "Gerar datas do semestre" cria as linhas previstas para você só preencher depois. Exporte em CSV (abre no Excel em português), copie a tabela para colar em planilhas/sistemas, copie o conteúdo de uma linha, ou imprima/salve em PDF.
- **Ponto**: botão que abre o portal da instituição, confirmação "você concluiu o registro?", alerta de ponto esquecido, histórico exportável em CSV.
- **Lembretes**: notificações antes de cada janela de ponto (ver limites abaixo) e exportação da grade para a agenda do celular (`.ics`, com alarmes).
- **Grade**: visão em lista ou semanal, carga horária semanal, aviso de conflito de horário e importação por planilha CSV.
- **Segurança dos dados**: lembrete de backup, pedido de armazenamento persistente ao navegador e backup JSON que inclui o diário.
- **Aparência**: tema claro, escuro ou rubro e ouro, escolhido em Ajustes.

### Limites dos lembretes

Notificações locais dependem do navegador: funcionam com o app aberto ou instalado; em alguns Androids (Chrome) chegam com o app fechado; no iPhone exigem instalar o app na tela inicial. Para alarmes garantidos use o arquivo `.ics`.

## Dados e privacidade

Os dados do perfil, instituições, regras, aulas e histórico são guardados no IndexedDB do navegador em cada dispositivo. Django serve somente a aplicação: não existem modelos, endpoints de gravação nem banco persistente de dados pessoais no servidor. Cada dispositivo mantém uma cópia independente; sincronização automática entre dispositivos não está habilitada.

O PWA pode continuar funcionando offline depois de carregado e armazenar a grade localmente. Exporte backups JSON para transferir os dados entre dispositivos.

## Executar localmente

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py runserver
```

Abra `http://127.0.0.1:8000/`. O servidor de desenvolvimento é local e não deve ser exposto diretamente à internet.

## Dados do app Expo anterior

Em **Dados**, importe o arquivo JSON exportado pelo aplicativo antigo. A importação valida a estrutura antes de substituir o estado local deste navegador; ela não envia o arquivo ao Django.

## Validação

```powershell
python manage.py check
python manage.py test
node --test tests_js/lib.test.js
```

Os testes JavaScript cobrem as funções puras de `static/core/lib.js` (numeração do diário, CSV/TSV, calendário `.ics`, conflitos, lembretes e importação de planilha).
