# Ideia 14 — projeção de sobra por LightGBM (prova de conceito)

**Prova de conceito de arquitetura, não modelo validado.** O modelo é treinado
só com dado sintético gerado pelo próprio time. Ele aprende a reproduzir a
simulação que o time programou, e isso não prova capacidade de prever estoque
real. **Nunca apresentar como mais preciso que a média usada hoje.**

Esta pasta **não sobe como Function**: fica fora de `functions/`.

## Fala da apresentação — a versão que vale

Corrigida pelo Josué em 21/09/2026:

> "Construímos o pipeline de Machine Learning ponta a ponta, treinado com dado
> sintético neste protótipo. Em produção, com dado histórico real de múltiplas
> farmácias, o modelo aprenderia padrões que a média simples de 90 dias, usada
> hoje, não capta."

A versão anterior falava em "média ponderada", que **não existe** no sistema.
A projeção atual é a média simples das vendas do lote nos últimos 90 dias
(`_gerar_alertas_diarios`, piso de 0,1/dia). Não usar a versão anterior.

## Arquitetura (decidida pelo time: custo, dado real insuficiente)

| Etapa | Como é |
|---|---|
| Treino | Local, `treinar_modelo.py`, biblioteca `lightgbm`. Nada de Vertex AI |
| Armazenamento | `gs://flemingcore-53272-datalake/modelos/projecao_sobra/modelo.txt`, texto nativo do LightGBM (nunca pickle) |
| Serving | `_gerar_alertas_diarios` carrega o arquivo e roda `predict()` dentro da própria Function, sem endpoint |
| Retreino | Rodar os scripts abaixo e publicar o arquivo novo. Não precisa de deploy |

Vertex AI fica no roadmap pós-challenge, quando houver dado real de produção.

## Features e alvo (definidos pelo time)

| Coluna | Significado exato |
|---|---|
| `dias_ate_vencer` | validade − dia do cálculo (o dia da validade ainda vende) |
| `quantidade_inicial` | estoque do lote **no início do horizonte projetado**, ou seja, `lote.quantidade` no dia do cálculo. A quantidade de recebimento não é guardada para lotes antigos |
| `media_venda_diaria_90d` | vendas **do lote** nos 90 dias anteriores ÷ 90, **sem** o piso de 0,1 |
| `sobra_projetada` | alvo: unidades que sobram no fim do dia da validade |

A ordem é a da constante `FEATURES_PROJECAO` do `main.py`. O treino se recusa
a rodar se ela divergir, e a Function recusa um modelo com outras features.

## Regra inegociável: nada de recall (Ideia 13)

O treino nunca usa dado de `alerta_seguranca_anvisa` nem de fonte de recall.
Hoje isso vale por construção: o gerador não conecta em banco nem em rede, e
o teste roda com socket bloqueado. O `treinar_modelo.py` exige exatamente as
colunas conhecidas e recusa nome de coluna suspeito. Quando houver dado real,
o extrator precisa manter a mesma trava.

## Retreinar e publicar

```bash
cd C:\dev\flemingcore\ml
venv\Scripts\python.exe gerar_dados_sinteticos.py
venv\Scripts\python.exe treinar_modelo.py
venv\Scripts\python.exe teste_pipeline.py
venv\Scripts\python.exe publicar_modelo.py
```

O `publicar_modelo.py` confere três coisas e imprime o comando `gcloud storage
cp` exato:
- o arquivo é o validado no treino (mesmo sha256);
- as features são as de produção;
- a versão do LightGBM é a mesma fixada em `functions/requirements.txt`.

O comando grava o sha256 e a versão **como metadados do próprio objeto**, na
mesma operação.

Ambiente de treino: `requirements-treino.txt`, com as mesmas versões fixadas na
Function (`lightgbm==4.7.0`, `numpy==2.4.6`, `scipy==1.17.1`). Mudar a versão
de um lado exige mudar do outro **e retreinar**. Se as versões divergirem, a
Function recusa o modelo e usa a média.

## Por que o sha256 é obrigatório

**Medido em 21/09/2026, LightGBM 4.7.0:** arquivo de modelo **truncado não
levanta exceção**. O erro de parsing acontece dentro de uma região paralela
(OpenMP) e **mata o processo**: SIGABRT no Linux do Cloud Run, exit 127 no
Windows. Nenhum `except` pega. Sem a trava, um arquivo corrompido derrubaria a
projeção do dia em vez de cair no fallback. Com a trava, a Function só entrega
ao parser os bytes cujo sha256 bate com o do treino.

