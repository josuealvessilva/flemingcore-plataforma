"""
Testes LOCAIS da Ideia 14, sem banco e sem nuvem.

Cobrem o pipeline de treino (dataset, regra do recall, artefato) e o codigo
REAL de producao — extraido do functions/main.py por ast, sem importa-lo —
rodando contra um banco FALSO em memoria. O teste contra o banco real, no
runtime real do Cloud Run, e a Function temporaria; este aqui existe para
achar erro barato antes dela.

Uso:
    venv\\Scripts\\python.exe teste_pipeline.py [caminho_do_main_antigo]
O main antigo (antes da Ideia 14) e opcional: com ele, compara a geracao de
alertas do codigo novo em fallback com a do codigo antigo, linha a linha.
"""

import ast
import csv
import datetime
import hashlib
import json
import math
import os
import re
import socket
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
MAIN = os.path.join(AQUI, "..", "functions", "main.py")
MODELO = os.path.join(AQUI, "modelo", "modelo_projecao_sobra.txt")
RELATORIO = os.path.join(AQUI, "modelo", "relatorio_treino.json")
DATASET = os.path.join(AQUI, "dados", "treino_sintetico.csv")

import gerar_dados_sinteticos as G  # noqa: E402
import treinar_modelo as T  # noqa: E402

resultados = []


def checar(nome, esperado, obtido):
    resultados.append({"teste": nome, "passou": esperado == obtido,
                       "esperado": esperado if esperado != obtido else "=", "obtido": obtido})


# ---------------------------------------------------------------------------
# Codigo real do main.py, extraido por ast
# ---------------------------------------------------------------------------

def extrair(caminho, funcoes, constantes):
    fonte = open(caminho, encoding="utf-8").read()
    pedacos, achados = [], set()
    for no in ast.parse(fonte).body:
        if isinstance(no, ast.FunctionDef) and no.name in funcoes:
            pedacos.append(ast.get_source_segment(fonte, no))   # sem decorator
            achados.add(no.name)
        elif isinstance(no, ast.Assign):
            for alvo in no.targets:
                if isinstance(alvo, ast.Name) and alvo.id in constantes:
                    pedacos.append(ast.get_source_segment(fonte, no))
                    achados.add(alvo.id)
    faltando = sorted((set(funcoes) | set(constantes)) - achados)
    if faltando:
        raise SystemExit(f"{caminho}: nao achei {faltando}")
    return "\n\n".join(pedacos)


FUNCOES_ML = ("_baixar_modelo_projecao", "_carregar_modelo_projecao", "_prever_sobra_ml", "_gerar_alertas_diarios")
CONSTANTES_ML = ("MODELO_PROJECAO_BUCKET", "MODELO_PROJECAO_OBJETO", "MODELO_PROJECAO_TIMEOUT_SEG",
                 "FEATURES_PROJECAO", "METODO_PROJECAO_ML", "METODO_PROJECAO_MEDIA")


class _Logger:
    def __init__(self):
        self.linhas = []

    def info(self, msg, *args):
        self.linhas.append(msg % args if args else msg)

    error = info


class _Publisher:
    def __init__(self, destino):
        self.destino = destino

    def publish(self, topico, dados):
        self.destino.append((topico, json.loads(dados.decode())))


class _PubSubFalso:
    def __init__(self):
        self.mensagens = []

    def PublisherClient(self):  # noqa: N802 — imita a API real
        return _Publisher(self.mensagens)


class _Referencia:
    def __init__(self, caminho, destino):
        self.caminho, self.destino = caminho, destino

    def set(self, valor):
        self.destino.append((self.caminho, valor))


class _RtdbFalso:
    def __init__(self):
        self.escritas = []

    def reference(self, caminho):
        return _Referencia(caminho, self.escritas)


