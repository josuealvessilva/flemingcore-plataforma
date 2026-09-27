# MANIFEST

Criado em 2026-07-05. Atualizado em julho/2026 com as Functions de Julho + infra base entregue.

## ✅ Arquivos

**functions/main.py** (750+ linhas, 15 Functions)
- 4 helpers: get_secret, get_db_connection, validar_token, log_erro
- 2 utilitárias: hello_flemingcore, metrics
- 4 do farmacêutico: buscar_medicamento, cadastrar_lote, buscar_alertas, resolver_alerta
- 5 avançadas: buscar_historico, salvar_token_fcm, projecao_diaria, enviar_notificacoes, buscar_dashboard_eurofarma
- 1 dashboard pausado: buscar_dashboard_distribuidor (Ideia 22 não é mais oficial)
- 3 de julho: enviar_email_alerta, receber_lote_sap, eva_chat (+ helper montar_contexto)
- Prometheus + error handling + logging em TODAS

**functions/configurar_custom_claims.py**
- Script standalone com os 3 UIDs reais (eurofarma, farmaceutico1, farmaceutico2)
- Bloqueador atual: precisa da credencial de conta de serviço do Josué

**docs/**
- DEPENDENCIAS.md — checklist atual (custom claims, chaves reais, system prompt EVA)
- SECURITY_CHECKLIST.md — regras que nunca quebram, incluindo as da EVA
- DEPLOY_PLAN.md — 4 fases deploy
- TEST_PLAN.md — Teste de Fundação (8 passos) + testes das 15 Functions + 3 fluxos de integração
- SAP_INTEGRATION.md — doc pronto para Rafael

**config/**
- firebase.json
- .env.example

**Raiz**
- README.md — quick start
- .gitignore
- MANIFEST.md (este)

## 🎯 Status

Código: ✅ 15 Functions, sintaxe validada, pyflakes limpo
Infra base: ✅ Entregue (IP público, RTDB, schema 16 tabelas, dados de teste)
Bloqueador atual: ❌ Custom claims (aguardando credencial de conta de serviço do Josué)
Aguardando: chave real gemini-api-key, chave real gmail-api-key, system prompt EVA

## 🚀 Próximas Ações

1. Josué gera credencial de conta de serviço
2. Rodar `configurar_custom_claims.py`
3. Rodar Teste de Fundação (8 passos, TEST_PLAN.md)
4. Testar as 3 Functions de julho
5. Deploy em PROD

**Criado por:** Claude Code
**Última atualização:** Julho 2026
