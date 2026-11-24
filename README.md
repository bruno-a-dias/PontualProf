# Pontual

Aplicação web responsiva para grade docente e ponto eletrônico, servida por Django e instalada como PWA.

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
```
