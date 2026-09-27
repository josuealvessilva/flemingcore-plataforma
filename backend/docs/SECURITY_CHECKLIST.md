# SECURITY CHECKLIST

Regras que NUNCA podem quebrar:

✋ Nunca hardcodar senha, API key, credencial → sempre get_secret()
✋ Sempre validar token ANTES de tudo — única exceção: `receber_lote_sap` (usa X-API-Key, sistema externo não faz login)
✋ Sempre filtrar por farmacia_id (Farm A ≠ Farm B)
✋ EUROFARMA/DISTRIBUIDOR recebem 403 em Functions de dado individual
✋ Nunca Server Key do FCM (morto junho 2024) → messaging.send()
✋ Nunca hardcodar modelo Gemini → os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
✋ EVA nunca acessa banco diretamente → só via contexto montado por montar_contexto()
✋ EVA nunca decide → só comunica score/recomendação já calculados por projecao_diaria

## Checklist Review

- [ ] Nenhum hardcode de senha/chave
- [ ] validar_token() em TODA Function HTTP (exceto receber_lote_sap)
- [ ] receber_lote_sap valida X-API-Key contra get_secret("sap-api-key")
- [ ] WHERE id_farmacia = %s em TODA query (exceto dashboards agregados)
- [ ] 403 para EUROFARMA/DISTRIBUIDOR em Functions individuais
- [ ] Sem Server Key FCM
- [ ] Modelo Gemini via env var, nunca versão fixa hardcoded
- [ ] eva_chat só lê dados de estoque via montar_contexto() (nunca query direta pra isso) — o INSERT em historico_atividades é o único acesso direto permitido, e é só log
- [ ] Parametrized queries 100%
- [ ] Prometheus em toda Function (incluindo as 3 de julho)
- [ ] Try/except com response JSON + log_erro()
