"""
Treina o modelo LightGBM da Ideia 14 contra o dataset SINTETICO.

PROVA DE CONCEITO DE ARQUITETURA, NAO MODELO VALIDADO. As metricas abaixo
medem o quanto o modelo reproduz a simulacao que o proprio time escreveu —
nao a capacidade de prever estoque real. Nunca apresentar como modelo mais
preciso que a media usada hoje.

Roda local, uma vez ou sob demanda. NAO faz parte do codigo que sobe como
Function. O modelo sai no formato texto nativo do LightGBM (nunca pickle:
pickle executa codigo ao ser carregado, e este arquivo vai morar num bucket).

Regra inegociavel checada aqui, antes de treinar: nenhuma coluna do dataset
pode vir de alerta_seguranca_anvisa nem de fonte de recall (Ideia 13). O
dataset precisa ter exatamente as colunas conhecidas do gerador, e as
features precisam ser exatamente as tres definidas pelo time — as mesmas, na
mesma ordem, da constante FEATURES_PROJECAO do main.py de producao.

Protocolo, para as metricas nao mentirem:
  1. Produtos de TESTE separados antes de tudo (15%). Ninguem olha para eles
     ate o fim — nem a escolha de configuracao.
  2. As configuracoes candidatas sao comparadas por validacao cruzada em 5
     dobras, so nos produtos restantes. Vence a de menor RMSE medio.
  3. A vencedora e treinada nos produtos restantes (com um pedaco deles para
     a parada antecipada) e avaliada UMA vez no teste.
Tudo separado POR PRODUTO simulado: retratos do mesmo lote tem o mesmo alvo,
e lotes do mesmo produto compartilham a mesma demanda. Separar por linha
vazaria a resposta e inflaria as metricas.

A formula atual de producao entra so como REFERENCIA, calculada nas mesmas
linhas — para quem ler o relatorio ver os dois numeros lado a lado, nao para
vender o modelo como melhor.

Uso:
    venv\\Scripts\\python.exe treinar_modelo.py
Saida: modelo/modelo_projecao_sobra.txt e modelo/relatorio_treino.json
"""

import ast
import csv
import datetime
import hashlib
import json
import math
import os
import platform
import re
import sys

import lightgbm as lgb
import numpy as np
import scipy

AQUI = os.path.dirname(os.path.abspath(__file__))
DATASET = os.path.join(AQUI, "dados", "treino_sintetico.csv")
RESUMO_DATASET = os.path.join(AQUI, "dados", "treino_sintetico.json")
SAIDA_MODELO = os.path.join(AQUI, "modelo", "modelo_projecao_sobra.txt")
SAIDA_RELATORIO = os.path.join(AQUI, "modelo", "relatorio_treino.json")
MAIN_PRODUCAO = os.path.join(AQUI, "..", "functions", "main.py")

FEATURES = ["dias_ate_vencer", "quantidade_inicial", "media_venda_diaria_90d"]
ALVO = "sobra_projetada"
GRUPO = "id_produto_simulado"
COLUNAS_ESPERADAS = ["id_produto_simulado", "id_lote_simulado", "dia_snapshot",
                     "perfil_velocidade", "sazonal", "vencimento_frequente"] + FEATURES + [ALVO]
PROIBIDO = re.compile(r"alerta|seguranca|anvisa|recall|regulat", re.IGNORECASE)

SEMENTE = 20260921
FRACAO_TESTE = 0.15
FRACAO_VALIDACAO = 0.15          # dos produtos que sobram, para a parada antecipada
DOBRAS = 5
RODADAS_MAXIMAS = 3000
PARADA_ANTECIPADA = 100

# Base comum. Restricoes monotonicas sao prior de dominio: com o resto igual,
# mais dias ate vencer nao aumenta a sobra (-1), mais estoque nao diminui
# (+1), mais venda recente nao aumenta (-1). Na validacao cruzada elas
# tambem melhoraram o erro — nao sao so cosmetica.
#
# Parada antecipada so pelo RMSE (first_metric_only). Com o MAE junto, o
# primeiro dos dois que parasse de melhorar encerrava o treino — num alvo com
# ~88% de zeros eles discordam cedo.
BASE = {
    "metric": ["rmse", "l1"],
    "learning_rate": 0.05,
    "num_leaves": 15,
    "min_data_in_leaf": 30,
    "lambda_l2": 1.0,
    "monotone_constraints": [-1, 1, -1],
    "seed": SEMENTE,
    "deterministic": True,
    "force_col_wise": True,
    "num_threads": 1,
    "verbose": -1,
}

