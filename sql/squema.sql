CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chat_memories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chat_id text,
    platform text,
    content text,
    embedding vector,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS chat_memories_chat_id_idx ON chat_memories (platform, chat_id);

CREATE TABLE IF NOT EXISTS tasks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id uuid,
    chat_id text,
    platform text,
    requester_id text,
    status text DEFAULT 'queued',
    prompt text,
    agent text,
    result jsonb,
    error text,
    embeddings vector,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS tasks_task_id_idx ON tasks (task_id);
CREATE INDEX IF NOT EXISTS tasks_chat_id_idx ON tasks (platform, chat_id);
CREATE INDEX IF NOT EXISTS tasks_queue_idx ON tasks (id) WHERE status = 'queued';
