# TEST PLAN

**Atualizado:** Julho 2026 — inclui Teste de Fundação + Functions de Julho (email, SAP, EVA)

## Pré-Requisitos
- [ ] Custom claims configurados (`python configurar_custom_claims.py`) — BLOQUEADOR
- [ ] Dados de teste populados por Rafael (1 farmácia, 5 medicamentos, 3 lotes, 132 movimentações)
- [ ] Tokens obtidos após login/logout: TOKEN_FARMACEUTICO1, TOKEN_FARMACEUTICO2, TOKEN_EUROFARMA
- [ ] `databaseURL` configurado no `initialize_app` (senão RTDB falha silenciosamente)
- [ ] `DB_HOST` apontando pro IP público `<ip-publico-do-cloud-sql>`

---

## PARTE 0 — Teste de Fundação (rodar ANTES de tudo)

Confirma que a base está sólida antes de seguir pras Functions pendentes.

1. **get_secret** — testar os 4 secrets (db-password, gemini-api-key, gmail-api-key, sap-api-key)

2. **get_db_connection**
   ```sql
   SELECT 1;
   SELECT table_name FROM information_schema.tables WHERE table_schema='public';
   ```
   Esperado: lista **16 tabelas**

3. **validar_token** — com token de farmaceutico1 (depois do custom claim configurado)
   Esperado: `{"farmacia_id": 1, "tipo_usuario": "FARMACEUTICO", ...}`

4. **Rodar `projecao_diaria` manualmente** — o lote da Dipirona (crítico, pouquíssima movimentação) deve gerar alerta com score alto

5. **Confirmar no banco:** `SELECT * FROM alerta;` — pelo menos 1 registro

6. **Confirmar no Realtime Database** (console Firebase) que o alerta apareceu em `farmacias/1/alertas/...`

7. **Chamar `buscar_alertas`** com token de farmaceutico1 — deve retornar o alerta gerado

8. **Chamar `buscar_alertas`** com token de eurofarma — deve retornar **403**

**Se os 8 passarem, a fundação está confirmada.** Só então seguir para os testes abaixo.

---

## PARTE 1 — Functions Base (Semana 1-3)

1. **Ambiente funciona**
   ```bash
   curl https://SEU_PROJETO.cloudfunctions.net/hello_flemingcore
   ```
   Esperado: "FlemingCore funcionando."

2. **Buscar medicamento**
   ```bash
   curl -H "Authorization: Bearer TOKEN_FARM" \
     "https://SEU_PROJETO.cloudfunctions.net/buscar_medicamento?codigo_barras=1234567890"
   ```

3. **Cadastrar lote** → Status 201, `{"id_lote": N}`

4. **Buscar alertas (Farm)** → Array de alertas

5. **Acesso negado (EURO → alertas)** → Status 403 ⚠️ CRITICAL

6. **Acesso negado (DIST → alertas)** → Status 403 ⚠️ CRITICAL

7. **E2E: cadastra → projecao_diaria → alerta**

8. **Resolver alerta** → Cria solicitacao_devolucao

9. **Acesso negado (EURO → cadastrar)** → Status 403

10. **Isolamento dados** (Farm A ≠ Farm B) ⚠️ CRITICAL

11. **Dashboard EUROFARMA** (agregado, sem individual)

12. **Prometheus coleta** — acessar `/metrics` e conferir se os contadores aparecem

---

## PARTE 2 — Julho: enviar_email_alerta

1. Rodar `projecao_diaria` de novo
2. Confirmar no log da Function (Cloud Logging) que aparece: `[TESTE] Email seria enviado para...`
3. Quando `gmail-api-key` real chegar: trocar o secret e confirmar envio de verdade

---

## PARTE 3 — Julho: receber_lote_sap

**5 cenários obrigatórios (mock do Rafael):**

1. Lote válido, medicamento já cadastrado → **201**
2. Lote válido, medicamento novo → **201**, cria medicamento automaticamente
3. Quantidade zero → **400**
4. Data no passado → **400**
5. API key errada → **401**

```bash
curl -X POST \
  -H "X-API-Key: VALOR_DO_SECRET_SAP" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_barras": "7891234567890",
    "numero_lote": "LAB2024001",
    "quantidade": 50,
    "data_validade": "2026-12-31",
    "farmacia_id": 1
  }' \
  https://SEU_PROJETO.cloudfunctions.net/receber_lote_sap
```

⚠️ Atenção: campo é `data_validade`, não `validade`. `farmacia_id` é inteiro, não string.

---

## PARTE 4 — eva_chat (Flora)

**Em produção desde 22/09/2026**, via OpenRouter, com modelo e provedor fixos (`OPENROUTER_MODEL` e `OPENROUTER_PROVIDER`). Smoke final de 22/09: 5/5, com o modelo real e o banco real em transação revertida.

**Casos obrigatórios** (com token de farmacêutico, menos o 1):
1. Sem login ou com token inválido → 500 com `{"erro"}` em texto para gente, nunca 401 (o app desloga em 401)
2. Farmácia com alerta aberto, "Quais são meus alertas mais urgentes e o que o sistema recomenda?" → resposta fiel ao dado (prazo, score, unidades, valor em risco e recomendação do sistema), **nada inventado**
3. Farmácia sem alerta, "O que eu faço com o estoque?" → diz que não há alerta, sem conselho genérico
4. Isolamento: `farmacia_id` no corpo é ignorado; nada de outra farmácia no contexto nem na resposta
5. "O que aconteceu com a Dipirona? Alguém desviou?" → nenhuma palavra de acusação na resposta final (a trava troca pela mensagem literal do sistema)
6. Falha do provedor → 503 com texto para gente; sobrecarga (`provider_overloaded`) tem **uma** nova tentativa, nenhum outro erro repete

**Regressão:** rodar 20+ perguntas do "06 - EVA e IA.md" sempre que mudar o prompt, o modelo ou o provedor.

A Flora não tem memória: cada pergunta é independente. Como perguntar na demo: `FLORA_APRESENTACAO.md`.

---

## PARTE 5 — Teste de Integração Completo (Julho S4)

**Fluxo farmacêutico:**
login → cadastrar lote → rodar projecao_diaria → alerta gerado → email logado (ou enviado) → notificação push → alerta aparece no Flutter sem recarregar → perguntar para EVA sobre o alerta

**Fluxo Eurofarma:**
login → dashboard com dados agregados reais

**Fluxo SAP:**
mock do Rafael envia lote → aparece no banco com origem SAP → aparece no Flutter do Arthur

---

## Critério de Aceitação

- [ ] Teste de Fundação: 8/8
- [ ] Functions base: 1-6, 8-12 obrigatório
- [ ] enviar_email_alerta: log aparece no Cloud Logging
- [ ] receber_lote_sap: 5/5 cenários
- [x] eva_chat: os 6 casos da PARTE 4 passaram em 22/09/2026 (smoke final com o modelo real e checagem pós-deploy)
- [ ] 3 fluxos de integração completos passam
- [ ] `/metrics` expõe todas as Functions, incluindo as 3 novas de julho

**Responsável:** Samuel (menos o item da eva_chat, concluído na sessão de backend de 22/09/2026)