class _CursorFalso:
    """Responde as queries da _gerar_alertas_diarios a partir de um cenario em memoria."""

    def __init__(self, banco):
        self.banco, self._fila, self.rowcount = banco, [], 0

    def execute(self, sql, params=None):
        s = " ".join(sql.split())
        self.banco.sql.append((s, params))
        if s.startswith("SELECT id_farmacia, email, token_fcm FROM usuario"):
            self._fila = list(self.banco.usuarios)
        elif s.startswith("SELECT l.id_lote, l.id_farmacia, l.validade"):
            self._fila = [l[:6] for l in self.banco.lotes]
        elif s.startswith("SELECT COALESCE(SUM(v.quantidade), 0) FROM venda"):
            self._fila = [(self.banco.vendas_90d.get(params[0], 0),)]
        elif s.startswith("INSERT INTO alerta"):
            self.banco.proximo_alerta += 1
            self.banco.alertas.append(params)
            self._fila = [(self.banco.proximo_alerta,)]
        elif s.startswith("UPDATE lote SET score_risco_atual"):
            self.banco.scores[params[1]] = params[0]
            self.rowcount = 1
        elif s.startswith("INSERT INTO projecao_lote_historico"):
            if self.banco.falhar_historico:
                raise RuntimeError('relation "projecao_lote_historico" does not exist')
            self.banco.historico.append(params)
        else:
            raise AssertionError(f"query inesperada: {s[:80]}")

    def fetchall(self):
        fila, self._fila = self._fila, []
        return fila

    def fetchone(self):
        return self._fila.pop(0)


