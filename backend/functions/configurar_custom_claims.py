"""
Script standalone — NÃO é uma Firebase Function, roda localmente quando alguém chama.

Configura os custom claims dos 3 usuários de teste já criados por Rafael/Josué.
Sem isso, validar_token() nunca retorna tipo_usuario, e nenhum teste de fluxo
completo funciona.

Desde 19/09/2026 não usa arquivo de chave de conta de serviço: chama a API REST
do Firebase Auth (accounts:lookup e accounts:update) com o token do gcloud de
quem roda (precisa ser dono do projeto). Nenhuma chave baixada é necessária.

Uso:
    python configurar_custom_claims.py --backup-dir <pasta>
        só lê: salva o backup e mostra o que seria escrito
    python configurar_custom_claims.py --backup-dir <pasta> --escrever
        o mesmo, depois escreve, relê e confere

Proteções:
- Antes de qualquer escrita, o objeto completo de claims de cada usuário é lido
  e salvo em <pasta>/claims-antes-<data>.json. O arquivo nunca é sobrescrito e é
  relido antes de seguir. A pasta é obrigatória e deve ficar fora de functions/
  (que vai no deploy) e fora do repositório.
- As claims não são reconstruídas: o que se escreve é o objeto lido com os
  campos de CLAIMS por cima. Campo que já existe e não está em CLAIMS é mantido.
  Quando isso não muda nada, volta exatamente o texto lido.
- Depois de escrever, relê e confere que o gravado é exatamente o enviado.

Se alguma claim mudar de verdade, o usuário precisa fazer logout e login de novo
no app — token antigo não atualiza sozinho.
"""

import argparse
import datetime
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

PROJETO = "flemingcore-53272"
API = f"https://identitytoolkit.googleapis.com/v1/projects/{PROJETO}/"
LIMITE_CLAIMS = 1000  # tamanho máximo do JSON de claims no Firebase Auth

# Campos que este script define. O resto do objeto de claims de cada usuário é mantido.
CLAIMS = {
    "751goQMXzVPTrGaswdOYrSZLMzQ2": {"tipo_usuario": "EUROFARMA"},  # eurofarma@flemingcore.com
    "fw34yzY8pCeDZqR4e8UMLJzSPPv2": {"tipo_usuario": "FARMACEUTICO", "farmacia_id": 1},  # farmaceutico1@flemingcore.com
    "dD8xb1TIxOMxz8FN3hLw6goaC2I3": {"tipo_usuario": "FARMACEUTICO", "farmacia_id": 1},  # farmaceutico2@flemingcore.com
}


def gcloud(args):
    r = subprocess.run(f"gcloud {args} --project={PROJETO}", shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"gcloud falhou: {r.stderr.strip()[:300]}")
    return r.stdout.strip()


def chamar(token, metodo, corpo):
    req = urllib.request.Request(
        API + metodo,
        data=json.dumps(corpo).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": PROJETO,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{metodo}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}")


def ler_claims(token):
    """{uid: (email, texto de customAttributes ou None)}, direto do Firebase Auth."""
    try:
        usuarios = chamar(token, "accounts:lookup", {"localId": list(CLAIMS)}).get("users", [])
    except RuntimeError as e:
        sys.exit(str(e))
    lidos = {}
    for u in usuarios:
        if u["localId"] in lidos:
            sys.exit(f"{u['localId']} veio duas vezes na leitura")
        lidos[u["localId"]] = (u.get("email"), u.get("customAttributes"))
    faltando = sorted(set(CLAIMS) - set(lidos))
    if faltando:
        sys.exit(f"usuários não encontrados: {faltando}")
    return lidos


