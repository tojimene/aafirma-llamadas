-- =====================================================================
-- Esquema de base de datos · AA Firma · Análisis de Llamadas
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- Extensiones necesarias
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- pgvector (embeddings)

-- ---------------------------------------------------------------------
-- Usuarios de la aplicación (login privado, creados por admin)
-- ---------------------------------------------------------------------
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  full_name     text not null,
  password_hash text not null,
  role          text not null default 'analista', -- 'admin' | 'analista'
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Base de conocimiento: documentos cargados (correcciones, estructuras...)
-- ---------------------------------------------------------------------
create table if not exists knowledge_sources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'sop_guion',
  description  text,
  full_content text,            -- texto completo (necesario para la plantilla del informe)
  char_count   integer not null default 0,
  chunk_count  integer not null default 0,
  created_by   uuid references app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Migración para bases ya creadas:
alter table knowledge_sources add column if not exists full_content text;

-- ---------------------------------------------------------------------
-- Fragmentos indexados con embeddings (RAG)
-- ---------------------------------------------------------------------
create table if not exists knowledge_chunks (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references knowledge_sources(id) on delete cascade,
  content    text not null,
  category   text not null default 'otro',
  embedding  vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_source_idx
  on knowledge_chunks(source_id);

-- ---------------------------------------------------------------------
-- Llamadas analizadas y su informe
-- ---------------------------------------------------------------------
create table if not exists calls (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  transcript      text not null,
  status          text not null default 'completado', -- 'procesando' | 'completado' | 'error'
  score           integer,
  analysis        jsonb,
  references_used jsonb,
  report_path     text,             -- ruta en Supabase Storage (bucket 'reports')
  created_by      uuid references app_users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists calls_created_at_idx on calls(created_at desc);

-- ---------------------------------------------------------------------
-- Función de búsqueda semántica sobre el conocimiento (RAG)
-- ---------------------------------------------------------------------
create or replace function match_knowledge(
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.15
)
returns table (
  id uuid,
  content text,
  category text,
  source_title text,
  similarity float
)
language sql stable
as $$
  select
    kc.id,
    kc.content,
    kc.category,
    ks.title as source_title,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  join knowledge_sources ks on ks.id = kc.source_id
  where kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) > min_similarity
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------
-- Storage: crear manualmente un bucket PRIVADO llamado 'reports'
-- desde el panel de Supabase (Storage > New bucket > nombre: reports, privado).
-- ---------------------------------------------------------------------
