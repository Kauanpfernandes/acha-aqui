/**
 * De "o que a pessoa digitou" para "que tipo de estabelecimento vende isso".
 *
 * Por que isto existe: o Open Food Facts só conhece comida, bebida, higiene e
 * limpeza. Peça de carro, parafuso, caderno e ração não estão lá, e não existe
 * base aberta equivalente para essas coisas.
 *
 * Mas a pergunta "onde eu acho isso perto de mim" não precisa de um banco de
 * produtos: precisa saber que loja vende o quê. E isso o OpenStreetMap sabe,
 * porque cada ponto no mapa carrega uma etiqueta do tipo `shop=car_parts`.
 *
 * Então a busca tem dois caminhos. Se o termo casa com um produto (com código
 * de barras, foto e preço), vai pelo caminho do produto. Se não casa, cai aqui
 * e ainda responde a metade que importa: as lojas por perto que costumam vender
 * aquilo.
 */

export interface Categoria {
  id: string;
  rotulo: string;
  /** Etiquetas do OpenStreetMap. Quase tudo é `shop`, mas farmácia no Brasil é `amenity=pharmacy`. */
  tags: Array<{ chave: 'shop' | 'amenity'; valores: string[] }>;
  termos: string[];
}

export const CATEGORIAS: Categoria[] = [
  {
    id: 'autopecas',
    rotulo: 'Auto peças e oficinas',
    tags: [{ chave: 'shop', valores: ['car_parts', 'car_repair', 'tyres', 'car'] }],
    termos: [
      'peca de carro', 'pecas de carro', 'autopecas', 'auto pecas', 'auto peca',
      'pneu', 'pneus', 'bateria de carro', 'oleo de motor', 'filtro de oleo',
      'pastilha de freio', 'amortecedor', 'radiador', 'vela de ignicao',
      'retrovisor', 'para-choque', 'escapamento', 'embreagem', 'correia dentada',
      'oficina', 'mecanico', 'borracharia', 'limpador de para-brisa',
    ],
  },
  {
    id: 'farmacia',
    rotulo: 'Farmácias e drogarias',
    tags: [
      { chave: 'amenity', valores: ['pharmacy'] },
      { chave: 'shop', valores: ['chemist'] },
    ],
    termos: [
      'remedio', 'remedios', 'farmacia', 'drogaria', 'medicamento',
      'dipirona', 'paracetamol', 'ibuprofeno', 'antialergico', 'vitamina',
      'termometro', 'curativo', 'esparadrapo', 'soro fisiologico',
      'protetor solar', 'fralda', 'absorvente', 'preservativo',
    ],
  },
  {
    id: 'construcao',
    rotulo: 'Material de construção e ferragens',
    tags: [{ chave: 'shop', valores: ['hardware', 'doityourself', 'paint', 'trade', 'electrical'] }],
    termos: [
      'parafuso', 'prego', 'ferramenta', 'furadeira', 'martelo', 'chave de fenda',
      'tinta', 'rolo de pintura', 'pincel', 'cimento', 'areia', 'tijolo',
      'cano', 'torneira', 'fio eletrico', 'tomada', 'interruptor', 'lampada',
      'ferragem', 'material de construcao', 'silicone', 'fita isolante',
      'cadeado', 'fechadura', 'dobradica',
    ],
  },
  {
    id: 'pet',
    rotulo: 'Petshops',
    tags: [{ chave: 'shop', valores: ['pet', 'pet_grooming'] }],
    termos: [
      'racao', 'racao de cachorro', 'racao de gato', 'petshop', 'pet shop',
      'areia para gato', 'coleira', 'brinquedo para cachorro', 'antipulgas',
      'aquario', 'comedouro', 'shampoo para cachorro',
    ],
  },
  {
    id: 'papelaria',
    rotulo: 'Papelarias',
    tags: [{ chave: 'shop', valores: ['stationery', 'copyshop', 'books'] }],
    termos: [
      'caderno', 'caneta', 'lapis', 'borracha', 'mochila', 'estojo',
      'papel sulfite', 'cartolina', 'cola', 'tesoura', 'papelaria',
      'agenda', 'marca texto', 'grampeador', 'impressao', 'xerox',
    ],
  },
  {
    id: 'eletronicos',
    rotulo: 'Eletrônicos e celulares',
    tags: [{ chave: 'shop', valores: ['mobile_phone', 'electronics', 'computer', 'hifi', 'video_games'] }],
    termos: [
      'celular', 'carregador', 'cabo usb', 'fone de ouvido', 'capinha',
      'pelicula', 'caixa de som', 'notebook', 'mouse', 'teclado', 'monitor',
      'pendrive', 'hd externo', 'roteador', 'pilha', 'bateria de celular',
      'televisao', 'tv', 'controle remoto', 'eletronico',
    ],
  },
  {
    id: 'bicicleta',
    rotulo: 'Bicicletarias',
    tags: [{ chave: 'shop', valores: ['bicycle'] }],
    termos: [
      'bicicleta', 'bike', 'camara de ar', 'pneu de bicicleta', 'corrente de bike',
      'capacete', 'bomba de ar', 'bicicletaria', 'farol de bike',
    ],
  },
  {
    id: 'roupas',
    rotulo: 'Roupas e calçados',
    tags: [{ chave: 'shop', valores: ['clothes', 'shoes', 'boutique', 'fabric', 'sports'] }],
    termos: [
      'roupa', 'camisa', 'camiseta', 'calca', 'jaqueta', 'vestido',
      'tenis', 'sapato', 'chinelo', 'meia', 'cueca', 'calcinha', 'sutia',
      'uniforme', 'tecido', 'linha de costura',
    ],
  },
  {
    id: 'oculos',
    rotulo: 'Óticas',
    tags: [{ chave: 'shop', valores: ['optician'] }],
    termos: ['oculos', 'oculos de grau', 'oculos de sol', 'lente de contato', 'otica'],
  },
  {
    id: 'moveis',
    rotulo: 'Móveis e decoração',
    tags: [{ chave: 'shop', valores: ['furniture', 'houseware', 'interior_decoration', 'bed'] }],
    termos: [
      'movel', 'moveis', 'sofa', 'cama', 'colchao', 'mesa', 'cadeira',
      'guarda-roupa', 'armario', 'estante', 'cortina', 'tapete', 'panela',
      'talher', 'prato', 'copo',
    ],
  },
  {
    id: 'jardim',
    rotulo: 'Jardinagem e agropecuária',
    tags: [{ chave: 'shop', valores: ['garden_centre', 'florist', 'agrarian'] }],
    termos: [
      'planta', 'muda', 'vaso', 'terra adubada', 'adubo', 'semente',
      'mangueira de jardim', 'flor', 'jardinagem', 'veneno para formiga',
    ],
  },
  {
    id: 'mercado',
    rotulo: 'Mercados e mercearias',
    tags: [{ chave: 'shop', valores: ['supermarket', 'convenience', 'grocery', 'general', 'greengrocer', 'butcher', 'bakery'] }],
    termos: [
      'mercado', 'supermercado', 'mercearia', 'comida', 'alimento',
      'carne', 'frango', 'fruta', 'verdura', 'legume', 'pao', 'padaria',
    ],
  },
];

function semAcento(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Descobre a categoria de um termo digitado.
 *
 * A comparação ignora acento porque quem digita com pressa escreve "racao" e
 * "oculos", e recusar isso seria implicância com o usuário.
 */
export function categoriaDoTermo(termo: string): Categoria | null {
  const t = semAcento(termo);
  if (t.length < 2) return null;

  let melhor: { cat: Categoria; nota: number } | null = null;

  for (const cat of CATEGORIAS) {
    for (const bruto of cat.termos) {
      const alvo = semAcento(bruto);
      let nota = 0;

      if (alvo === t) nota = 100;
      else if (t.startsWith(alvo + ' ') || t.endsWith(' ' + alvo)) nota = 80;
      else if (alvo.startsWith(t) && t.length >= 4) nota = 60;
      else if (t.includes(alvo) && alvo.length >= 5) nota = 50;

      if (nota && (!melhor || nota > melhor.nota)) melhor = { cat, nota };
    }
  }

  return melhor ? melhor.cat : null;
}

/** As etiquetas OSM de uma categoria, no formato que o Overpass entende. */
export function tagsDaCategoria(cat: Categoria): Array<{ chave: string; valores: string[] }> {
  return cat.tags;
}
