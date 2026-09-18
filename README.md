<h1 align="center">Acha Aqui</h1>

<p align="center">
  Você digita um produto, diz onde está, e a API responde em que lojas perto de você dá para comprar.<br>
  <sub>API REST em Node e TypeScript, com Postgres e PostGIS.</sub>
</p>

<p align="center">
  <a href="https://github.com/Kauanpfernandes/acha-aqui/actions/workflows/ci.yml"><img src="https://github.com/Kauanpfernandes/acha-aqui/actions/workflows/ci.yml/badge.svg" alt="Testes"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL_+_PostGIS-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL e PostGIS">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/26_testes-0f766e?style=flat-square" alt="26 testes">
</p>

![Documentação da API no Swagger](docs/swagger.png)

## O problema, e a parte que ninguém conta

A ideia parece simples: busca na internet onde tem o produto. Só que **não existe
API pública e legal que varra a internet atrás de preço**. Google Shopping não
expõe isso. Raspar site de varejista quebra toda semana e vai contra os termos de
uso. A API de busca do Mercado Livre, que seria o caminho óbvio no Brasil, hoje
devolve 403 para quem não é parceiro.

Então o Acha Aqui foi construído em cima do que dá para usar de verdade, de graça
e sem chave:

| Fonte | O que ela responde |
|---|---|
| **Open Food Facts** | Que produto é esse: nome, marca, quantidade, foto, categorias, código de barras. |
| **Open Prices** | Preços já registrados, cada um amarrado a uma loja com coordenada. |
| **OpenStreetMap (Overpass)** | Que lojas existem num raio ao redor de você, e de que tipo cada uma é. |
| **Os próprios usuários** | Quanto custou, em qual loja, em que dia. É o que sustenta a base no Brasil. |

Essa última linha é o ponto. A base do Open Prices é colaborativa e hoje quase
toda europeia, então no Brasil a cobertura é rala. Em vez de fingir que não é
assim, o projeto assume: quem usa também alimenta. A API externa dá o empurrão
inicial, e o que faz a base crescer é gente registrando preço de mercado de
bairro que nem no mapa está.

## Como a busca funciona por dentro

`GET /api/busca?q=leite condensado&lat=-19.9227&lon=-43.9451&raio=3000`

1. Procura o produto **primeiro no nosso banco**. Se já conhecemos, a resposta
   sai sem esperar ninguém de fora.
2. Em paralelo pergunta ao Open Food Facts e guarda o que vier. Na próxima busca
   pelo mesmo termo, o passo 1 já resolve.
3. Importa os preços que o Open Prices conhece para aquele código de barras,
   junto com as lojas.
4. Pergunta ao OpenStreetMap que lojas existem no raio. **Quais tipos de loja
   procurar sai das categorias do produto**: remédio puxa farmácia, ração puxa
   petshop, pão puxa padaria.
5. Junta tudo no banco e ordena: lojas com preço primeiro, da mais barata para a
   mais cara, e depois as sem preço, da mais perto para a mais longe.

A resposta traz também um campo `fontes`, dizendo quais integrações responderam
naquela chamada.

```jsonc
{
  "produto": { "nome": "Leite Condensado Moça", "marca": "Nestlé", "quantidade": "395 g" },
  "ondeTem": [
    {
      "nome": "Mercado do Meio",
      "distanciaMetros": 950,
      "distanciaTexto": "950 m",
      "preco": { "valor": 8.49, "moeda": "BRL", "data": "2026-09-10", "origem": "openprices" }
    },
    {
      "nome": "Supermercado Perto",
      "distanciaMetros": 410,
      "distanciaTexto": "410 m",
      "preco": null          // ninguém registrou preço aqui ainda
    }
  ],
  "resumo": { "lojasNoRaio": 14, "lojasComPreco": 3, "menorPreco": 8.49 },
  "fontes": [
    { "nome": "Open Food Facts", "ok": true },
    { "nome": "Open Prices", "ok": true },
    { "nome": "OpenStreetMap", "ok": false, "detalhe": "não respondeu em 6000ms" }
  ]
}
```

Loja sem preço continua na lista de propósito. Ela responde metade da pergunta
("onde provavelmente tem") e é exatamente onde o próximo usuário pode registrar
quanto custou.

## Decisões técnicas

### Depender de três serviços que não são meus

Essa é a decisão que molda o projeto inteiro. Enquanto eu testava, o Open Food
Facts caiu duas vezes. Se cada integração fosse um `await` solto, a API cairia
junto.

Então nenhuma fonte externa pode derrubar a busca. Cada uma roda dentro de um
envelope que, em caso de falha, devolve vazio e anota o problema no campo
`fontes`. O usuário recebe as lojas por perto e um aviso de que o preço não veio,
em vez de um 500.

```ts
const lojas = await tolerante('OpenStreetMap', [], () => overpass.lojasPorPerto(...), fontes);
```

