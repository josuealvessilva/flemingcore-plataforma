# FlemingCore — Backend (Firebase Functions)

**Status:** 15 Functions implementadas | Infra base entregue | Bloqueador atual: custom claims

**Deadline:** Novembro 2026

---

## 📋 Quick Start

```bash
# 1. Instalar dependências
npm install -g firebase-tools
firebase login
cd FlemingCore-Backend/functions
pip install -r requirements.txt

# 2. Configurar custom claims (BLOQUEADOR — ver docs/DEPENDENCIAS.md)
python configurar_custom_claims.py

# 3. Deploy
firebase deploy --only functions
```

---

## 📁 Estrutura

```
FlemingCore-Backend/
├── functions/
│   ├── main.py                      ← 15 Functions + helpers
│   ├── configurar_custom_claims.py  ← Script standalone (rodar 1x)
│   └── requirements.txt
├── docs/
│   ├── DEPENDENCIAS.md          ← Bloqueadores atuais (CRÍTICO)
│   ├── SECURITY_CHECKLIST.md    ← Regras que nunca quebram
│   ├── DEPLOY_PLAN.md           ← Passo a passo
│   ├── TEST_PLAN.md             ← Teste de Fundação + testes obrigatórios
│   ├── FLORA_APRESENTACAO.md    ← Como perguntar à Flora na demo
│   └── SAP_INTEGRATION.md       ← Doc para Rafael (mock SAP)
├── config/
│   ├── firebase.json
│   └── .env.example
└── README.md (este arquivo)
```

---

## 🧩 As 15 Functions

**Base (Semana 1-3):** `hello_flemingcore`, `metrics`, `buscar_medicamento`, `cadastrar_lote`, `buscar_alertas`, `resolver_alerta`, `buscar_historico`, `salvar_token_fcm`, `projecao_diaria`, `enviar_notificacoes`, `buscar_dashboard_eurofarma`, `buscar_dashboard_distribuidor` (⚠️ pausada, Ideia 22 não é mais oficial)

**Julho:** `enviar_email_alerta`, `receber_lote_sap`, `eva_chat`

---

## 🔐 Segurança — NÃO QUEBRAR

✋ **Nunca:**
- Hardcodar senha, API key, credencial
- Pular validação de token (exceto `receber_lote_sap` — usa API key, não Firebase)
- Expor dado de uma farmácia para outra
- Deixar EUROFARMA/DISTRIBUIDOR acessar dados individuais
- Usar Server Key do FCM (morto desde junho/2024)
- Deixar a EVA acessar o banco diretamente ou tomar decisões (só comunica dado já calculado)

👉 **Sempre:**
- Validar token ANTES de qualquer operação
- Filtrar por `farmacia_id`
- Usar `get_secret()` para credenciais
- Usar `messaging.send()` do firebase-admin

Ver: [SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md)

---

## ⚙️ Decisões de Arquitetura Ativas

- **Conexão DB via IP público** (`<ip-publico-do-cloud-sql>`), sem VPC Connector — decisão de custo. Se testar local, IP precisa estar autorizado no Cloud SQL.
- **Gemini via alias `gemini-flash-latest`** (não versão fixa) — evita quebrar quando a versão específica for descontinuada, como aconteceu com `gemini-2.0-flash` em 01/06/2026.

---

## 📞 Dependências Atuais

Ver [DEPENDENCIAS.md](docs/DEPENDENCIAS.md) — resumo:

- **Bloqueador imediato:** custom claims (precisa da credencial de conta de serviço do Josué)
- **Aguardando:** chave real `gemini-api-key`, chave real `gmail-api-key`, system prompt da EVA (Vinicius e Lucas)

---

## 🚀 Deploy

```bash
firebase deploy --only functions
```

Ver: [DEPLOY_PLAN.md](docs/DEPLOY_PLAN.md)

---

## ✅ Testes

Rodar o **Teste de Fundação** (8 passos) antes de qualquer outra coisa — confirma que custom claims, banco, RTDB e `projecao_diaria` estão funcionando juntos.

Ver: [TEST_PLAN.md](docs/TEST_PLAN.md)

---

**Escrito por:** Claude Code (Cofundador Estratégico)
**Última atualização:** Julho 2026
