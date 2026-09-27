import { useEffect, useState } from 'react';
import { LoginScreen } from './screens/login/LoginScreen';
import { LayoutFarmaceutico } from './screens/farmaceutico/LayoutFarmaceutico';
import { LayoutEurofarma } from './screens/eurofarma/LayoutEurofarma';
import { lerClaims, observarSessao, sair, type ClaimsFlemingCore } from './services/auth';
import { iniciarNotificacoes, pararNotificacoes } from './services/notificacoes';
import { Carregando } from './components/Comuns';

export function App() {
  const [claims, setClaims] = useState<ClaimsFlemingCore | null>(null);
  const [verificando, setVerificando] = useState(true);

  // Restaura a sessão ao abrir o app e reage ao logout automático que o
  // httpInterceptor dispara em resposta 401 (sessão expirada).
  useEffect(() => {
    return observarSessao(async (user) => {
      if (!user) {
        pararNotificacoes();
        setClaims(null);
      } else {
        const c = await lerClaims(user);
        setClaims(c);
        if (c) iniciarNotificacoes(c.tipo_usuario);
      }
      setVerificando(false);
    });
  }, []);

  async function encerrarSessao() {
    pararNotificacoes();
    await sair();
    setClaims(null);
  }

  if (verificando) return <Carregando rotulo="Verificando sessão" />;

  if (!claims) {
    return (
      <LoginScreen
        onEntrou={(c) => {
          setClaims(c);
          iniciarNotificacoes(c.tipo_usuario);
        }}
      />
    );
  }

  return claims.tipo_usuario === 'FARMACEUTICO' ? (
    <LayoutFarmaceutico onSair={encerrarSessao} />
  ) : (
    <LayoutEurofarma onSair={encerrarSessao} />
  );
}