# Candidatas. Tweedie e Poisson sao os objetivos proprios para contagem nao
# negativa com muitos zeros: trabalham em escala logaritmica, onde "estoque
# grande e venda lenta" vira soma de efeitos em vez de produto — coisa que
# arvore de regressao em escala crua representa mal. O L2 fica como controle.
CONFIGURACOES = {
    "L2": {"objective": "regression"},
    "L2_regularizado": {"objective": "regression", "min_data_in_leaf": 80, "num_leaves": 7, "lambda_l2": 10.0},
    "poisson": {"objective": "poisson"},
    "tweedie_1.3": {"objective": "tweedie", "tweedie_variance_power": 1.3},
    "tweedie_1.5": {"objective": "tweedie", "tweedie_variance_power": 1.5},
    "tweedie_1.3_sem_monotonia": {"objective": "tweedie", "tweedie_variance_power": 1.3,
                                  "monotone_constraints": [0, 0, 0]},
}


def features_de_producao():
    """Le FEATURES_PROJECAO do main.py de producao, sem importa-lo."""
    fonte = open(MAIN_PRODUCAO, encoding="utf-8").read()
    for no in ast.parse(fonte).body:
        if isinstance(no, ast.Assign) and any(
                isinstance(a, ast.Name) and a.id == "FEATURES_PROJECAO" for a in no.targets):
            return list(ast.literal_eval(no.value))
    return None


def checar_dataset(cabecalho):
    """Regra da Ideia 13 e alinhamento treino/producao. Encerra se algo falhar."""
    if cabecalho != COLUNAS_ESPERADAS:
        raise SystemExit(f"colunas do dataset diferem das esperadas: {cabecalho}")
    suspeitas = [c for c in cabecalho if PROIBIDO.search(c)]
    if suspeitas:
        raise SystemExit(f"coluna com nome de fonte proibida (recall/seguranca): {suspeitas}")
    producao = features_de_producao()
    if producao is not None and producao != FEATURES:
        raise SystemExit(f"FEATURES_PROJECAO do main.py ({producao}) difere do treino ({FEATURES})")
    return {"colunas": cabecalho, "features_usadas": FEATURES,
            "colunas_suspeitas": suspeitas,
            "features_iguais_as_de_producao": (producao == FEATURES) if producao is not None
            else "main.py ainda sem FEATURES_PROJECAO"}


def ler_dataset():
    with open(DATASET, encoding="utf-8", newline="") as f:
        leitor = csv.reader(f)
        cabecalho = next(leitor)
        checagem = checar_dataset(cabecalho)
        indice = {c: i for i, c in enumerate(cabecalho)}
        linhas = list(leitor)
    X = np.array([[float(l[indice[c]]) for c in FEATURES] for l in linhas], dtype=np.float64)
    y = np.array([float(l[indice[ALVO]]) for l in linhas], dtype=np.float64)
    grupos = np.array([int(l[indice[GRUPO]]) for l in linhas])
    perfis = [(l[indice["perfil_velocidade"]], l[indice["sazonal"]], l[indice["vencimento_frequente"]])
              for l in linhas]
    return X, y, grupos, perfis, checagem


def servir(previsto, quantidade):
    """Exatamente o que a Function faz com a saida: arredonda e prende em [0, estoque]."""
    return np.clip(np.rint(previsto), 0, quantidade)


def formula_atual(X):
    """A projecao de hoje, bit a bit: media simples de 90 dias com piso 0.1 e int()."""
    saida = []
    for dias, quantidade, media in X:
        media_diaria = media if media > 0 else 0.1
        saida.append(max(0, int(quantidade) - int(media_diaria * int(dias))))
    return np.array(saida, dtype=np.float64)


def metricas(y, previsto):
    erro = previsto - y
    return {"mae": round(float(np.mean(np.abs(erro))), 3),
            "rmse": round(float(math.sqrt(np.mean(erro ** 2))), 3),
            "vies_medio": round(float(np.mean(erro)), 3),
            "linhas": int(len(y))}


def parametros(nome):
    return dict(BASE, **CONFIGURACOES[nome])


def treinar(params, X_tr, y_tr, X_va, y_va):
    treino = lgb.Dataset(X_tr, y_tr, feature_name=FEATURES, free_raw_data=False)
    validacao = lgb.Dataset(X_va, y_va, reference=treino)
    return lgb.train(params, treino, num_boost_round=RODADAS_MAXIMAS,
                     valid_sets=[validacao], valid_names=["validacao"],
                     callbacks=[lgb.early_stopping(PARADA_ANTECIPADA, first_metric_only=True, verbose=False)])


