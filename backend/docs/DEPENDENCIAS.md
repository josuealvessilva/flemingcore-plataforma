# DEPENDÊNCIAS OBRIGATÓRIAS

**Atualizado:** Julho 2026 — infra base já entregue por Josué + Rafael. Restam itens pontuais.

## ✅ Já Entregue (infra base)

- [x] IP público Cloud SQL: `<ip-publico-do-cloud-sql>`
- [x] Realtime Database: `flemingcore-53272-default-rtdb.firebaseio.com`
- [x] Schema com 16 tabelas
- [x] Dados de teste (1 farmácia, 5 medicamentos, 3 lotes, 132 movimentações)
- [x] 4 secrets criados (mesmo que alguns ainda como placeholder)
- [x] Flora (`eva_chat`) em produção desde 22/09/2026, via OpenRouter: secret `openrouter-api-key` no lugar da `gemini-api-key`, e prompt de produção escrito a partir do "06 - EVA e IA.md" de Vinicius e Lucas. Guia da demo em `FLORA_APRESENTACAO.md`.
  - Ressalva: no plano gratuito, a recusa por limite do balde compartilhado do OpenRouter (429) não tem nova tentativa. A rota paga resolveria — decisão financeira do Josué.

## ⚠️ Pendências Atuais

| O que precisa | De quem | Status |
|---|---|---|
| Custom claims configurados | Você mesmo (`configurar_custom_claims.py`) | **Fazer agora — bloqueador** |
| Chave real `gmail-api-key` | Você ou Vinicius/Lucas | Aguardando (fallback ativo) |
| Estrutura JSON do SAP confirmada | Você documenta pro Rafael | Fazer após deploy de `receber_lote_sap` — ver `SAP_INTEGRATION.md` |
| IP autorizado no Cloud SQL (se testar local) | Josué | Já solicitado, confirmar |
| Credencial de conta de serviço (para custom claims script) | Josué — gerar em IAM → Contas de serviço → Chaves | **Bloqueador do bloqueador acima** |
| Ajuste de contrato em indicador agregado do painel — 15/09/2026 | frontend web: dono a definir | **Urgente** (ver detalhe abaixo) |
| `env.ts` do web fora de sincronia com o backend (`DADOS_FALSOS`) — 15/09/2026 | frontend web: dono a definir | **Urgente** — telas prontas mostram dado fictício sem necessidade (ver detalhe abaixo) |
| Tela de Conformidade: texto de `null` impreciso com a regra nova do Anvisa-Ready — 15/09/2026 | frontend web: dono a definir | Pendente (ver detalhe abaixo) |
| Ajuste de piso em indicador agregado do painel — 15/09/2026 | Laysla | Corrigido (ver detalhe abaixo) |
| Tela de Alertas: exibir os campos novos de campanha de vacinação do `buscar_alertas` — 16/09/2026 | frontend web: dono a definir | Pendente — sem isso a Ideia 20 fica invisível ao farmacêutico (ver detalhe abaixo) |
| Exibir a origem do lote quando vier de conector externo (Ideia 24) — 26/09/2026 | frontend web: dono a definir | Pendente — sem isso a generalização do conector fica invisível na tela (ver detalhe abaixo) |

## Detalhe: indicadores agregados do painel (15/09/2026)

Nota: havia uma limitação conhecida no cálculo de indicadores agregados quando
o volume de dados contribuintes era baixo. Corrigida.

## Detalhe: `DADOS_FALSOS` do `env.ts` fora de sincronia com o backend (15/09/2026)

Conferido em 15/09/2026 contra o `main.py` implantado: rota, parâmetros e campos de cada tela.

