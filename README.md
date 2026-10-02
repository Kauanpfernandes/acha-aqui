# Acha Aqui

**Descubra lojas próximas e compare os preços disponíveis de um produto.**
API REST em Node.js e TypeScript, com consultas geográficas em PostgreSQL + PostGIS e integração com Open Food Facts, Open Prices e OpenStreetMap.

[![Testes](https://github.com/Kauanpfernandes/acha-aqui/actions/workflows/ci.yml/badge.svg)](https://github.com/Kauanpfernandes/acha-aqui/actions/workflows/ci.yml)

**[Experimentar a interface ↗](https://kauanpfernandes.github.io/acha-aqui/)** · [Arquitetura](docs/architecture.md) · [Publicar a API](docs/deployment.md)

![Interface de busca do Acha Aqui](docs/demo.png)

## Interface e API

| Acesso | O que executa |
| --- | --- |
| [Interface no GitHub Pages](https://kauanpfernandes.github.io/acha-aqui/) | JavaScript no navegador e consultas às fontes externas. Não executa o backend Node nem o banco PostGIS. |
| API Node + PostgreSQL | Backend executável com Docker. A URL pública depende da configuração da hospedagem e do banco; veja o [guia](docs/deployment.md). |
| `/api/demo`, com `DEMO_ENABLED=true` | Consulta real ao PostgreSQL, distâncias calculadas pelo PostGIS e dados identificados como fictícios. Sem dependência de serviços externos. |

## O que o projeto demonstra

- **Consultas geográficas:** busca por raio e distância usando PostGIS e índice GiST.
- **Resiliência:** timeout, retry, cache persistente e resposta parcial quando uma fonte externa falha.
- **Backend completo:** validação com Zod, autenticação JWT, bcrypt e documentação OpenAPI.
- **Testes de integração:** PostgreSQL + PostGIS no CI, com simulação das fontes externas.

`Node.js` · `TypeScript` · `Express` · `PostgreSQL` · `PostGIS` · `Docker` · `Vitest`

## Executar localmente

Requisito: Docker com Docker Compose.

```bash
git clone https://github.com/Kauanpfernandes/acha-aqui.git
cd acha-aqui
cp .env.example .env
docker compose up --build
```

No PowerShell, substitua `cp` por `Copy-Item`. Ajuste `JWT_SECRET` no `.env` antes de publicar.

- **Swagger:** <http://localhost:3000/docs/>
- **OpenAPI:** <http://localhost:3000/openapi.json>
- **Disponibilidade do banco:** <http://localhost:3000/pronto>

### Experimentar sem cadastro

Defina `DEMO_ENABLED=true` no `.env` e execute `docker compose up --build`.
Abra <http://localhost:3000/api/demo>: a resposta traz duas lojas fictícias, preços de exemplo e distâncias calculadas no banco real.

Nesse modo, escritas do visitante em `/api` ficam bloqueadas. Para testar cadastro, login e registro de preços, use `DEMO_ENABLED=false`. Use um banco dedicado à demonstração; seus registros não são apagados ao desligar a opção.

### Busca com fontes externas

```bash
curl "http://localhost:3000/api/busca?q=leite%20condensado&lat=-19.9227&lon=-43.9451&raio=3000"
```

A cobertura depende das fontes. Lojas sem preço podem aparecer como sugestões; isso não confirma estoque. O campo `fontes` informa quais integrações responderam.

## Desenvolvimento e testes

Sem Docker, use Node.js 22 e PostgreSQL com PostGIS, `pg_trgm` e `uuid-ossp` disponíveis. Configure `.env` e execute:

```bash
npm ci
npm run migrate
npm run dev
```

```bash
npm run lint
npm run build
npm test
```

**Os testes limpam as tabelas a cada caso.** Use exclusivamente um banco de teste, configurado por `DATABASE_URL_TESTE`; o padrão é `postgres://postgres:postgres@localhost:5432/achaaqui_test`. Nunca use o banco publicado. O CI provisiona um banco isolado automaticamente.

## Documentação

- [Arquitetura e decisões técnicas](docs/architecture.md): fluxo, cache, integrações, autenticação e organização do código.
- [Publicação e validação](docs/deployment.md): servidor, banco, dados fictícios e verificação após o deploy.

## Licença

[MIT](LICENSE) · Desenvolvido por [Kauan Fernandes](https://github.com/Kauanpfernandes).