def separar_validacao(produtos, rng):
    """Divide uma lista de produtos em (treino, validacao) para a parada antecipada."""
    embaralhados = rng.permutation(produtos)
    n_va = max(1, int(round(len(embaralhados) * FRACAO_VALIDACAO)))
    return embaralhados[n_va:], embaralhados[:n_va]


def validacao_cruzada(nome, X, y, grupos, produtos):
    """K dobras por produto, so entre os produtos fora do teste."""
    rng = np.random.default_rng(SEMENTE + 1)
    dobras = np.array_split(rng.permutation(produtos), DOBRAS)
    resultado = []
    for k, produtos_dobra in enumerate(dobras):
        restantes = np.array([g for g in produtos if g not in set(produtos_dobra)])
        p_tr, p_va = separar_validacao(restantes, np.random.default_rng(SEMENTE + 10 + k))
        m_tr, m_va, m_te = np.isin(grupos, p_tr), np.isin(grupos, p_va), np.isin(grupos, produtos_dobra)
        modelo = treinar(parametros(nome), X[m_tr], y[m_tr], X[m_va], y[m_va])
        servido = servir(modelo.predict(X[m_te], num_iteration=modelo.best_iteration), X[m_te][:, 1])
        resultado.append({"modelo": metricas(y[m_te], servido),
                          "formula_atual_referencia": metricas(y[m_te], formula_atual(X[m_te])),
                          "melhor_iteracao": int(modelo.best_iteration)})

    def faixa(chave, metrica):
        valores = [d[chave][metrica] for d in resultado]
        return {"media": round(float(np.mean(valores)), 3), "min": min(valores), "max": max(valores)}

    return {"mae": faixa("modelo", "mae"), "rmse": faixa("modelo", "rmse"),
            "formula_atual_referencia": {"mae": faixa("formula_atual_referencia", "mae"),
                                         "rmse": faixa("formula_atual_referencia", "rmse")},
            "melhores_iteracoes": [d["melhor_iteracao"] for d in resultado]}


