"""
Confere o modelo treinado e monta o comando de upload para o Cloud Storage.

NAO envia nada sozinho: imprime o comando gcloud exato, para rodar a mao (o
gcloud desta maquina funciona pelo Git Bash; chamar pelo subprocess do
Windows esbarra no acento de "Usuario" no caminho — ver memoria do deploy).

O que e conferido antes de imprimir:
  - sha256 do arquivo local = o do relatorio de treino (o arquivo nao mudou
    depois de validado);
  - o arquivo carrega e tem as features de producao, na ordem;
  - a versao do lightgbm do treino = a fixada em functions/requirements.txt
    (a Function recusa modelo de outra versao e cai para a media).

O sha256 e a versao sobem como METADADOS DO PROPRIO OBJETO, na mesma
operacao do upload. A Function so entrega o arquivo ao parser do LightGBM se
o hash bater: com lightgbm 4.7.0, arquivo truncado mata o processo em vez de
levantar excecao (medido em 21/09).

Uso:
    venv\\Scripts\\python.exe publicar_modelo.py
"""

import hashlib
import json
import os
import re
import sys

import lightgbm as lgb

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELO = os.path.join(AQUI, "modelo", "modelo_projecao_sobra.txt")
RELATORIO = os.path.join(AQUI, "modelo", "relatorio_treino.json")
REQUIREMENTS_FUNCTION = os.path.join(AQUI, "..", "functions", "requirements.txt")
DESTINO = "gs://flemingcore-53272-datalake/modelos/projecao_sobra/modelo.txt"
FEATURES = ["dias_ate_vencer", "quantidade_inicial", "media_venda_diaria_90d"]


def main():
    relatorio = json.load(open(RELATORIO, encoding="utf-8"))
    conteudo = open(MODELO, "rb").read()
    sha = hashlib.sha256(conteudo).hexdigest()
    problemas = []
    if sha != relatorio["modelo"]["sha256"]:
        problemas.append(f"sha256 local {sha[:12]} != relatorio {relatorio['modelo']['sha256'][:12]}")
    modelo = lgb.Booster(model_str=conteudo.decode("utf-8"))
    if modelo.feature_name() != FEATURES:
        problemas.append(f"features {modelo.feature_name()} != {FEATURES}")
    fixada = re.search(r"^lightgbm==(\S+)", open(REQUIREMENTS_FUNCTION, encoding="utf-8").read(), re.MULTILINE)
    versao_treino = relatorio["ambiente"]["lightgbm"]
    if not fixada or fixada.group(1) != versao_treino or lgb.__version__ != versao_treino:
        problemas.append(f"lightgbm: treino {versao_treino}, venv {lgb.__version__}, "
                         f"Function {fixada.group(1) if fixada else 'nao fixada'}")
    if problemas:
        print(json.dumps({"ok": False, "problemas": problemas}, ensure_ascii=False, indent=2))
        return 1

    metadados = {
        "sha256": sha,
        "lightgbm_versao": versao_treino,
        "treinado_em": relatorio["treinado_em_utc"],
        "dado": "sintetico",
        "dataset_sha256": relatorio["dataset"]["sha256"],
        "features": "|".join(FEATURES),
    }
    # Aspas simples no valor dos metadados: o "|" das features viraria pipe no
    # shell. Caminho com barra normal, que o Git Bash e o gcloud aceitam.
    comando = (f"gcloud storage cp '{MODELO.replace(chr(92), '/')}' {DESTINO} --project=flemingcore-53272 "
               f"--content-type=text/plain "
               f"--custom-metadata='{','.join(f'{k}={v}' for k, v in metadados.items())}'")
    print(json.dumps({"ok": True, "bytes": len(conteudo), "sha256": sha, "versao_na_function": sha[:12],
                      "metadados": metadados, "comando": comando}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
