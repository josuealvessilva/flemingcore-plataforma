"""
Gera o dataset SINTETICO de treino da Ideia 14 (projecao de sobra por LightGBM).

PROVA DE CONCEITO DE ARQUITETURA, NAO MODELO VALIDADO. Este arquivo inventa
estoque e venda a partir de regras que o proprio time escreveu. Um modelo
treinado aqui aprende a reproduzir essas regras — nao prova capacidade de
prever dado real desconhecido.

Nao conecta em banco nem em rede: tudo nasce aqui, de numeros pseudoaleatorios
com semente fixa. Por construcao, nenhuma coluna vem de alerta_seguranca_anvisa
nem de fonte nenhuma de recall (Ideia 13) — recall e evento raro, sem padrao
confiavel, e um modelo que tentasse aprende-lo memorizaria coincidencia.

O que a simulacao faz, dia a dia, para cada produto simulado:
  - demanda diaria de Poisson, com ruido gama por cima (dia bom, dia ruim);
  - tres perfis de velocidade (lento, medio, rapido);
  - sazonalidade anual em metade dos produtos (pico e vale, tipo antitermico
    em epoca de dengue);
  - "vencimento frequente" em ~30% dos produtos: validade curta e pedido acima
    da demanda, o padrao que gera sobra;
  - mudanca de patamar da demanda de tempos em tempos (a media dos ultimos 90
    dias nunca e o futuro exato);
  - reposicao por ponto de pedido, com lead time;
  - consumo FEFO: a demanda do dia sai do lote de validade mais curta primeiro,
    com desempate por id — a mesma ordenacao do buscar_prioridade_dispensa.

ATENCAO, registrado: o sistema NAO tem "FEFO ponderado" nem media ponderada.
A projecao em producao usa media SIMPLES dos ultimos 90 dias, por lote
(_gerar_alertas_diarios). O que esta simulacao reaproveita do sistema e a
ordenacao FEFO e a definicao exata das features.

Cada linha e um "retrato" de um lote num dia de projecao, com as mesmas
colunas definidas pelo time, calculadas como a producao calcula:
  dias_ate_vencer         validade - dia da projecao (o dia da validade ainda vende)
  quantidade_inicial      estoque do lote no inicio do dia da projecao — o ponto
                          de partida do horizonte projetado, que e o que a
                          producao tem (lote.quantidade). A quantidade de
                          recebimento nao e guardada para lotes antigos.
  media_venda_diaria_90d  vendas DO LOTE nos 90 dias anteriores / 90, sem piso
                          (a producao usa piso de 0.1 so dentro da formula)
  sobra_projetada         ALVO: unidades do lote que sobraram no fim do dia da
                          validade, na simulacao. E o que a projecao tenta prever.

Colunas extras, que NUNCA entram como feature: id_produto_simulado e
id_lote_simulado (para separar treino e teste por produto, sem vazamento),
dia_snapshot, e as marcas de perfil (para ver onde o modelo erra mais).

Uso:
    venv\\Scripts\\python.exe gerar_dados_sinteticos.py
Saida: dados/treino_sintetico.csv e dados/treino_sintetico.json (resumo).
"""

import csv
import hashlib
import json
import math
import os

import numpy as np

SEMENTE = 20260921
N_PRODUTOS = 120
DIAS_AQUECIMENTO = 120          # sem retrato: a media precisa de 90 dias de historico
DIAS_SIMULADOS = 3 * 365
JANELA_MEDIA_DIAS = 90          # mesma janela da projecao em producao
RETRATOS_POR_LOTE = 4

# (nome, probabilidade, faixa de demanda base em unidades/dia). Suposicoes
# plausiveis para uma farmacia pequena, NAO calibradas com dado real.
PERFIS_VELOCIDADE = (
    ("lento", 0.35, (0.05, 0.6)),
    ("medio", 0.45, (0.6, 3.0)),
    ("rapido", 0.20, (3.0, 10.0)),
)
PROB_SAZONAL = 0.5
PROB_VENCIMENTO_FREQUENTE = 0.3

