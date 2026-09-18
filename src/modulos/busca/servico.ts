import { env } from '../../config/env.js';
import * as off from '../../integracoes/openFoodFacts.js';
import * as openPrices from '../../integracoes/openPrices.js';
import * as overpass from '../../integracoes/overpass.js';
import { ErroExterno, naoEncontrado } from '../../utils/erros.js';
import * as locais from '../locais/repositorio.js';
import * as precos from '../precos/repositorio.js';
import * as produtos from '../produtos/repositorio.js';

export interface ResultadoBusca {
  produto: {
    id: string;
    codigoBarras: string | null;
    nome: string;
    marca: string | null;
    quantidade: string | null;
    imagemUrl: string | null;
  };
  alternativas: Array<{ id: string; nome: string; marca: string | null }>;
  ondeTem: Array<{
    localId: string;
    nome: string;
    tipo: string;
    endereco: string | null;
    cidade: string | null;
    lat: number;
    lon: number;
    distanciaMetros: number;
    distanciaTexto: string;
    preco: { valor: number; moeda: string; data: string; origem: string } | null;
  }>;
  resumo: {
    lojasNoRaio: number;
    lojasComPreco: number;
    menorPreco: number | null;
    raioMetros: number;
  };
  fontes: Array<{ nome: string; ok: boolean; detalhe?: string }>;
}

function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Executa uma promessa e, se ela falhar por causa de serviço externo,
 * devolve o valor de reserva em vez de derrubar a busca inteira.
 *
 * É o que faz o Acha Aqui continuar respondendo quando o Open Food Facts
 * está fora do ar (o que acontece com alguma frequência): o usuário recebe as
 * lojas por perto e um aviso de qual fonte não respondeu, em vez de um 500.
 */
async function tolerante<T>(
  nome: string,
  reserva: T,
  tarefa: () => Promise<T>,
  fontes: ResultadoBusca['fontes'],
): Promise<T> {
  try {
    const valor = await tarefa();
    fontes.push({ nome, ok: true });
    return valor;
  } catch (erro) {
    // Serviço externo fora do ar é esperado e some no relatório de fontes.
    // Qualquer outra coisa é bug nosso: não pode sumir calado, então vai para
    // o log com stack trace antes de a busca seguir em frente.
    if (!(erro instanceof ErroExterno)) {
      console.error(`Falha inesperada ao usar ${nome}:`, erro);
    }

    fontes.push({
      nome,
      ok: false,
      detalhe:
        erro instanceof ErroExterno ? erro.message : 'falha ao consultar',
    });
    return reserva;
  }
}

/**
 * Importa para o banco os preços que o Open Prices tem para este produto,
 * junto com as lojas correspondentes. Depois disso eles participam das
 * consultas por distância como qualquer preço registrado por usuário.
 */
async function importarPrecosExternos(
  produtoId: string,
  codigoBarras: string,
): Promise<number> {
  const externos = await openPrices.precosDoProduto(codigoBarras);
  let importados = 0;

  for (const externo of externos) {
    const l = externo.local;
    if (!l || l.lat == null || l.lon == null) continue;

    let local: locais.Local | null = null;

    if (l.osmTipo && l.osmId != null) {
      local = await locais.salvarLocalExterno({
        osmTipo: l.osmTipo,
        osmId: l.osmId,
        nome: l.nome,
        tipo: 'loja',
        endereco: null,
        cidade: l.cidade,
        uf: null,
        lat: l.lat,
        lon: l.lon,
      });
    }

    if (!local) continue;

    await precos.importarExterno({
      produtoId,
      localId: local.id,
      valor: externo.valor,
      moeda: externo.moeda,
      data: externo.data,
      origemId: externo.origemId,
    });
    importados++;
  }

  return importados;
}

