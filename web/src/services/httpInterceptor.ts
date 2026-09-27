import { auth } from '../config/firebase';
import { BASE_URL } from '../config/env';
import { sair } from './auth';

/**
 * Centraliza todas as chamadas às Cloud Functions — porte do
 * http_interceptor.dart.
 *
 * Regra que nunca pode ser quebrada: toda chamada leva o token Firebase
 * no cabeçalho Authorization.
 */

export class SessaoExpirada extends Error {
  constructor() {
    super('Sessão expirada');
  }
}

export class ErroRede extends Error {}

async function obterToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ErroRede('Usuário não autenticado');
  const token = await user.getIdToken();
  if (!token) throw new ErroRede('Não foi possível obter o token de autenticação');
  return token;
}

async function tratarResposta<T>(resposta: Response): Promise<T> {
  // 401 → sessão expirada: desloga e propaga, para a UI voltar ao login.
  if (resposta.status === 401) {
    await sair();
    throw new SessaoExpirada();
  }
  const texto = await resposta.text();
  try {
    return JSON.parse(texto) as T;
  } catch {
    // Algumas Functions respondem texto puro (ex.: "Acesso negado").
    return texto as unknown as T;
  }
}

export async function get<T>(caminho: string): Promise<T> {
  const token = await obterToken();
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Inclui o caso de bloqueio por CORS na build web: o navegador
    // rejeita antes de qualquer status chegar aqui.
    throw new ErroRede('Sem conexão. Verifique a internet.');
  }
  return tratarResposta<T>(resposta);
}

export async function post<T>(
  caminho: string,
  corpo: Record<string, unknown>,
): Promise<T> {
  const token = await obterToken();
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroRede('Sem conexão. Verifique a internet.');
  }
  return tratarResposta<T>(resposta);
}

/**
 * Variante de `post` para os POUCOS endpoints que distinguem o resultado
 * pelo código HTTP, não pelo corpo.
 *
 * NÃO é substituta do `post` — use `post` por padrão. Esta existe porque a
 * Watchlist responde 201, 409, 404 e 400 com significados diferentes, e o
 * `tratarResposta` descarta o status para simplificar as outras telas.
 * Usar esta onde o status não importa só empurra ramificação inútil para a
 * tela e faz o caso excepcional parecer o padrão.
 *
 * O corpo volta como objeto quando é JSON e como string quando é texto
 * puro, porque o backend usa os dois: o 409 e o 404 do remover_watchlist
 * vêm em JSON, mas o 404 e o 400 do adicionar_watchlist vêm em texto.
 * Quem chama precisa tratar as duas formas — ver `mensagemDoCorpo`.
 *
 * O 401 continua deslogando: a regra de sessão não muda por causa do
 * status bruto.
 */
export async function postComStatusBruto<T>(
  caminho: string,
  corpo: Record<string, unknown>,
): Promise<{ status: number; corpo: T | string }> {
  const token = await obterToken();
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroRede('Sem conexão. Verifique a internet.');
  }

  if (resposta.status === 401) {
    await sair();
    throw new SessaoExpirada();
  }

  const texto = await resposta.text();
  try {
    return { status: resposta.status, corpo: JSON.parse(texto) as T };
  } catch {
    return { status: resposta.status, corpo: texto };
  }
}

/**
 * Extrai a mensagem legível de um corpo que pode ser `{erro: "..."}` ou
 * texto puro. Existe porque o backend não é uniforme nisso — sem ela cada
 * tela repetiria o mesmo `typeof corpo === 'string'`.
 */
export function mensagemDoCorpo(corpo: unknown, padrao: string): string {
  if (typeof corpo === 'string' && corpo.trim()) return corpo.trim();
  if (corpo && typeof corpo === 'object' && 'erro' in corpo) {
    const erro = (corpo as { erro?: unknown }).erro;
    if (typeof erro === 'string' && erro.trim()) return erro.trim();
  }
  return padrao;
}