FEATURES = ("dias_ate_vencer", "quantidade_inicial", "media_venda_diaria_90d")
ALVO = "sobra_projetada"
COLUNAS = ("id_produto_simulado", "id_lote_simulado", "dia_snapshot",
           "perfil_velocidade", "sazonal", "vencimento_frequente") + FEATURES + (ALVO,)

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA_CSV = os.path.join(AQUI, "dados", "treino_sintetico.csv")
SAIDA_RESUMO = os.path.join(AQUI, "dados", "treino_sintetico.json")


class Lote:
    __slots__ = ("id", "chegada", "validade", "quantidade", "vendas", "sobra", "dias_ativos")

    def __init__(self, id_lote, chegada, validade, quantidade):
        self.id = id_lote
        self.chegada = chegada
        self.validade = validade      # ultimo dia em que ainda vende
        self.quantidade = quantidade
        self.vendas = {}              # dia -> unidades vendidas deste lote
        self.sobra = None             # conhecida so quando zera ou vence
        self.dias_ativos = []         # (dia, estoque no inicio do dia)


def _sortear_perfil(rng):
    sorteio = rng.random()
    acumulado = 0.0
    for nome, prob, (minimo, maximo) in PERFIS_VELOCIDADE:
        acumulado += prob
        if sorteio < acumulado:
            return nome, rng.uniform(minimo, maximo)
    nome, _, (minimo, maximo) = PERFIS_VELOCIDADE[-1]
    return nome, rng.uniform(minimo, maximo)


def simular_produto(rng, id_produto, proximo_id_lote):
    """Simula um produto do inicio ao fim. Devolve (perfil, lotes, proximo_id)."""
    perfil, demanda_base = _sortear_perfil(rng)
    sazonal = rng.random() < PROB_SAZONAL
    amplitude = rng.uniform(0.25, 0.7) if sazonal else 0.0
    fase = rng.uniform(0, 365)
    frequente = rng.random() < PROB_VENCIMENTO_FREQUENTE
    vida_base = rng.uniform(60, 180) if frequente else rng.uniform(240, 720)
    excesso_pedido = rng.uniform(1.6, 3.0) if frequente else rng.uniform(0.8, 1.3)
    lead_time = int(rng.integers(3, 8))
    dias_seguranca = rng.uniform(7, 14)

    patamar = 1.0
    proxima_troca = int(rng.integers(120, 241))
    lotes = []
    chegada_pedido = None
    total_dias = DIAS_AQUECIMENTO + DIAS_SIMULADOS

    def receber(dia):
        nonlocal proximo_id_lote
        cobertura = rng.uniform(30, 90)
        quantidade = max(1, int(round(demanda_base * cobertura * excesso_pedido)))
        vida = max(20, int(round(vida_base * rng.uniform(0.85, 1.15))))
        lotes.append(Lote(proximo_id_lote, dia, dia + vida, quantidade))
        proximo_id_lote += 1

    receber(0)
    for dia in range(total_dias):
        if dia == proxima_troca:
            patamar *= math.exp(rng.normal(0.0, 0.25))
            proxima_troca += int(rng.integers(120, 241))
        if chegada_pedido == dia:
            receber(dia)
            chegada_pedido = None

        ativos = [l for l in lotes if l.sobra is None]
        for lote in ativos:
            lote.dias_ativos.append((dia, lote.quantidade))

        # Ponto de pedido pela demanda base: a farmacia simulada nao conhece a
        # estacao nem o patamar do momento — erra como uma farmacia real erraria.
        estoque = sum(l.quantidade for l in ativos)
        if chegada_pedido is None and estoque < demanda_base * (lead_time + dias_seguranca):
            chegada_pedido = dia + lead_time

        fator_sazonal = max(0.05, 1.0 + amplitude * math.sin(2 * math.pi * (dia - fase) / 365.0))
        ruido = rng.gamma(3.0, 1.0 / 3.0)
        demanda = int(rng.poisson(demanda_base * patamar * fator_sazonal * ruido))

        # FEFO: validade mais curta primeiro, desempate por id — a mesma
        # ordenacao do buscar_prioridade_dispensa (validade ASC, id_lote ASC).
        for lote in sorted(ativos, key=lambda l: (l.validade, l.id)):
            if demanda <= 0:
                break
            vendido = min(demanda, lote.quantidade)
            lote.quantidade -= vendido
            demanda -= vendido
            lote.vendas[dia] = vendido
            if lote.quantidade == 0:
                lote.sobra = 0            # acabou antes de vencer

        for lote in ativos:
            if lote.sobra is None and lote.validade == dia:
                lote.sobra = lote.quantidade   # venceu com sobra (pode ser 0)

    info = {"perfil_velocidade": perfil, "sazonal": int(sazonal), "vencimento_frequente": int(frequente)}
    return info, lotes, proximo_id_lote