class _BancoFalso:
    def __init__(self, lotes, vendas_90d, usuarios=(), falhar_historico=False):
        self.lotes, self.vendas_90d, self.usuarios = lotes, vendas_90d, list(usuarios)
        self.falhar_historico = falhar_historico
        self.sql, self.alertas, self.scores, self.historico = [], [], {}, []
        self.proximo_alerta, self.commits, self.rollbacks = 1000, 0, 0

    def cursor(self):
        return _CursorFalso(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


def espaco_de_execucao(codigo, banco, logger, pubsub, rtdb, baixar=None):
    erros = []
    espaco = {"json": json, "date": datetime.date, "logger": logger, "PROJECT_ID": "flemingcore-53272",
              "PUBSUB_TOPIC_EMAIL": "alertas-email", "PUBSUB_TOPIC_FCM": "alertas-fcm",
              "pubsub_v1": pubsub, "rtdb": rtdb, "get_db_connection": lambda: banco,
              "log_erro": lambda nome, e: erros.append(f"{nome}: {type(e).__name__}: {e}")}
    exec(codigo, espaco)
    if baixar is not None:
        espaco["_baixar_modelo_projecao"] = baixar
    return espaco, erros


def main():
    main_antigo = sys.argv[1] if len(sys.argv) > 1 else None

    # ---- 1. Gerador: determinismo, isolamento, invariantes ------------------
    primeira, _ = G.gerar()
    socket_original = socket.socket

    def _sem_rede(*a, **k):
        raise AssertionError("o gerador tentou abrir socket")

    socket.socket = _sem_rede
    try:
        segunda, _ = G.gerar()
        checar("gerador roda com socket bloqueado (sem banco, sem rede)", True, True)
    except AssertionError as e:
        segunda = None
        checar("gerador roda com socket bloqueado (sem banco, sem rede)", True, str(e))
    finally:
        socket.socket = socket_original
    checar("gerador e deterministico (mesma semente, mesmas linhas)", True, primeira == segunda)
    resumo = json.load(open(os.path.join(AQUI, "dados", "treino_sintetico.json"), encoding="utf-8"))
    checar("CSV em disco e o gerado por esta versao (sha256 do resumo)",
           resumo["sha256_csv"], hashlib.sha256(open(DATASET, "rb").read()).hexdigest())
    fonte_gerador = open(os.path.join(AQUI, "gerar_dados_sinteticos.py"), encoding="utf-8").read()
    imports = sorted({n.names[0].name.split(".")[0] for n in ast.walk(ast.parse(fonte_gerador))
                      if isinstance(n, ast.Import)} |
                     {n.module.split(".")[0] for n in ast.walk(ast.parse(fonte_gerador))
                      if isinstance(n, ast.ImportFrom) and n.module})
    checar("gerador so importa biblioteca padrao e numpy", ["csv", "hashlib", "json", "math", "numpy", "os"], imports)

    with open(DATASET, encoding="utf-8", newline="") as f:
        linhas = list(csv.DictReader(f))
    ruins = [l for l in linhas if not (0 <= int(l["sobra_projetada"]) <= int(l["quantidade_inicial"])
                                       and int(l["dias_ate_vencer"]) >= 0 and int(l["quantidade_inicial"]) > 0
                                       and float(l["media_venda_diaria_90d"]) >= 0
                                       and math.isfinite(float(l["media_venda_diaria_90d"])))]
    checar("invariantes: 0 <= sobra <= estoque, dias >= 0, estoque > 0, media >= 0 e finita", 0, len(ruins))
    checar("volume: pelo menos algumas centenas de linhas", True, len(linhas) >= 500)

    # ---- 2. Regra do recall (Ideia 13) e alinhamento das features -----------
    cabecalho = list(linhas[0].keys())
    checar("colunas do dataset = exatamente as do gerador", T.COLUNAS_ESPERADAS, cabecalho)
    checar("nenhuma coluna com nome de fonte proibida", [], [c for c in cabecalho if T.PROIBIDO.search(c)])
    # A regra e sobre FONTE de dado: o pipeline nao pode ler de banco nenhum,
    # e muito menos da tabela de alertas de seguranca. A palavra "recall" pode
    # aparecer — na propria trava e nas mensagens dela.
    permitidos = {"ast", "csv", "datetime", "hashlib", "json", "math", "os", "platform", "re", "sys",
                  "numpy", "scipy", "lightgbm"}
    importados, codigo_executavel = set(), []
    for arquivo in ("gerar_dados_sinteticos.py", "treinar_modelo.py"):
        fonte = open(os.path.join(AQUI, arquivo), encoding="utf-8").read()
        for no in ast.walk(ast.parse(fonte)):
            if isinstance(no, ast.Import):
                importados.update(n.name.split(".")[0] for n in no.names)
            elif isinstance(no, ast.ImportFrom) and no.module:
                importados.add(no.module.split(".")[0])
        sem_doc = re.sub(r'"""[\s\S]*?"""', "", fonte)
        codigo_executavel.extend(l for l in sem_doc.splitlines() if not l.strip().startswith("#"))
    checar("pipeline nao importa cliente de banco nem de nuvem (so padrao, numpy, scipy, lightgbm)",
           [], sorted(importados - permitidos))
    checar("pipeline nao tem SQL nem cita a tabela alerta_seguranca*", [],
           sorted({m.group(0) for l in codigo_executavel
                   for m in re.finditer(r"\bSELECT\b|\bINSERT\b|alerta_seguranca\w*", l)}))
    features_main = T.features_de_producao()
    checar("FEATURES_PROJECAO do main.py = features do treino = do gerador",
           [T.FEATURES, T.FEATURES], [features_main, list(G.FEATURES)])

    # ---- 3. Artefato do modelo -----------------------------------------------
    import lightgbm as lgb
    conteudo = open(MODELO, "rb").read()
    relatorio = json.load(open(RELATORIO, encoding="utf-8"))
    checar("sha256 do arquivo = o do relatorio de treino", relatorio["modelo"]["sha256"],
           hashlib.sha256(conteudo).hexdigest())
    checar("arquivo e texto nativo do LightGBM, nao pickle", True, conteudo.startswith(b"tree\n"))
    booster = lgb.Booster(model_str=conteudo.decode("utf-8"))
    checar("modelo carregado tem as features de producao, na ordem", T.FEATURES, booster.feature_name())
    violacoes = 0
    for q in (5, 30, 100, 300):
        for med in (0.0, 0.3, 1.0, 3.0):
            serie = booster.predict([[d, q, med] for d in range(0, 500, 5)], num_threads=1)
            violacoes += int(np.sum(np.diff(serie) > 1e-9))
    checar("monotonia: mais dias ate vencer nunca aumenta a sobra prevista", 0, violacoes)

    # ---- 4. Funcoes reais de carga e previsao --------------------------------
    codigo = extrair(MAIN, FUNCOES_ML, CONSTANTES_ML)
    banco = _BancoFalso([], {})

    def carregar_com(baixar):
        espaco, erros = espaco_de_execucao(codigo, banco, _Logger(), _PubSubFalso(), _RtdbFalso(), baixar)
        return espaco["_carregar_modelo_projecao"](), erros, espaco

    sha_modelo = hashlib.sha256(conteudo).hexdigest()
    metadados_ok = {"sha256": sha_modelo, "lightgbm_versao": lgb.__version__}
    (modelo, versao, motivo), erros, espaco = carregar_com(lambda: (conteudo, metadados_ok))
    checar("carga normal: modelo, versao = sha256[:12] do treino, sem motivo",
           [True, relatorio["modelo"]["versao_registrada_na_function"], None, []],
           [modelo is not None, versao, motivo, erros])

    # O perigo, demonstrado: o mesmo arquivo truncado, entregue DIRETO ao
    # parser, mata o processo inteiro (nenhum except pega).
    import subprocess
    import tempfile
    with tempfile.NamedTemporaryFile("wb", suffix=".txt", delete=False) as tmp:
        tmp.write(conteudo[: len(conteudo) // 2])
    direto = subprocess.run([sys.executable, "-c",
                             "import lightgbm,sys\n"
                             "try:\n lightgbm.Booster(model_str=open(sys.argv[1],'rb').read().decode())\n"
                             "except Exception as e:\n print('EXCECAO_TRATAVEL', type(e).__name__); sys.exit(0)\n"
                             "print('CARREGOU')", tmp.name], capture_output=True, text=True, errors="replace")
    os.unlink(tmp.name)
    checar("perigo real: truncado direto no LightGBM mata o processo (sem excecao tratavel)",
           [True, False], [direto.returncode != 0, "EXCECAO_TRATAVEL" in direto.stdout])

    class NotFound(Exception):
        pass

    def ausente():
        raise NotFound("404 GET .../modelos%2Fprojecao_sobra%2Fmodelo.txt: No such object")

    renomeado = conteudo.replace(b"feature_names=dias_ate_vencer quantidade_inicial media_venda_diaria_90d",
                                 b"feature_names=dias_ate_vencer estoque media_venda_diaria_90d")
    metadados_renomeado = {"sha256": hashlib.sha256(renomeado).hexdigest(), "lightgbm_versao": lgb.__version__}
    casos_falha = {
        "arquivo ausente": (ausente, "NotFound"),
        "metadado sha256 ausente": (lambda: (conteudo, {"lightgbm_versao": lgb.__version__}), "ausente"),
        "bytes aleatorios": (lambda: (os.urandom(4096), metadados_ok), "nao bate"),
        "arquivo truncado (metade) — o que mataria o processo": (
            lambda: (conteudo[: len(conteudo) // 2], metadados_ok), "nao bate"),
        "so o cabecalho (400 bytes)": (lambda: (conteudo[:400], metadados_ok), "nao bate"),
        "arquivo vazio": (lambda: (b"", metadados_ok), "nao bate"),
        "modelo valido com features diferentes (hash dele correto)": (
            lambda: (renomeado, metadados_renomeado), "features do modelo"),
        "treinado com outra versao do lightgbm": (
            lambda: (conteudo, {"sha256": sha_modelo, "lightgbm_versao": "4.6.0"}), "treinado com lightgbm 4.6.0"),
    }
    for nome, (baixar, trecho) in casos_falha.items():
        (m, v, mot), erros_c, _ = carregar_com(baixar)
        checar(f"falha de carga — {nome}: (None, None, motivo) e erro logado",
               [None, None, True, True, True],
               [m, v, isinstance(mot, str) and len(mot) <= 300, bool(mot) and trecho in mot, len(erros_c) == 1])
    guardado = sys.modules.get("lightgbm")
    sys.modules["lightgbm"] = None       # import lightgbm passa a levantar ImportError
    try:
        (m, v, mot), _, _ = carregar_com(lambda: (conteudo, metadados_ok))
    finally:
        sys.modules["lightgbm"] = guardado
    checar("falha de carga — biblioteca que nao importa: fallback com erro de import",
           [None, None, True], [m, v, bool(mot) and mot.split(":")[0] in ("ImportError", "ModuleNotFoundError")])

    prever = espaco["_prever_sobra_ml"]
    X_teste = np.array([[35, 30, 0.0], [35, 30, 1.5], [60, 100, 0.0], [0, 7, 0.3], [400, 50, 0.0],
                        [5, 1, 0.0], [120, 250, 2.2], [1, 3000, 0.01]], dtype=float)
    servidos_function = [prever(modelo, int(d), int(q), float(m_)) for d, q, m_ in X_teste]
    servidos_treino = [int(v) for v in T.servir(booster.predict(X_teste, num_threads=1), X_teste[:, 1])]
    checar("paridade: pos-processamento da Function = o avaliado no treino", servidos_treino, servidos_function)
    checar("previsao sempre inteira e dentro de [0, estoque]", True,
           all(isinstance(s, int) and 0 <= s <= int(q) for s, q in zip(servidos_function, X_teste[:, 1])))

    class _ModeloNaN:
        def predict(self, X, **k):
            return [float("nan")]

    try:
        prever(_ModeloNaN(), 10, 10, 0.1)
        levantou = False
    except ValueError:
        levantou = True
    checar("previsao NaN levanta (vira fallback do lote, nunca sobra NaN)", True, levantou)

    # ---- 5. _gerar_alertas_diarios real contra banco falso -------------------
    hoje = datetime.date.today()
    lotes = [  # id, farmacia, validade, quantidade, preco, nome
        (2, 1, hoje + datetime.timedelta(days=35), 30, 12.5, "Dipirona"),
        (3, 1, hoje + datetime.timedelta(days=200), 40, 8.0, "Paracetamol"),
        (90, 7, hoje + datetime.timedelta(days=5), 900, 20.0, "Caro vencendo"),   # score alto: alerta
    ]
    vendas = {2: 18, 3: 60, 90: 0}
    usuarios = [(1, "a@x.invalid", "tok1"), (7, "b@x.invalid", None)]

    def rodar(codigo_fonte, modelo_proj=None, falhar_historico=False, trocar_prever=None, antigo=False):
        b = _BancoFalso(lotes, vendas, usuarios, falhar_historico)
        log, ps, rt = _Logger(), _PubSubFalso(), _RtdbFalso()
        esp, erros_ = espaco_de_execucao(codigo_fonte, b, log, ps, rt, lambda: (conteudo, metadados_ok))
        if trocar_prever:
            esp["_prever_sobra_ml"] = trocar_prever(esp["_prever_sobra_ml"])
        res = esp["_gerar_alertas_diarios"]() if antigo else esp["_gerar_alertas_diarios"](modelo_proj)
        return res, b, ps, rt, log, erros_

    res_ml, b_ml, ps_ml, rt_ml, log_ml, err_ml = rodar(codigo, (modelo, versao, None))
    checar("modelo carregado: todo lote 'ml', motivo nulo, versao gravada",
           [["ml", None, versao]] * 3, [[h[2], h[7], h[6]] for h in b_ml.historico])
    checar("resultado traz metodo do dia e contagem por metodo",
           ["ml", {"ml": 3, "media_90d": 0}, 3, 3, versao],
           [res_ml["metodo_projecao_dia"], res_ml["lotes_por_metodo"], res_ml["projecoes_registradas"],
            res_ml["scores_gravados"], res_ml.get("modelo_versao")])
    sobra_ml = {h[0]: h[3] for h in b_ml.historico}
    esperado_ml = {2: prever(modelo, 35, 30, 18 / 90), 3: prever(modelo, 200, 40, 60 / 90),
                   90: prever(modelo, 5, 900, 0.0)}
    checar("sobra gravada = previsao do modelo com a media SEM piso", esperado_ml, sobra_ml)
    # Parametros do INSERT de alerta: (tipo, severidade, mensagem, score,
    # recomendacao, valor_risco, sobra_projetada, id_lote, id_farmacia).
    checar("alerta usa a sobra do modelo (coluna sobra_projetada do INSERT)",
           [sobra_ml[a[7]] for a in b_ml.alertas], [a[6] for a in b_ml.alertas])
    checar("cenario de teste gera pelo menos um alerta pelo caminho do modelo", True, len(b_ml.alertas) >= 1)
    ordem = [s for s, _ in b_ml.sql]
    ultimo_insert_alerta = max(i for i, s in enumerate(ordem) if s.startswith("INSERT INTO alerta"))
    primeiro_historico = min(i for i, s in enumerate(ordem) if s.startswith("INSERT INTO projecao_lote_historico"))
    checar("historico gravado so depois do ultimo INSERT de alerta (fora da janela)", True,
           primeiro_historico > ultimo_insert_alerta)
    checar("rastro no log com o metodo do dia", True,
           any('"metodo_projecao_dia": "ml"' in l for l in log_ml.linhas))

    motivo_carga = "Forbidden: 403 firebase-functions@ sem storage.objects.get"
    res_fb, b_fb, ps_fb, rt_fb, _, _ = rodar(codigo, (None, None, motivo_carga))
    checar("falha de carga: TODO lote 'media_90d', mesmo motivo, sem versao",
           [["media_90d", motivo_carga, None]] * 3, [[h[2], h[7], h[6]] for h in b_fb.historico])
    checar("falha de carga: sobra usada = sobra da media em todo lote", True,
           all(h[3] == h[4] for h in b_fb.historico))
    checar("falha de carga: resultado explica", ["media_90d", {"ml": 0, "media_90d": 3}, motivo_carga, None],
           [res_fb["metodo_projecao_dia"], res_fb["lotes_por_metodo"], res_fb.get("falha_carga_modelo"),
            res_fb.get("modelo_versao")])

    def falhar_no_lote_3(original):
        def trocado(m, dias, qtd, media):
            if qtd == 40:
                raise RuntimeError("falha pontual simulada")
            return original(m, dias, qtd, media)
        return trocado

    res_pl, b_pl, _, _, _, err_pl = rodar(codigo, (modelo, versao, None), trocar_prever=falhar_no_lote_3)
    por_lote = {h[0]: (h[2], h[7], h[6]) for h in b_pl.historico}
    checar("falha pontual: so o lote 3 cai para a media, com motivo e versao; os outros seguem 'ml'",
           {2: ("ml", None, versao), 3: ("media_90d", "previsao do lote falhou: RuntimeError: falha pontual simulada",
                                         versao), 90: ("ml", None, versao)}, por_lote)
    checar("falha pontual: metodo do dia segue 'ml' e contagem mostra a excecao",
           ["ml", {"ml": 2, "media_90d": 1}], [res_pl["metodo_projecao_dia"], res_pl["lotes_por_metodo"]])
    checar("falha pontual: erro logado", True, any("previsao" in e for e in err_pl))

    res_sh, b_sh, _, _, _, err_sh = rodar(codigo, (modelo, versao, None), falhar_historico=True)
    checar("historico falha: scores e historico caem juntos (mesma transacao), alertas ja commitados",
           [0, 0, True, True, True],
           [res_sh["scores_gravados"], res_sh["projecoes_registradas"], "erro_score" in res_sh,
            b_sh.rollbacks == 1, len(b_sh.alertas) >= 1])

    if main_antigo:
        codigo_antigo = extrair(main_antigo, ("_gerar_alertas_diarios",), ())
        res_old, b_old, ps_old, rt_old, _, _ = rodar(codigo_antigo, antigo=True)
        checar("regressao: em fallback, alertas identicos ao codigo antigo", b_old.alertas, b_fb.alertas)
        checar("regressao: em fallback, scores identicos ao codigo antigo", b_old.scores, b_fb.scores)
        checar("regressao: em fallback, Pub/Sub e RTDB identicos ao codigo antigo",
               [ps_old.mensagens, rt_old.escritas], [ps_fb.mensagens, rt_fb.escritas])
        checar("regressao: resultado novo contem as chaves antigas com os mesmos valores",
               res_old, {k: res_fb[k] for k in res_old})
        checar("contrato: payload Pub/Sub com ML tem as mesmas chaves e tipos do antigo",
               [sorted((k, type(v).__name__) for k, v in m.items()) for _, m in ps_old.mensagens],
               [sorted((k, type(v).__name__) for k, v in m.items()) for _, m in ps_ml.mensagens])
        checar("contrato: no RTDB com ML tem as mesmas chaves e tipos do antigo",
               [sorted((k, type(v).__name__) for k, v in v_.items()) for _, v_ in rt_old.escritas],
               [sorted((k, type(v).__name__) for k, v in v_.items()) for _, v_ in rt_ml.escritas])

    # ---- 6. Ordem no orquestrador: modelo antes de ligar o banco ------------
    codigo_orq = extrair(MAIN, ("orquestrar_projecao_diaria",), ("ORQUESTRADOR_ESPERA_MAXIMA_SEG",))

    class _Resposta:
        def __init__(self, corpo, status=200, content_type=None):
            self.corpo, self.status = json.loads(corpo), status

    class _HttpsFn:
        Response = _Resposta
        Request = object      # so para a anotacao da assinatura

    class _Metrica:
        def labels(self, **k):
            return self

        def inc(self, *a):
            pass

        def observe(self, *a):
            pass

    def rodar_orquestrador(carregar):
        chamadas = []
        esp = {"json": json, "time": __import__("time"), "https_fn": _HttpsFn, "requisicoes": _Metrica(),
               "latencia": _Metrica(), "log_erro": lambda n, e: chamadas.append(f"log_erro:{n}"),
               "ORQUESTRADOR_FALHA_SIMULADA": None,
               "_carregar_modelo_projecao": carregar,
               "_definir_activation_policy": lambda p: chamadas.append(p),
               "_aguardar_runnable": lambda lim: chamadas.append("aguardar") or 1.0,
               "_gerar_alertas_diarios": lambda mp=None: chamadas.append(("gerar", mp)) or {"lotes_avaliados": 0},
               "_snapshot_historico_diario": lambda: chamadas.append("snapshot") or {}}
        exec(codigo_orq, esp)
        resp = esp["orquestrar_projecao_diaria"](None)
        return chamadas, resp

    marcador = ("MODELO", "v", None)
    chamadas, resp = rodar_orquestrador(lambda: marcador)
    checar("orquestrador: carrega o modelo antes do ALWAYS e passa o mesmo objeto adiante",
           ["ALWAYS", "aguardar", ("gerar", marcador), "snapshot", "NEVER"], chamadas)
    checar("orquestrador: resposta 200", 200, resp.status)

    def carga_que_explode():
        raise MemoryError("simulando morte na carga")

    chamadas, resp = rodar_orquestrador(carga_que_explode)
    checar("orquestrador: se a carga explodir, o banco nunca e ligado (sem ALWAYS)",
           False, "ALWAYS" in chamadas)

    falhas = [r for r in resultados if not r["passou"]]
    print(json.dumps({"total": len(resultados), "passaram": len(resultados) - len(falhas),
                      "falhas": falhas}, ensure_ascii=False, indent=2, default=str))
    for r in resultados:
        print(("OK   " if r["passou"] else "FALHA"), r["teste"])
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
