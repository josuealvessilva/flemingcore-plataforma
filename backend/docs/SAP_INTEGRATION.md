# Integração SAP — Documentação para Rafael

**Function:** `receber_lote_sap`
**Autenticação:** API key no cabeçalho (nunca token Firebase — sistemas externos não fazem login)

---

## URL

Aparece no console do Firebase após o deploy. Formato:
```
https://SEU_PROJETO.cloudfunctions.net/receber_lote_sap
```

## Cabeçalho Obrigatório

```
X-API-Key: {valor do secret sap-api-key}
```

Sem isso (ou com valor errado): **401 API key invalida**

## Corpo JSON Esperado

```json
{
  "codigo_barras": "7891234567890",
  "numero_lote": "LAB2024001",
  "quantidade": 50,
  "data_validade": "2026-12-31",
  "farmacia_id": 1
}
```

⚠️ **Atenção:**
- O campo é `data_validade`, **não** `validade`
- `farmacia_id` é **número inteiro** (id real da tabela `farmacia`) — diferente do placeholder string `"farm_001"` usado antes do schema estar pronto

## Comportamento

- **Medicamento já cadastrado** (código de barras existe): usa o `id_medicamento` existente
- **Medicamento novo:** cria automaticamente com nome `"Medicamento SAP {codigo_barras}"` — alguém precisa corrigir o nome depois manualmente
- **Lote sempre criado com** `origem = 'SAP'` e `data_ultima_movimentacao = CURRENT_DATE`

## 5 Cenários de Teste

| # | Cenário | Resultado Esperado |
|---|---|---|
| 1 | Lote válido, medicamento já cadastrado | **201**, `{"id_lote": N, "origem": "SAP"}` |
| 2 | Lote válido, medicamento novo | **201**, cria medicamento + lote |
| 3 | Quantidade zero ou negativa | **400** "Quantidade invalida" |
| 4 | Data de validade no passado | **400** "Data de validade no passado" |
| 5 | API key errada | **401** "API key invalida" |

## Regras de Segurança

- Endpoint **público** (sem validação de token Firebase) — segurança depende inteiramente da API key
- Recomendação: monitorar tentativas de 401 repetidas — pode indicar tentativa de acesso não autorizado, já que este é o único endpoint sem autenticação Firebase