def _media_90d(lote, dia):
    """Vendas do lote nos 90 dias anteriores ao dia da projecao, / 90, sem piso."""
    total = sum(v for d, v in lote.vendas.items() if dia - JANELA_MEDIA_DIAS <= d <= dia - 1)
    return total / JANELA_MEDIA_DIAS


def gerar():
    semente = np.random.SeedSequence(SEMENTE)
    filhos = semente.spawn(N_PRODUTOS + 1)
    rng_retrato = np.random.default_rng(filhos[-1])
    linhas = []
    lotes_censurados = 0
    proximo_id = 1
    for id_produto in range(1, N_PRODUTOS + 1):
        rng = np.random.default_rng(filhos[id_produto - 1])
        info, lotes, proximo_id = simular_produto(rng, id_produto, proximo_id)
        for lote in lotes:
            if lote.sobra is None:
                lotes_censurados += 1     # venceria depois do fim da simulacao
                continue
            candidatos = [(d, q) for d, q in lote.dias_ativos
                          if d >= DIAS_AQUECIMENTO and q > 0 and d <= lote.validade]
            if not candidatos:
                continue
            k = min(RETRATOS_POR_LOTE, len(candidatos))
            escolhidos = sorted(rng_retrato.choice(len(candidatos), size=k, replace=False))
            for i in escolhidos:
                dia, estoque = candidatos[int(i)]
                linhas.append({
                    "id_produto_simulado": id_produto,
                    "id_lote_simulado": lote.id,
                    "dia_snapshot": dia,
                    **info,
                    "dias_ate_vencer": lote.validade - dia,
                    "quantidade_inicial": estoque,
                    "media_venda_diaria_90d": _media_90d(lote, dia),
                    "sobra_projetada": lote.sobra,
                })
    return linhas, lotes_censurados


def main():
    linhas, censurados = gerar()
    os.makedirs(os.path.dirname(SAIDA_CSV), exist_ok=True)
    with open(SAIDA_CSV, "w", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=COLUNAS, lineterminator="\n")
        escritor.writeheader()
        for linha in linhas:
            # repr() da float ida e volta exata: a media lida no treino e
            # bit a bit a mesma calculada aqui.
            linha = dict(linha, media_venda_diaria_90d=repr(linha["media_venda_diaria_90d"]))
            escritor.writerow(linha)

    sha = hashlib.sha256(open(SAIDA_CSV, "rb").read()).hexdigest()
    alvo = [l["sobra_projetada"] for l in linhas]
    resumo = {
        "dado": "SINTETICO — gerado por simulacao, sem nenhuma linha de banco ou de recall",
        "semente": SEMENTE,
        "produtos_simulados": N_PRODUTOS,
        "linhas": len(linhas),
        "lotes": len({l["id_lote_simulado"] for l in linhas}),
        "lotes_censurados_descartados": censurados,
        "colunas": list(COLUNAS),
        "features": list(FEATURES),
        "alvo": ALVO,
        "alvo_zero_pct": round(100.0 * sum(1 for a in alvo if a == 0) / len(alvo), 1),
        "alvo_media": round(sum(alvo) / len(alvo), 2),
        "alvo_max": max(alvo),
        "linhas_media_zero_pct": round(100.0 * sum(1 for l in linhas if l["media_venda_diaria_90d"] == 0)
                                       / len(linhas), 1),
        "perfis_linhas": {p: sum(1 for l in linhas if l["perfil_velocidade"] == p) for p, _, _ in PERFIS_VELOCIDADE},
        "sha256_csv": sha,
    }
    with open(SAIDA_RESUMO, "w", encoding="utf-8") as f:
        json.dump(resumo, f, ensure_ascii=False, indent=2)
    print(json.dumps(resumo, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
