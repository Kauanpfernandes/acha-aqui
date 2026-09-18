export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Acha Aqui',
    version: '1.0.0',
    description:
      'Você digita um produto e diz onde está. A API responde em que lojas perto ' +
      'de você dá para comprar, e por quanto, juntando Open Food Facts, Open Prices, ' +
      'OpenStreetMap e os preços registrados pelos próprios usuários.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'Este servidor' }],
  tags: [
    { name: 'Busca', description: 'Encontrar produto e onde comprar' },
    { name: 'Preços', description: 'Registrar e consultar preços' },
    { name: 'Conta', description: 'Cadastro e login' },
  ],
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Produto não encontrado' },
        },
      },
      OndeTem: {
        type: 'object',
        properties: {
          localId: { type: 'string', format: 'uuid' },
          nome: { type: 'string', example: 'Supermercado BH' },
          tipo: { type: 'string', example: 'supermarket' },
          endereco: { type: 'string', nullable: true },
          cidade: { type: 'string', nullable: true },
          lat: { type: 'number', example: -19.9245 },
          lon: { type: 'number', example: -43.9352 },
          distanciaMetros: { type: 'integer', example: 820 },
          distanciaTexto: { type: 'string', example: '820 m' },
          preco: {
            nullable: true,
            type: 'object',
            properties: {
              valor: { type: 'number', example: 27.9 },
              moeda: { type: 'string', example: 'BRL' },
              data: { type: 'string', format: 'date' },
              origem: { type: 'string', enum: ['usuario', 'openprices'] },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/busca': {
      get: {
        tags: ['Busca'],
        summary: 'Onde comprar um produto perto de você',
        description:
          'Junta as fontes externas com o banco local e devolve as lojas do raio ' +
          'ordenadas por preço (as com preço primeiro) e depois por distância. ' +
          'O campo `fontes` diz quais integrações responderam: se alguma estiver ' +
          'fora do ar, a busca ainda responde com o que as outras deram.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2 },
            example: 'leite condensado',
          },
          {
            name: 'lat',
            in: 'query',
            required: true,
            schema: { type: 'number' },
            example: -19.9227,
          },
          {
            name: 'lon',
            in: 'query',
            required: true,
            schema: { type: 'number' },
            example: -43.9451,
          },
          {
            name: 'raio',
            in: 'query',
            description: 'Raio em metros. Padrão 3000, máximo 25000.',
            schema: { type: 'integer' },
            example: 3000,
          },
        ],
        responses: {
          200: {
            description: 'Produto encontrado, com as lojas do raio',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    produto: { type: 'object' },
                    alternativas: { type: 'array', items: { type: 'object' } },
                    ondeTem: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/OndeTem' },
                    },
                    resumo: {
                      type: 'object',
                      properties: {
                        lojasNoRaio: { type: 'integer', example: 14 },
                        lojasComPreco: { type: 'integer', example: 3 },
                        menorPreco: { type: 'number', nullable: true, example: 8.49 },
                        raioMetros: { type: 'integer', example: 3000 },
                      },
                    },
                    fontes: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          404: {
            description: 'Nenhum produto bateu com o termo',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          422: { description: 'Parâmetro inválido' },
        },
      },
    },
    '/api/produtos': {
      get: {
        tags: ['Busca'],
        summary: 'Sugestões de produto enquanto digita',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
        ],
        responses: { 200: { description: 'Lista de produtos conhecidos' } },
      },
    },
    '/api/locais': {
      get: {
        tags: ['Busca'],
        summary: 'Lojas por perto, sem filtrar por produto',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number' } },
          { name: 'raio', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Lojas ordenadas por distância' } },
      },
    },
    '/api/precos': {
      post: {
        tags: ['Preços'],
        summary: 'Registrar quanto um produto custou numa loja',
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['valor'],
                properties: {
                  produtoId: { type: 'string', format: 'uuid' },
                  codigoBarras: { type: 'string', example: '7891000100103' },
                  localId: { type: 'string', format: 'uuid' },
                  novoLocal: {
                    type: 'object',
                    description: 'Para loja que não existe no OpenStreetMap',
                    properties: {
                      nome: { type: 'string', example: 'Mercadinho do Zé' },
                      lat: { type: 'number' },
                      lon: { type: 'number' },
                    },
                  },
                  valor: { type: 'number', example: 8.49 },
                  moeda: { type: 'string', example: 'BRL' },
                  data: { type: 'string', format: 'date' },
                  fotoUrl: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Preço registrado' },
          401: { description: 'Sem token' },
          404: { description: 'Produto ou local não encontrado' },
        },
      },
    },
    '/api/produtos/{id}/precos': {
      get: {
        tags: ['Preços'],
        summary: 'Histórico de preços de um produto',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Registros do mais recente ao mais antigo' } },
      },
    },
    '/api/auth/cadastro': {
      post: {
        tags: ['Conta'],
        summary: 'Criar conta',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'email', 'senha'],
                properties: {
                  nome: { type: 'string', example: 'Kauan' },
                  email: { type: 'string', format: 'email' },
                  senha: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Conta criada, com o token' }, 409: { description: 'E-mail já cadastrado' } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Conta'],
        summary: 'Entrar',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'senha'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  senha: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Token de acesso' }, 401: { description: 'Credenciais erradas' } },
      },
    },
    '/api/auth/eu': {
      get: {
        tags: ['Conta'],
        summary: 'Quem sou eu',
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Dados da conta' }, 401: { description: 'Sem token' } },
      },
    },
    '/saude': {
      get: {
        summary: 'Health check',
        responses: { 200: { description: 'A API está de pé' } },
      },
    },
  },
} as const;
