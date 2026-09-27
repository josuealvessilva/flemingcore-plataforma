# FlemingCore

Plataforma de gestão de estoque farmacêutico — **Challenge Eurofarma 2026**.

O problema que o projeto ataca é simples de enunciar e caro de resolver: uma
farmácia administra milhares de lotes com validades diferentes, e a informação
que diria quais deles vão virar prejuízo está espalhada. O FlemingCore reúne
estoque, validade e giro, calcula um score de risco por lote todo dia, e avisa
o farmacêutico **antes** do vencimento, com uma recomendação de ação.

---

## O que tem aqui

```
.
├── backend/   Cloud Functions em Python + banco + modelo de ML
└── web/       Aplicação React (farmacêutico e indústria) + landing page
```

### `backend/` — 38 Cloud Functions (Python 3.11, gen2)

Tudo em um único `functions/main.py` (~6.900 linhas), por decisão de deploy do
Firebase. As Functions se dividem em:

- **Operação do farmacêutico** — cadastro de lote, alertas, resolução, histórico,
  rastreabilidade, watchlist, prioridade de dispensa.
- **Painel da indústria** — termômetro de giro por fabricante, índice de
  vulnerabilidade, conformidade, impacto social. Todo agregado tem **piso
  mínimo de farmácias contribuintes**: abaixo dele o campo sai `null`, para o
  agregado nunca revelar o dado de uma farmácia sozinha.
- **Jobs agendados** — projeção diária de risco, detecção de discrepância de
  estoque, medicamento parado, selo de conformidade, padrão de resolução do
  farmacêutico. Cada um com conta de serviço própria e OIDC.
- **Integração** — `receber_lote_sap`, conector para ERP externo, com a farmácia
  derivada da própria credencial (nunca do corpo da requisição).
- **Flora** — assistente em linguagem natural (`eva_chat`). Ela **comunica** o
  que o sistema calculou; nunca decide, nunca interpreta situação regulatória e
  nunca afirma que houve desvio.

`ml/` traz o pipeline do modelo de projeção de sobra (LightGBM), com dados
sintéticos para treino e relatório de avaliação.

### `web/` — React 18 + Vite

Duas áreas com a mesma base de autenticação e identidades visuais distintas:
farmacêutico e Eurofarma. Modo claro e escuro, 20 telas. A mesma base compila
como app de desktop (Electron) e como aplicação web.

`public/site/` é a landing page do produto, servida na raiz.

---

## Rodando localmente

**Frontend** — é o que roda sem nenhuma credencial:

```bash
cd web
npm install
npm run dev
```

`/` abre a landing page e `/app` abre a tela de login. Telas que dependem de
endpoint ainda não implementado mostram dado fictício com uma tarja de aviso —
o controle está em `web/src/config/env.ts`.

**Backend** — exige um projeto Google Cloud com Cloud SQL, Secret Manager e
Firebase Authentication configurados:

```bash
cd backend/functions
python -m venv venv && venv/Scripts/activate      # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp ../config/.env.example .env                     # preencher com os valores do seu ambiente
firebase deploy --only functions
```

---

## Segurança

Nenhum segredo vive neste repositório, e isso é regra de projeto, não descuido:

- Senha de banco, chave de API e credenciais ficam no **Google Secret Manager**,
  lidas em tempo de execução por `get_secret()`.
- `backend/config/.env.example` é modelo, com placeholders.
- Toda Function HTTP valida o token do Firebase antes de qualquer coisa; a única
  exceção é o conector de ERP, que usa chave de API porque sistema externo não
  faz login.
- Toda consulta de dado individual filtra por farmácia. Agregados da indústria
  têm piso mínimo de farmácias contribuintes.
- A chave pública do Firebase no cliente (`web/src/config/firebase.ts`) é
  identificador público por definição — vai no bundle de qualquer forma, e quem
  protege o acesso são as regras de segurança e os custom claims.

As regras que não podem ser quebradas estão em
`backend/docs/SECURITY_CHECKLIST.md`.

---

## Documentação

| Arquivo | O que é |
|---|---|
| `backend/docs/SECURITY_CHECKLIST.md` | Regras de segurança que nunca podem quebrar |
| `backend/docs/DEPENDENCIAS.md` | Pendências abertas e o que cada uma bloqueia |
| `backend/docs/DEPLOY_PLAN.md` | Passo a passo de deploy |
| `backend/docs/TEST_PLAN.md` | Plano de testes |
| `backend/docs/SAP_INTEGRATION.md` | Contrato da integração com ERP |
| `backend/docs/FLORA_APRESENTACAO.md` | Guia de uso da Flora |
| `backend/ml/README.md` | Pipeline do modelo de ML |

O `backend/README.md` e o `backend/MANIFEST.md` são documentos internos da
equipe, escritos no início do projeto — os números ali (15 Functions) refletem
aquele momento, não o estado atual.

---

## Stack

Python 3.11 · Firebase Functions gen2 · Cloud Run · PostgreSQL 18 (Cloud SQL) ·
Cloud Scheduler · Pub/Sub · Secret Manager · LightGBM · React 18 · TypeScript ·
Vite · Electron · Firebase Authentication
