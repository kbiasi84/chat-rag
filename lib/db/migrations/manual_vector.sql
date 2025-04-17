-- Primeiro, adicionamos a extensão pgvector se ela não existir
CREATE EXTENSION IF NOT EXISTS vector;

-- Reimplementamos a tabela embeddings do zero com os novos campos
DROP TABLE IF EXISTS public.embeddings;

CREATE TABLE public.embeddings (
  id VARCHAR(191) PRIMARY KEY,
  resource_id VARCHAR(191) REFERENCES public.resources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL
);

-- Criando índice para busca vetorial
CREATE INDEX "embeddingIndex" ON public.embeddings USING hnsw (embedding vector_cosine_ops);

-- Atualizando a tabela resources para o novo schema
ALTER TABLE public.resources 
ALTER COLUMN id TYPE VARCHAR(191),
ALTER COLUMN source_type SET DEFAULT 'text',
ALTER COLUMN source_id TYPE VARCHAR(191);

-- Atualizando a tabela links para o novo schema
ALTER TABLE public.links
ALTER COLUMN id TYPE VARCHAR(191),
ALTER COLUMN url TYPE TEXT,
ALTER COLUMN title TYPE TEXT; 