Falha de serviço externo é esperada e some no relatório. Qualquer outro erro é
bug meu e vai para o log com stack trace antes de a busca seguir, senão um
problema de banco ficaria escondido atrás de um "a fonte falhou".

### Cache no Postgres, não em memória

As três APIs são mantidas por projeto aberto e doação. Martelar seria abuso, e
ainda deixaria a resposta lenta. Cada chamada externa passa por um cache com
prazo escolhido pelo tipo de dado: ficha de produto vale uma semana, preço vale
horas, e localização de loja vale um mês (supermercado não muda de lugar).

O cache fica no banco e não em memória porque a aplicação pode rodar em mais de
uma instância e porque, quando ela reinicia, o cache continua lá. E ele tem um
truque: **se a chamada falhar, o cache vencido ainda é servido**. Preço de ontem
é melhor que tela de erro.

### PostGIS, e não uma conta de distância no código

Ordenar por distância parece trabalho de calculadora, mas fazer isso em
JavaScript obrigaria a carregar todas as lojas da tabela para memória a cada
busca.

Com a coluna em `geography` e um índice GiST, o banco resolve:

```sql
where ST_DWithin(l.geom, ponto.g, $3)
order by l.geom <-> ponto.g
```

`ST_DWithin` usa o índice e calcula sobre a esfera, em metros. O `<->` ordena
pela distância aproveitando o mesmo índice. Continua rápido com a tabela grande.

### A ponte entre produto e tipo de loja

O OpenStreetMap não sabe o que é "arroz". Ele sabe que um ponto no mapa é
`shop=supermarket`. Quem faz a ponte é uma tabela que lê as categorias vindas do
Open Food Facts e decide onde procurar:

```ts
{ quando: /medicament|pharmac/, lojas: ['chemist', 'supermarket'] },
{ quando: /pet|cat-food|dog-food/, lojas: ['pet', 'supermarket'] },
```

### Autenticação escrita à mão

Poderia ter plugado um serviço pronto. Escrevi porque o ponto era mostrar que sei
fazer: senha com bcrypt, token JWT, middleware que separa rota pública de rota
protegida.

Um detalhe que costuma passar batido: no login, e-mail inexistente e senha errada
devolvem **a mesma mensagem**, e a comparação de hash roda mesmo quando o usuário
não existe. Responder diferente, ou responder mais rápido, entrega para um
atacante quais e-mails têm conta aqui.

### Testes contra Postgres de verdade

26 testes de integração, subindo o app inteiro com supertest. O banco é Postgres
com PostGIS mesmo, no CI também: os testes de distância dependem de `ST_DWithin`,
então banco falso não provaria nada.

As APIs externas são simuladas, com um dublê que também sabe **falhar de
propósito**. Tem teste para "o Open Food Facts caiu e o produto já era conhecido",
para "duas fontes caíram e a busca respondeu mesmo assim", e para "a segunda
busca igual não chamou a API de novo".

Escrever os testes pegou dois problemas de verdade: o `npm run build` não
copiava as migrations para `dist/`, então `npm start` quebrava fora do Docker; e
o envelope de tolerância engolia calado qualquer erro, inclusive bug meu de
banco, o que teria escondido o problema atrás de um "a fonte falhou".

## Rodando

Precisa de Docker. É só isto:

```bash
git clone https://github.com/Kauanpfernandes/acha-aqui.git
cd acha-aqui
cp .env.example .env
docker compose up
```

A API sobe em `http://localhost:3000` e a documentação navegável, onde dá para
disparar as chamadas, fica em `http://localhost:3000/docs`. As migrations rodam
sozinhas na subida. Nenhuma das integrações externas pede chave.

Sem Docker, com um Postgres e PostGIS já instalados:

```bash
npm install
npm run migrate
npm run dev
```

Rodar os testes precisa de um banco de teste:

```bash
createdb achaaqui_test
npm test
```

## Estrutura

```
src/
├── config/env.ts           valida as variáveis de ambiente na subida
├── db/
│   ├── pool.ts             conexão, transação e conversão de tipos
│   ├── migrar.ts           roda as migrations pendentes
│   └── migrations/         SQL versionado
├── integracoes/
│   ├── httpExterno.ts      timeout, retry e User-Agent
│   ├── cache.ts            cache com prazo e resgate do cache vencido
│   ├── openFoodFacts.ts    ficha do produto
│   ├── openPrices.ts       preços já conhecidos
│   └── overpass.ts         lojas por perto no OpenStreetMap
├── modulos/
│   ├── auth/               cadastro, login, JWT
│   ├── busca/              a orquestração das três fontes
│   ├── locais/             lojas e consultas geográficas
│   └── precos/             registro e histórico
├── middlewares/            autenticação e tratamento de erro
└── docs/openapi.ts         especificação servida em /docs

tests/                      26 testes de integração
```

