// Ideia 25 — DataMatrix/SNCM. Porte direto do datamatrix_parser.dart.
//
// Este parser não depende de hardware (é processamento de texto), mas só
// pode ser testado de verdade com um leitor 2D físico — um leitor 1D a
// laser nunca vai gerar um código longo o suficiente para cair no ramo
// DataMatrix, então essa lógica fica dormente na prática até a Ideia 25
// confirmar que o equipamento é 2D.
//
// NÃO validar checksum do GTIN (Módulo 10 GS1) nem formato do IUM aqui —
// isso é Nível 3 da Ideia 25, fora de escopo mesmo depois do hardware
// confirmado.

export interface DadosDataMatrix {
  gtin?: string;
  validade?: string;
  lote?: string;
  ium?: string;
}

/**
 * Tenta interpretar `codigo` como um DataMatrix GS1 (com Application
 * Identifiers). Retorna `null` se for um GTIN simples (13-14 dígitos) ou
 * se o formato não for reconhecido.
 */
export function parsearDataMatrix(codigo: string): DadosDataMatrix | null {
  // Heurística: GTIN puro tem 13-14 dígitos, só numérico. Qualquer coisa
  // maior ou com caractere não numérico é candidata a DataMatrix.
  if (codigo.length <= 14 && /^\d+$/.test(codigo)) return null;

  try {
    const resultado: DadosDataMatrix = {};
    let i = 0;
    const GS = '\x1D'; // Group Separator — fim de campo variável

    while (i < codigo.length) {
      if (codigo[i] === GS) {
        i++;
        continue;
      }
      if (i + 2 > codigo.length) break;

      const ai = codigo.slice(i, i + 2);
      i += 2;

      switch (ai) {
        case '01': // GTIN — fixo, 14 dígitos
          if (i + 14 > codigo.length) return null;
          resultado.gtin = codigo.slice(i, i + 14);
          i += 14;
          break;

        case '17': { // Validade — fixo, AAMMDD
          if (i + 6 > codigo.length) return null;
          const s = codigo.slice(i, i + 6);
          i += 6;
          const ano = 2000 + Number(s.slice(0, 2));
          resultado.validade = `${ano}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
          break;
        }

        case '10': { // Lote — variável, até o próximo GS
          const gsPos = codigo.indexOf(GS, i);
          const fim = gsPos === -1 ? codigo.length : gsPos;
          resultado.lote = codigo.slice(i, fim);
          i = fim;
          break;
        }

        case '21': { // IUM — variável
          const gsPos = codigo.indexOf(GS, i);
          const fim = gsPos === -1 ? codigo.length : gsPos;
          resultado.ium = codigo.slice(i, fim);
          i = fim;
          break;
        }

        default:
          // AI não reconhecido — parar aqui, não tentar adivinhar o resto.
          return Object.keys(resultado).length === 0 ? null : resultado;
      }
    }

    return Object.keys(resultado).length === 0 ? null : resultado;
  } catch {
    return null; // qualquer erro de parsing — trata como não reconhecido
  }
}