## Monitoramento pós-deploy — sinal de viés a acompanhar

Registrado por decisão do Josué em 21/09/2026. **Não bloqueou o deploy.**

**O sinal.** No dia do deploy, o modelo **reduziu o risco de um lote a 8 dias
do vencimento**. O lote 2 tinha 30 unidades e vendia 0,57/dia. A sobra caiu de
26 (média) para 21 (modelo), o score de 60,56 para 54,75, e o Fator 3 do IVF da
farmácia caiu junto. Ao mesmo tempo, a importância de features mostra que o
modelo quase não usa a velocidade de venda (0,5%).

**Por que importa.** Se esse padrão, subestimar risco em prazo curto, se repetir
com mais lotes reais, **deixa de ser imprecisão de protótipo e vira problema
real de viés**. Lote perto do vencimento é justamente onde o alerta precisa
chegar a tempo.

**Como acompanhar.** A `projecao_lote_historico` guarda as duas sobras em toda
execução, então dá para medir sem mexer em nada:

```sql
-- Lotes a 15 dias ou menos do vencimento em que o modelo projetou MENOS sobra
-- que a média de 90 dias (ou seja, menos risco).
SELECT p.data_calculo::date AS dia, p.id_lote, p.id_farmacia,
       l.validade - p.data_calculo::date AS dias_ate_vencer,
       p.sobra_projetada AS sobra_modelo, p.sobra_media_90d, p.score
  FROM projecao_lote_historico p
  JOIN lote l ON l.id_lote = p.id_lote
 WHERE p.metodo_projecao = 'ml'
   AND l.validade - p.data_calculo::date <= 15
   AND p.sobra_projetada < p.sobra_media_90d
 ORDER BY p.data_calculo DESC, p.id_lote;
```

A prova de viés de verdade exige comparar com a sobra **real** que ficou no
dia da validade. Isso só é confiável quando a venda real baixar o estoque do
lote. Hoje só a `simular_venda_pdv` faz isso; as 132 vendas históricas nunca
baixaram.

## Fallback e auditoria

- **Falha ao carregar o modelo:** arquivo ausente, sem permissão, hash
  divergente, versão diferente ou biblioteca que não importa. Nesse caso, **todos**
  os lotes do dia usam a média de 90 dias (`media_90d`), com o mesmo motivo.
- **Falha na previsão de um lote:** só esse lote cai para a média, com o motivo.
- Cada lote avaliado vira uma linha em `projecao_lote_historico`, na mesma
  transação do score. A linha guarda o método, as duas sobras (a do modelo e a
  da média), o score, a versão do modelo (12 hex do sha256) e o motivo do
  fallback.
- **Desligar o modelo sem deploy:** tire o arquivo do bucket ou a permissão de
  leitura. A próxima execução cai inteira para a média, e isso fica registrado.

## Resultado do treino de 21/09/2026 (dado sintético)

Detalhes em `modelo/relatorio_treino.json`.

- **Protocolo:**
  - 18 produtos de teste separados antes de tudo.
  - 6 configurações comparadas por validação cruzada em 5 dobras, por produto,
    sem o teste.
  - Venceu Tweedie 1.3, pelo menor RMSE. O L2 ficou bem pior (RMSE 42,7 contra
    27,2), e sem restrição monotônica também (37,4).
- **Validação cruzada, média das dobras:** modelo com MAE 5,65 e RMSE 27,24;
  fórmula atual, como referência nas mesmas linhas, com MAE 23,37 e RMSE 78,04.
- **Teste, uma avaliação:** modelo com MAE 19,10 e RMSE 65,47; fórmula com
  MAE 37,27 e RMSE 103,94.
- A distância entre validação cruzada e teste mostra o quanto o número depende
  de quais produtos caem no teste.
- **Limites que precisam acompanhar qualquer número acima:**
  - A comparação não mede precisão real. Os dois métodos foram avaliados sobre
    a simulação do time, que tem fila FEFO; a fórmula ignora essa fila por
    construção.
  - O modelo **quase não usa a média de venda** (0,5% da importância). Exemplo:
    com 30 unidades, 35 dias e venda de 1,5/dia, a fórmula projeta sobra 0 e o
    modelo projeta 14.
  - Com só essas três features, o modelo não enxerga sazonalidade nem a posição
    do lote na fila FEFO. Ele aprende outra função dos mesmos três números que a
    média já usa.
  - A média de 90 dias divide por 90 mesmo para lote com menos de 90 dias, então
    lote novo sempre parece vender devagar, na fórmula e no modelo.