/**
 * A busca completa.
 *
 * Ordem das coisas, e o porquê de cada uma:
 *
 * 1. Procura o produto primeiro no nosso banco. Se já conhecemos, a resposta
 *    sai sem esperar ninguém.
 * 2. Em paralelo, pergunta ao Open Food Facts e guarda o que vier. Na próxima
 *    busca pelo mesmo termo, o passo 1 já resolve.
 * 3. Com o produto escolhido, importa os preços que o Open Prices conhece.
 * 4. Pergunta ao OpenStreetMap que lojas existem no raio — e quais tipos de
 *    loja procurar sai das categorias do produto: remédio puxa farmácia,
 *    ração puxa petshop.
 * 5. Junta tudo no banco e ordena: com preço primeiro (do mais barato), depois
 *    as lojas sem preço, da mais perto para a mais longe.
 */
export async function buscar(params: {
  termo: string;
  lat: number;
  lon: number;
  raioMetros?: number;
}): Promise<ResultadoBusca> {
  const termo = params.termo.trim();
  const raioMetros = Math.min(
    params.raioMetros ?? env.RAIO_PADRAO_METROS,
    env.RAIO_MAXIMO_METROS,
  );
  const fontes: ResultadoBusca['fontes'] = [];

  // 1 e 2: produto no banco, mais o que a API externa acrescentar.
  const jaConhecidos = await produtos.procurarPorNome(termo);

  const daApi = await tolerante(
    'Open Food Facts',
    [],
    () => off.buscarProdutos(termo),
    fontes,
  );
  const importados = await produtos.salvarVariosExternos(daApi);

  // Sem duplicar: o mesmo código de barras pode vir das duas pontas.
  const candidatos = [...jaConhecidos];
  for (const p of importados) {
    if (!candidatos.some((c) => c.id === p.id)) candidatos.push(p);
  }

  const escolhido = candidatos[0];
  if (!escolhido) {
    throw naoEncontrado(
      `Não achei nenhum produto para "${termo}". Tente o nome da embalagem ou o código de barras.`,
    );
  }

  // 3: preços que já existem por aí para este produto.
  if (escolhido.codigo_barras) {
    await tolerante(
      'Open Prices',
      0,
      () => importarPrecosExternos(escolhido.id, escolhido.codigo_barras!),
      fontes,
    );
  }

  // 4: lojas por perto, do tipo que vende esse produto.
  const tiposDeLoja = overpass.lojasParaCategorias(escolhido.categorias ?? []);
  const lojasExternas = await tolerante(
    'OpenStreetMap',
    [],
    () => overpass.lojasPorPerto(params.lat, params.lon, raioMetros, tiposDeLoja),
    fontes,
  );
  await locais.salvarVariosExternos(lojasExternas);

  // 5: a resposta sai toda do nosso banco.
  const ofertas = await precos.ofertasPerto({
    produtoId: escolhido.id,
    lat: params.lat,
    lon: params.lon,
    raioMetros,
  });

  const comPreco = ofertas.filter((o) => o.valor !== null);
  const menorPreco = comPreco.length
    ? Math.min(...comPreco.map((o) => o.valor as number))
    : null;

  return {
    produto: {
      id: escolhido.id,
      codigoBarras: escolhido.codigo_barras,
      nome: escolhido.nome,
      marca: escolhido.marca,
      quantidade: escolhido.quantidade,
      imagemUrl: escolhido.imagem_url,
    },
    alternativas: candidatos.slice(1, 6).map((p) => ({
      id: p.id,
      nome: p.nome,
      marca: p.marca,
    })),
    ondeTem: ofertas.map((o) => ({
      localId: o.local_id,
      nome: o.local_nome,
      tipo: o.local_tipo,
      endereco: o.endereco,
      cidade: o.cidade,
      lat: Number(o.lat),
      lon: Number(o.lon),
      distanciaMetros: Number(o.distancia_metros),
      distanciaTexto: formatarDistancia(Number(o.distancia_metros)),
      preco:
        o.valor === null
          ? null
          : {
              valor: Number(o.valor),
              moeda: o.moeda ?? 'BRL',
              data: o.data ?? '',
              origem: o.origem ?? 'usuario',
            },
    })),
    resumo: {
      lojasNoRaio: ofertas.length,
      lojasComPreco: comPreco.length,
      menorPreco,
      raioMetros,
    },
    fontes,
  };
}
