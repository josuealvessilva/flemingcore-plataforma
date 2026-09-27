# DEPLOY PLAN

4 fases para colocar em produção.

## Fase 1: Setup Local (30 min)
```bash
npm install -g firebase-tools
firebase login
cd FlemingCore-Backend/functions
pip install -r requirements.txt
```

## Fase 2: Configurar Env (30 min)
```bash
firebase use flemingcore-53272
# NOTA: só existe o projeto flemingcore-53272 até agora — flemingcore-prod
# ainda não foi criado (confirmado em DEPENDENCIAS.md). Ignorar "--add"
# e a escolha dev/prod do plano original até esse ambiente existir de fato.
gcloud secrets list --project=flemingcore-53272
# Deve ter: db-password, gemini-api-key, gmail-oauth-credentials, sap-api-key
gcloud pubsub topics list --project=flemingcore-53272
# Deve ter: alertas-email, alertas-fcm

# Conexão é via IP público (<ip-publico-do-cloud-sql>), sem VPC Connector — decisão de custo.
# Se for testar local, confirmar que seu IP está em "Redes autorizadas" no Cloud SQL:
gcloud sql instances describe INSTANCIA --project=flemingcore-53272 --format="value(settings.ipConfiguration.authorizedNetworks)"
```

## Fase 3: Testar Local (1h)
```bash
firebase emulators:start --only functions
# Em outro terminal:
curl http://localhost:5001/flemingcore-53272/southamerica-east1/hello_flemingcore
```

## Fase 4: Deploy
```bash
firebase deploy --only functions
firebase functions:log

# Testes (ver TEST_PLAN.md)

# NOTA: as fases separadas "DEV"/"PROD" do plano original não se aplicam
# ainda — só existe um projeto (flemingcore-53272). Reintroduzir a divisão
# quando o ambiente de produção for criado de fato.
```

URLs de Produção (para Arthur):
- base: https://southamerica-east1-flemingcore-53272.cloudfunctions.net
- buscar_medicamento, cadastrar_lote, buscar_alertas, resolver_alerta, buscar_historico,
  salvar_token_fcm, projecao_diaria, buscar_dashboard_eurofarma, receber_lote_sap, eva_chat

Antes do deploy, rodar `python configurar_custom_claims.py` (ver docs/DEPENDENCIAS.md) —
sem isso, `validar_token` não retorna `tipo_usuario` e nada com autenticação funciona.
