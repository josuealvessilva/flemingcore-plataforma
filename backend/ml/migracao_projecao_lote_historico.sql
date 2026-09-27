-- Ideia 14 — historico auditavel do metodo de projecao de cada lote.
--
-- Uma linha por lote avaliado por execucao de _gerar_alertas_diarios, gravada
-- na MESMA transacao do score (lote.score_risco_atual). Nunca atualizada:
-- execucoes repetidas no mesmo dia geram linhas novas, cada uma com a sua
-- hora, para o alerta de qualquer data poder ser ligado ao metodo que o gerou.
--
-- Tabela propria, e nao coluna em lote: a coluna seria sobrescrita todo dia.
-- A tabela alerta nao muda.
--
-- Regras que o banco garante, nao so o codigo:
--   - metodo so 'ml' ou 'media_90d' (media SIMPLES de 90 dias por lote — o
--     calculo atual; nao existe media ponderada no sistema);
--   - linha 'ml' nunca tem motivo; linha 'media_90d' sempre tem — fallback
--     sem motivo seria justamente o implicito que a auditoria proibe;
--   - linha 'ml' sempre diz qual modelo (12 hex do sha256 do arquivo).
--
-- Rollback, se preciso ANTES do deploy do codigo que grava aqui:
--   DROP TABLE projecao_lote_historico;
-- Depois do deploy, dropar a tabela faz o INSERT falhar e, junto, a gravacao
-- dos scores do dia (mesma transacao).

CREATE TABLE projecao_lote_historico (
    id_projecao      SERIAL PRIMARY KEY,
    data_calculo     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_lote          INTEGER NOT NULL REFERENCES lote (id_lote) ON DELETE CASCADE,
    id_farmacia      INTEGER NOT NULL REFERENCES farmacia (id_farmacia) ON DELETE CASCADE,
    metodo_projecao  VARCHAR(20) NOT NULL
                     CHECK (metodo_projecao IN ('ml', 'media_90d')),
    sobra_projetada  INTEGER NOT NULL CHECK (sobra_projetada >= 0),
    sobra_media_90d  INTEGER NOT NULL CHECK (sobra_media_90d >= 0),
    score            NUMERIC(5,2) NOT NULL,
    modelo_versao    VARCHAR(64),
    motivo_fallback  VARCHAR(300),
    CONSTRAINT projecao_motivo_so_no_fallback
        CHECK ((metodo_projecao = 'ml') = (motivo_fallback IS NULL)),
    CONSTRAINT projecao_ml_tem_versao
        CHECK (metodo_projecao <> 'ml' OR modelo_versao IS NOT NULL)
);

CREATE INDEX idx_projecao_lote_data ON projecao_lote_historico (id_lote, data_calculo);
CREATE INDEX idx_projecao_farmacia_data ON projecao_lote_historico (id_farmacia, data_calculo);
