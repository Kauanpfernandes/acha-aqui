# Publicar a API

[Voltar ao README](../README.md)

O GitHub Pages hospeda somente a interface. O backend precisa de um serviço que execute o [Dockerfile](../Dockerfile) e um banco PostgreSQL dedicado, com PostGIS, `pg_trgm` e `uuid-ossp` disponíveis.

## Configuração

| Campo | Valor |
| --- | --- |
| Repositório | `Kauanpfernandes/acha-aqui` |
| Runtime | Docker |
| Dockerfile | `./Dockerfile` |
| Porta | `PORT`, definida pelo provedor, ou `3000` |
| Health check | `/pronto` |
| Comando | Padrão da imagem: `node dist/server.js` |

A inicialização aplica as migrations. O usuário do banco precisa poder criar extensões e tabelas, ou um administrador deve preparar as extensões antes. Comece com uma única instância: o executor atual de migrations não coordena inicializações concorrentes.

## Variáveis privadas no painel da hospedagem

| Variável | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | String privada do banco dedicado |
| `JWT_SECRET` | Segredo aleatório de pelo menos 32 caracteres; não use o exemplo do repositório |
| `DEMO_ENABLED` | `true` para demonstração pública de leitura |
| `PORT` | Porta fornecida pela hospedagem |

Use TLS para bancos acessados pela internet conforme o provedor; não desative a verificação de certificado. Nunca publique `.env` ou credenciais. Não reutilize bancos de clientes ou outros aplicativos.

## Dados fictícios

`DEMO_ENABLED=true` insere um produto, duas lojas e dois preços sintéticos. IDs fixos e uma transação evitam duplicações. Os nomes contêm DEMO, e a resposta avisa que não são ofertas reais.

- `/api/demo` consulta PostgreSQL e calcula distâncias com PostGIS, sem APIs externas.
- Não cria contas nem senhas compartilhadas.
- Escritas dos visitantes em `/api` retornam `403`, inclusive cadastro e login.
- `/api/busca` continua disponível e pode alimentar cache e importar dados externos.
- Desativar a opção não apaga os registros. Use outro banco para um ambiente real.

## Verificação após o deploy

Substitua `https://SUA-API` pelo endereço confirmado pela hospedagem:

```bash
node scripts/verificar-deploy.mjs https://SUA-API
```

O script verifica banco, ofertas fictícias, distâncias, OpenAPI e arquivos do Swagger. Não cria contas nem grava preços. Abra também `/docs/` e execute `GET /api/demo` pelo botão **Try it out**. Teste a busca externa separadamente, pois depende das fontes.

Só depois da validação, adicione ao README os links reais de API, Swagger e demonstração. Não publique um endereço presumido.

## Atualizações e recuperação

Execute lint, build e testes em banco isolado antes de atualizar. Se o deploy falhar, restaure a imagem anterior pelo painel. Corrija migrations com uma nova migration; não apague dados para reverter uma atualização. Confira backups antes de mudanças de schema.

Planos gratuitos podem suspender por inatividade e ter limites de banco/tráfego. Confira as condições antes de ativar recursos pagos.