**Prontas — basta trocar a flag para `false`:**
- **Rastreabilidade** (`rastreabilidade`): a tela chama `buscar_clientes_por_lote?numero_lote=`; o backend lê `numero_lote` e devolve `{clientes: [{cliente_cpf, cliente_telefone, data_venda}]}`, os mesmos campos de `ClienteRastreado`. A máscara de CPF é idempotente dos dois lados.
- **Devoluções** (`devolucoes`): a tela chama `buscar_solicitacoes_devolucao` (com `?status=` opcional) e `marcar_solicitacao_enviada` com `{id_solicitacao}`; os sete campos de `SolicitacaoDevolucao` batem com o backend. Ressalva: o backend pode devolver `validade` e `data_solicitacao` nulos, e o tipo declara `string`.

**Endpoint em produção, mas nenhuma tela o consome — trocar a flag não basta:**
- **Relatório de auditoria** (`relatorioAuditoria`): nenhuma tela chama `gerar_relatorio_auditoria`. A flag só mantém na tela Histórico a tarja "Modo de teste — histórico e/ou relatório com dados fictícios", embora o histórico já venha do backend real; o botão "Exportar Relatório ANVISA" imprime a própria tela.
- **Selo** (`seloConformidade`; também `ivfFarmacia`): nenhuma tela usa essas flags. Os campos do selo que `buscar_alertas` devolve desde 14/09/2026 (`selo_ativo`, `data_calculo_selo`, `selo_status`, `selo_criterios_nao_atendidos`) não aparecem em lugar nenhum.

**Contrato divergente — rota e campos:**
- **Wrapped** (`wrapped`): a tela chama `/gerar_wrapped_anual`, que não existe; o backend implantou `buscar_retrospectiva_anual?ano=`. A tela espera cinco campos que o backend não devolve com esse nome (`total_alertas_ano`, `alertas_resolvidos_a_tempo`, `valor_economizado`, `farmaceutico_mais_ativo`, `mes_mais_critico`) e trata como texto dois campos que o backend devolve como objeto (`medicamento_mais_vendido` = `{nome, quantidade_total}` e `categoria_maior_desperdicio` = `{categoria, valor}`). O backend devolve ainda `valor_total_economizado`, `periodo_inicio`, `periodo_fim`, `economia_snapshot_inicio`, `economia_snapshot_fim`, `economia_periodo_ajustado` e `ano_solicitado`.

**Não trocar ainda:** `impactoSocial` também está desatualizada ("falta calcular_impacto_social", que existe desde 15/09/2026), mas a `ImpactoSocialScreen` precisa antes tratar `null`, `dados_suficientes` e `motivo_valor_nulo`.

## Detalhe: texto de `null` na tela de Conformidade (15/09/2026)

**O que mudou:** desde a revisão `00012-raw` do `buscar_dashboard_eurofarma`, `farmacias_anvisa_ready` só é publicado se toda farmácia cadastrada tiver índice Anvisa calculado e se prontas (índice ≥ 80) e não prontas tiverem 5 ou mais farmácias cada. Nos outros casos vem `null` — inclusive numa rede grande em que todas estão prontas, nenhuma está, ou alguma ainda não tem índice.

**Onde fica impreciso:** a `ConformidadeScreen` trata `null` corretamente (não mostra 0%), mas o texto diz "o número de farmácias contribuindo está abaixo do piso mínimo de agregação", o que não descreve esses casos.

**Texto sugerido**, para quem assumir o frontend: "Dados insuficientes para exibição — a contagem só aparece quando todas as farmácias têm índice calculado e há pelo menos 5 em cada grupo (em conformidade e fora dela), para nenhuma farmácia ser identificada."

**Contrato inalterado:** `farmacias_anvisa_ready` já é `number | null` em `tipos.ts`. Observação: nenhuma Function calcula `indice_anvisa_ready` hoje, e a regra foi validada só com dado sintético.

## Detalhe: piso de indicador agregado do painel (15/09/2026)

Nota: havia uma limitação conhecida no piso de um indicador agregado quando
o volume de dados contribuintes era baixo. Corrigida.

## Detalhe: campos novos de campanha de vacinação no `buscar_alertas` (16/09/2026)

