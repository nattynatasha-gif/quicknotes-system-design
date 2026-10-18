# QuickNotes Data Model

## Entities

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| display_name | VARCHAR(100) | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### notes

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| title | VARCHAR(100) | NOT NULL |
| body | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### tags

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| name | VARCHAR(50) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Unique constraint: `(user_id, name)` – a user cannot have two tags with the same name.

### note_tags (join table)

| Column | Type | Constraints |
|--------|------|-------------|
| note_id | UUID | NOT NULL, FOREIGN KEY → notes(id) ON DELETE CASCADE |
| tag_id | UUID | NOT NULL, FOREIGN KEY → tags(id) ON DELETE CASCADE |

Primary key: `(note_id, tag_id)`

---

## Relationships

- **users → notes**: One-to-many. One user owns many notes. `notes.user_id` is the foreign key.
- **users → tags**: One-to-many. One user owns many tags. `tags.user_id` is the foreign key.
- **notes ↔ tags**: Many-to-many. A note can have many tags and a tag can be applied to many notes. The relationship is stored in the `note_tags` junction table.

---

## CREATE TABLE statements

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(100) NOT NULL,
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
```

---

## Example SQL queries

### 1. List the 10 most recent notes for a user

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 'user-123'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Create a note and associate tags (transaction)

```sql
BEGIN;

INSERT INTO notes (user_id, title, body)
VALUES ('user-123', 'Shopping list', 'Milk, eggs, bread')
RETURNING id;

-- Assume the returned id is 'note-456'
INSERT INTO note_tags (note_id, tag_id)
VALUES
  ('note-456', 'tag-1'),
  ('note-456', 'tag-2');

COMMIT;
```

### 3. JOIN – fetch notes together with their tag names

```sql
SELECT
  n.id,
  n.title,
  n.body,
  COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
FROM notes n
LEFT JOIN note_tags nt ON nt.note_id = n.id
LEFT JOIN tags t ON t.id = nt.tag_id
WHERE n.user_id = 'user-123'
GROUP BY n.id, n.title, n.body
ORDER BY n.created_at DESC;
```

---

## Index

```sql
CREATE INDEX idx_notes_user_id_created_at
  ON notes (user_id, created_at DESC);
```

**Reason**: The most common query is “give me my notes ordered by newest first”. A composite index on `(user_id, created_at DESC)` allows the database to satisfy both the filter and the sort with a single index scan, avoiding a sequential scan of the whole notes table.

Additional useful indexes:

- `CREATE INDEX idx_note_tags_tag_id ON note_tags (tag_id);` – for “find all notes with this tag”.
- `CREATE UNIQUE INDEX idx_tags_user_name ON tags (user_id, name);` – already expressed by the UNIQUE constraint.

---

## SQL vs NoSQL justification

QuickNotes has clear relational structure: users own notes, notes have many tags, and tags are shared across notes. Foreign keys, uniqueness constraints, and multi-table JOINs are natural and well-supported by a relational database. ACID transactions are important when creating a note and attaching tags in one operation. While a document store could embed tags inside each note, that approach makes “list all notes with tag X” expensive and risks data duplication. For an application of this shape at 1 million users, a PostgreSQL (or similar) primary database with a read replica is a proven, cost-effective choice.