def main():
    X, y, grupos, perfis, checagem = ler_dataset()
    produtos = np.unique(grupos)
    embaralhados = np.random.default_rng(SEMENTE).permutation(produtos)
    n_teste = int(round(len(produtos) * FRACAO_TESTE))
    produtos_teste, produtos_resto = embaralhados[:n_teste], embaralhados[n_teste:]
    em_teste = np.isin(grupos, produtos_teste)

    # 1-2. Escolha da configuracao, sem tocar no teste.
    comparacao = {nome: validacao_cruzada(nome, X, y, grupos, produtos_resto) for nome in CONFIGURACOES}
    escolhida = min(comparacao, key=lambda n: comparacao[n]["rmse"]["media"])

    # 3. Treino final nos produtos fora do teste, avaliacao unica no teste.
    p_tr, p_va = separar_validacao(produtos_resto, np.random.default_rng(SEMENTE + 99))
    em_treino, em_validacao = np.isin(grupos, p_tr), np.isin(grupos, p_va)
    if set(grupos[em_treino] ) & set(produtos_teste) or set(grupos[em_validacao]) & set(produtos_teste):
        raise SystemExit("produto de teste vazou para treino ou validacao")
    modelo = treinar(parametros(escolhida), X[em_treino], y[em_treino], X[em_validacao], y[em_validacao])
    melhor = modelo.best_iteration

    # Texto com "\n" explicito, gravado em binario: os bytes sao os mesmos em
    # Windows e Linux, e o sha256 daqui bate com o que a Function calcula.
    texto = modelo.model_to_string(num_iteration=melhor)
    os.makedirs(os.path.dirname(SAIDA_MODELO), exist_ok=True)
    with open(SAIDA_MODELO, "wb") as f:
        f.write(texto.encode("utf-8"))
    conteudo = open(SAIDA_MODELO, "rb").read()
    sha = hashlib.sha256(conteudo).hexdigest()

    # Recarrega do arquivo, como a Function vai carregar, e confere.
    recarregado = lgb.Booster(model_str=conteudo.decode("utf-8"))
    if recarregado.feature_name() != FEATURES:
        raise SystemExit(f"modelo salvo com features {recarregado.feature_name()}")
    diferenca_recarga = float(np.max(np.abs(modelo.predict(X[em_teste], num_iteration=melhor)
                                            - recarregado.predict(X[em_teste], num_threads=1))))

    avaliacao = {}
    for nome, mascara in (("treino", em_treino), ("validacao", em_validacao), ("teste", em_teste)):
        bruto = recarregado.predict(X[mascara], num_threads=1)
        avaliacao[nome] = {
            "modelo_servido": metricas(y[mascara], servir(bruto, X[mascara][:, 1])),
            "formula_atual_referencia": metricas(y[mascara], formula_atual(X[mascara])),
        }

    # Onde o modelo mais erra, no teste — por perfil da simulacao.
    por_perfil = {}
    indices_teste = np.where(em_teste)[0]
    servido_teste = servir(recarregado.predict(X[em_teste], num_threads=1), X[em_teste][:, 1])
    formula_teste = formula_atual(X[em_teste])
    for rotulo, chave in (("velocidade", 0), ("sazonal", 1), ("vencimento_frequente", 2)):
        for valor in sorted({perfis[i][chave] for i in indices_teste}):
            sel = np.array([perfis[i][chave] == valor for i in indices_teste])
            por_perfil[f"{rotulo}={valor}"] = {
                "linhas": int(sel.sum()),
                "mae_modelo": round(float(np.mean(np.abs(servido_teste[sel] - y[em_teste][sel]))), 3),
                "mae_formula_atual": round(float(np.mean(np.abs(formula_teste[sel] - y[em_teste][sel]))), 3),
            }

    ganho = recarregado.feature_importance(importance_type="gain")
    importancia = dict(zip(FEATURES, [round(float(v / max(ganho.sum(), 1e-12)), 4) for v in ganho]))
    resumo_dataset = json.load(open(RESUMO_DATASET, encoding="utf-8"))
    relatorio = {
        "aviso": ("PROVA DE CONCEITO DE ARQUITETURA, NAO MODELO VALIDADO. Treinado e avaliado so com dado "
                  "SINTETICO gerado pelo proprio time: as metricas medem o quanto o modelo reproduz a "
                  "simulacao, nao a precisao sobre estoque real. A formula atual aparece so como referencia "
                  "nas mesmas linhas — nao usar a comparacao como argumento de que o modelo e mais preciso."),
        "treinado_em_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "ambiente": {"python": platform.python_version(), "lightgbm": lgb.__version__,
                     "numpy": np.__version__, "scipy": scipy.__version__, "sistema": platform.platform()},
        "dataset": {"arquivo": "dados/treino_sintetico.csv", "sha256": resumo_dataset["sha256_csv"],
                    "linhas": int(len(y)), "produtos": int(len(produtos)),
                    "produtos_teste": int(len(produtos_teste)), "linhas_teste": int(em_teste.sum()),
                    "linhas_treino": int(em_treino.sum()), "linhas_validacao": int(em_validacao.sum()),
                    "separacao": "por produto simulado; teste separado antes da escolha de configuracao"},
        "checagem_regra_recall_e_features": checagem,
        "escolha_de_configuracao": {"criterio": "menor RMSE medio na validacao cruzada (5 dobras, sem o teste)",
                                    "escolhida": escolhida, "candidatas": comparacao},
        "parametros_finais": parametros(escolhida),
        "rodadas": {"melhor_iteracao": int(melhor), "maximo": RODADAS_MAXIMAS,
                    "parada_antecipada": PARADA_ANTECIPADA},
        "avaliacao": avaliacao,
        "teste_por_perfil": por_perfil,
        "importancia_gain_fracao": importancia,
        "modelo": {"arquivo": "modelo/modelo_projecao_sobra.txt", "bytes": len(conteudo),
                   "sha256": sha, "versao_registrada_na_function": sha[:12],
                   "formato": "texto nativo do LightGBM (model_to_string), nao pickle",
                   "diferenca_max_memoria_vs_arquivo": diferenca_recarga},
    }
    with open(SAIDA_RELATORIO, "w", encoding="utf-8") as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=2)
    print(json.dumps({"escolhida": escolhida,
                      "candidatas_cv": {n: {"mae": c["mae"]["media"], "rmse": c["rmse"]["media"],
                                            "iteracoes": c["melhores_iteracoes"]} for n, c in comparacao.items()},
                      "formula_cv": comparacao[escolhida]["formula_atual_referencia"],
                      "rodadas": relatorio["rodadas"], "avaliacao": avaliacao, "teste_por_perfil": por_perfil,
                      "importancia": importancia, "modelo": relatorio["modelo"]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.exit(main())
