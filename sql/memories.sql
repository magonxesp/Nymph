CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chat_memories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chat_id text NOT NULL,
    content text NOT NULL,
    embedding vector,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX chat_memories_chat_id_idx ON chat_memories (chat_id);