**O que o backend passou a devolver** (Ideia 20, calculada sob demanda, sem persistir alerta): duas chaves novas, ao lado de `alertas` e dos campos de selo. Nenhum campo existente mudou.

```json
"alertas_campanha": [
  {
    "tipo": "campanha_vacinacao",
    "id_campanha": 1,
    "campanha": "Campanha Nacional de Vacinação contra a Gripe",
    "categoria": "Antitérmico",
    "data_inicio": "2026-09-01",
    "data_fim": "2026-10-31",
    "percentual_aumento_esperado": 30.0,
    "quantidade_minima": 50,
    "quantidade_recomendada": 65,
    "estoque_atual": 20,
    "faltam": 45,
    "recomendacao": "..."
  }
],
"campanhas_nao_avaliadas": [
  { "id_campanha": 2, "campanha": "...", "motivo": "regional" }
]
```

**O que falta no frontend:** a tela de Alertas ainda não lê essas chaves, então a Ideia 20 fica invisível ao farmacêutico. O `Alerta` de `tipos.ts` já aceita `tipo: 'campanha_vacinacao'`, mas esses itens **não são alertas persistidos**.

**Por que não dá para jogá-los na lista `alertas`:**
- eles não têm `id_alerta`, que é a chave da lista e o parâmetro de `resolver_alerta`: o botão de resolver devolveria 404;
- eles não têm `medicamento`, `validade` nem `quantidade`, porque são por categoria, não por lote.

**Sugestão de tratamento:** uma seção própria na tela de Alertas, sem botão de resolver, com o texto de `recomendacao` e os números de estoque. Os itens de `campanhas_nao_avaliadas` explicam por que uma campanha ativa não gerou alerta (`regional`, `sem_categoria_alvo`, `sem_percentual_esperado`, `sem_minimo_cadastrado`) e servem de diagnóstico, não de aviso ao farmacêutico.

**Observação:** como não há alerta persistido, também não há notificação push nem histórico para campanha — as duas coisas saem do orquestrador, que não foi tocado.

## Detalhe: origem do lote na tela (Ideia 24 — 26/09/2026)

**O que o backend passou a aceitar:** a `receber_lote_sap` recebe o campo opcional `sistema_origem` e grava esse texto em `lote.origem`. Sem o campo, a origem continua `'SAP'`, então o caminho do mock SAP não muda. Valores possíveis hoje: `'MANUAL'` (cadastro pela tela), `'SAP'` e qualquer rótulo que o conector enviar, com no máximo 30 caracteres, só letras, números, espaço e `. ( ) - _ /`.

**O que falta no frontend:** mostrar `lote.origem` na tela de Alertas ou de Cadastro quando a origem não for `'MANUAL'`.

**Texto sugerido:** `Origem: {origem}` — por exemplo, "Origem: PharmaSys (demo)".

**Regra que não pode ser quebrada, e é da própria especificação da Ideia 24:** nunca exibir nome de marca real (Trier, InovaFarma e afins) como origem na tela de uma demo sem parceria com a empresa — exibir "Origem: Trier" implica uma integração que não existe. O rótulo exibido tem de ser fictício ou explicitamente simulado. Nomes reais entram só na fala do pitch, como exemplo de mercado. O backend não tem como distinguir marca real de rótulo fictício: quem escolhe o valor é quem envia o dado.

## Impacto de Cada Pendência

- **Sem custom claims:** `validar_token` nunca retorna `tipo_usuario` — nenhum teste de fluxo completo funciona
- **Sem chave Gmail real:** `enviar_email_alerta` só loga, não envia (mesmo comportamento, intencional)

## Nota de Escopo

`buscar_dashboard_distribuidor` está **pausada** — "Ideia 22 não é mais oficial" conforme PDF de julho. Function permanece no código (não quebra nada), mas não é mais prioridade de entrega.

---

**Próximo passo:** rodar `configurar_custom_claims.py` assim que tiver a credencial de conta de serviço do Josué.
