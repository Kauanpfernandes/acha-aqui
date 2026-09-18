-- ============================================================
--  Acha Aqui — estrutura inicial
-- ============================================================

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Usuários
-- ------------------------------------------------------------
create table if not exists usuarios (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null check (char_length(nome) between 2 and 120),
  email         text not null check (position('@' in email) > 1),
  senha_hash    text not null,
  criado_em     timestamptz not null default now()
);

-- E-mail é único ignorando maiúsculas: Kauan@x.com e kauan@x.com são a mesma conta.
create unique index if not exists usuarios_email_idx on usuarios (lower(email));

-- ------------------------------------------------------------
-- Produtos: espelho local do que veio do Open Food Facts,
-- mais o que os usuários cadastram na mão.
-- ------------------------------------------------------------
create table if not exists produtos (
  id             uuid primary key default uuid_generate_v4(),
  codigo_barras  text unique,
  nome           text not null,
  marca          text,
  quantidade     text,
  imagem_url     text,
  categorias     text[] not null default '{}',
  origem         text not null default 'openfoodfacts'
                   check (origem in ('openfoodfacts', 'usuario')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Busca por nome tolerante a erro de digitação e a pedaço de palavra.
create index if not exists produtos_nome_trgm_idx
  on produtos using gin (nome gin_trgm_ops);
create index if not exists produtos_marca_trgm_idx
  on produtos using gin (marca gin_trgm_ops);

-- ------------------------------------------------------------
-- Locais: lojas vindas do OpenStreetMap ou cadastradas por usuário.
-- ------------------------------------------------------------
create table if not exists locais (
  id             uuid primary key default uuid_generate_v4(),
  osm_tipo       text check (osm_tipo in ('node', 'way', 'relation')),
  osm_id         bigint,
  nome           text not null,
  tipo           text not null default 'loja',
  endereco       text,
  cidade         text,
  uf             text,
  geom           geography(Point, 4326) not null,
  criado_em      timestamptz not null default now(),
  unique (osm_tipo, osm_id)
);

-- Índice geográfico: é ele que faz "o que está perto daqui" ser rápido.
create index if not exists locais_geom_idx on locais using gist (geom);
create index if not exists locais_nome_trgm_idx
  on locais using gin (nome gin_trgm_ops);

-- ------------------------------------------------------------
-- Preços: o coração do projeto. Cada linha é "este produto custou
-- tanto, nesta loja, neste dia".
-- ------------------------------------------------------------
create table if not exists precos (
  id             uuid primary key default uuid_generate_v4(),
  produto_id     uuid not null references produtos(id) on delete cascade,
  local_id       uuid not null references locais(id) on delete cascade,
  usuario_id     uuid references usuarios(id) on delete set null,
  valor          numeric(10,2) not null check (valor > 0),
  moeda          text not null default 'BRL' check (char_length(moeda) = 3),
  data           date not null default current_date,
  foto_url       text,
  origem         text not null default 'usuario'
                   check (origem in ('usuario', 'openprices')),
  origem_id      text,
  criado_em      timestamptz not null default now(),

  -- O mesmo usuário não registra o mesmo produto na mesma loja duas vezes no dia.
  unique (produto_id, local_id, usuario_id, data)
);

create index if not exists precos_produto_data_idx
  on precos (produto_id, data desc);
create index if not exists precos_local_idx on precos (local_id);
create unique index if not exists precos_origem_idx
  on precos (origem, origem_id) where origem_id is not null;

-- ------------------------------------------------------------
-- Cache das respostas externas. Guardar o JSON cru evita
-- martelar API pública de graça e deixa o app de pé quando ela cai.
-- ------------------------------------------------------------
create table if not exists cache_externo (
  chave          text primary key,
  conteudo       jsonb not null,
  expira_em      timestamptz not null,
  criado_em      timestamptz not null default now()
);

create index if not exists cache_externo_expira_idx on cache_externo (expira_em);
