import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../config/firebase';

export type TipoUsuario = 'FARMACEUTICO' | 'EUROFARMA';

export interface ClaimsFlemingCore {
  tipo_usuario: TipoUsuario;
  /** Só existe para farmacêutico. */
  farmacia_id?: number;
}

/**
 * Lê os custom claims do ID token.
 *
 * O Flutter decodificava o JWT na mão porque getIdTokenResult().claims
 * retorna null no Windows Desktop (bug do plugin firebase_auth, issues
 * #11768/#11949). No SDK JS esse bug não existe — getIdTokenResult()
 * funciona em Electron e navegador, então usamos a API oficial.
 *
 * `forcarAtualizacao` busca token novo do servidor, garantindo os claims
 * mais recentes logo após o login.
 */
export async function lerClaims(
  user: User,
  forcarAtualizacao = false,
): Promise<ClaimsFlemingCore | null> {
  const resultado = await user.getIdTokenResult(forcarAtualizacao);
  const tipo = resultado.claims['tipo_usuario'] as TipoUsuario | undefined;
  if (!tipo) return null;

  const farmaciaBruta = resultado.claims['farmacia_id'];
  return {
    tipo_usuario: tipo,
    farmacia_id:
      typeof farmaciaBruta === 'number'
        ? farmaciaBruta
        : typeof farmaciaBruta === 'string'
          ? Number(farmaciaBruta)
          : undefined,
  };
}

export class ErroLogin extends Error {}

/**
 * Login com verificação de tipo. O tipo selecionado na tela precisa bater
 * com o tipo_usuario real do token — senão desloga e nega acesso.
 */
export async function entrar(
  email: string,
  senha: string,
  tipoEsperado: TipoUsuario,
): Promise<ClaimsFlemingCore> {
  let credencial;
  try {
    credencial = await signInWithEmailAndPassword(auth, email.trim(), senha);
  } catch (e) {
    const codigo = (e as { code?: string }).code ?? '';
    if (codigo === 'auth/network-request-failed') {
      throw new ErroLogin('Sem conexão com a internet.');
    }
    throw new ErroLogin('Email ou senha incorretos.');
  }

  const claims = await lerClaims(credencial.user, true);

  if (!claims) {
    await firebaseSignOut(auth);
    throw new ErroLogin('Usuário sem permissão configurada.');
  }

  if (claims.tipo_usuario !== tipoEsperado) {
    await firebaseSignOut(auth);
    throw new ErroLogin('Acesso não autorizado para este tipo de usuário.');
  }

  return claims;
}

/**
 * Logout de verdade.
 *
 * Correção de bug: no Flutter o botão "Sair" das duas sidebars tinha o
 * signOut() comentado — o botão existia mas não fazia nada.
 */
export async function sair(): Promise<void> {
  await firebaseSignOut(auth);
}

export function observarSessao(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