def salvar_backup(pasta, conta, lidos):
    agora = datetime.datetime.now(datetime.timezone.utc)
    caminho = os.path.join(pasta, f"claims-antes-{agora:%Y%m%dT%H%M%SZ}.json")
    conteudo = {
        "projeto": PROJETO,
        "lido_em_utc": agora.isoformat(timespec="seconds"),
        "conta": conta,
        "usuarios": {
            uid: {
                "email": email,
                "customAttributes": texto,
                "sha256": hashlib.sha256(texto.encode("utf-8")).hexdigest() if texto else None,
            }
            for uid, (email, texto) in lidos.items()
        },
    }
    with open(caminho, "x", encoding="utf-8") as f:  # "x": nunca sobrescreve um backup anterior
        json.dump(conteudo, f, ensure_ascii=False, indent=2)
    with open(caminho, encoding="utf-8") as f:
        relido = json.load(f)["usuarios"]
    if any(relido[uid]["customAttributes"] != texto for uid, (_, texto) in lidos.items()):
        sys.exit(f"o backup {caminho} não confere na releitura; nada foi escrito")
    return caminho


def canonico(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def planejar(lidos):
    """{uid: texto a enviar}. Parte sempre do objeto lido, nunca de uma estrutura conhecida."""
    plano = {}
    for uid, (email, texto) in lidos.items():
        try:
            atual = json.loads(texto) if texto else {}
        except ValueError:
            sys.exit(f"{email}: as claims atuais não são JSON válido; nada foi escrito")
        if not isinstance(atual, dict):
            sys.exit(f"{email}: as claims atuais não são um objeto JSON; nada foi escrito")
        novo = {**atual, **CLAIMS[uid]}
        if texto and canonico(novo) == canonico(atual):
            plano[uid] = texto  # nada muda: volta exatamente o texto lido
        else:
            plano[uid] = json.dumps(novo)  # mesmo formato que o firebase_admin gravava
        if len(plano[uid]) > LIMITE_CLAIMS:
            sys.exit(f"{email}: as claims passariam de {LIMITE_CLAIMS} caracteres; nada foi escrito")
    return plano


def main():
    p = argparse.ArgumentParser(description="Configura os custom claims dos usuários de teste.")
    p.add_argument("--backup-dir", required=True,
                   help="pasta fora de functions/ e do repositório para o backup das claims")
    p.add_argument("--escrever", action="store_true",
                   help="sem isto, só lê, salva o backup e mostra o que seria escrito")
    args = p.parse_args()
    if not os.path.isdir(args.backup_dir):
        sys.exit(f"a pasta de backup não existe: {args.backup_dir}")

    token = gcloud("auth print-access-token")
    conta = gcloud("config get-value account")
    print(f"conta: {conta}")

    lidos = ler_claims(token)
    print(f"backup: {salvar_backup(args.backup_dir, conta, lidos)}")
    plano = planejar(lidos)
    for uid, (email, texto) in lidos.items():
        situacao = "igual ao lido" if plano[uid] == texto else "MUDA"
        print(f"{email}\n  lido:     {texto}\n  escrever: {plano[uid]}  ({situacao})")
    if not args.escrever:
        print("Só leitura: nada foi escrito. Para escrever, rode de novo com --escrever.")
        return

    enviados = {}
    for uid, texto in plano.items():
        try:
            chamar(token, "accounts:update", {"localId": uid, "customAttributes": texto})
        except RuntimeError as e:
            print(f"FALHOU ao escrever {lidos[uid][0]}: {e}. Os seguintes não foram escritos.")
            break
        enviados[uid] = texto

    depois = ler_claims(token)
    ok = len(enviados) == len(plano)
    for uid, (email, texto) in depois.items():
        confere = texto == enviados.get(uid, lidos[uid][1])
        ok = ok and confere
        print(f"{email}: {'escrito' if uid in enviados else 'NÃO escrito'}, "
              f"relido {'confere' if confere else 'NÃO CONFERE'}: {texto}")
    if not ok:
        sys.exit("ERRO: veja acima. O backup tem o estado anterior.")
    print("Custom claims configurados e conferidos.")


if __name__ == "__main__":
    main()
