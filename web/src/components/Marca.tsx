/**
 * Assinatura da marca — símbolo + nome.
 *
 * É a mesma composição da landing page: o hexágono ciano, "Fleming" na cor
 * do texto e "Core" na cor da marca, em Sora. Repetir aqui o que o site faz
 * é o que faz o app e o site parecerem o mesmo produto.
 *
 * `sobreEscuro` força o texto branco — a sidebar e o painel do login são
 * escuros nos dois modos, então lá a cor do tema não serve.
 */
export function Marca({
  tamanho = 26,
  sobreEscuro = false,
}: {
  tamanho?: number;
  sobreEscuro?: boolean;
}) {
  return (
    <span
      aria-label="FlemingCore"
      style={{ display: 'inline-flex', alignItems: 'center', gap: tamanho * 0.34 }}
    >
      <img
        src="/marca-flemingcore.png"
        alt=""
        aria-hidden="true"
        width={tamanho}
        height={tamanho}
        style={{ width: tamanho, height: tamanho, objectFit: 'contain', flexShrink: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--fonte-display)',
          fontWeight: 700,
          fontSize: tamanho * 0.72,
          letterSpacing: '-.02em',
          color: sobreEscuro ? '#FFFFFF' : 'var(--texto)',
          whiteSpace: 'nowrap',
        }}
      >
        Fleming<span style={{ color: sobreEscuro ? '#6FC0F5' : 'var(--primaria)' }}>Core</span>
      </span>
    </span>
  );
}
