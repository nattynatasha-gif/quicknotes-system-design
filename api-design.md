# QuickNotes API Design

This document defines the RESTful API that the QuickNotes backend will expose. The client currently practices against JSONPlaceholder; the real service will implement the endpoints below.

## Base URL

```
https://api.quicknotes.example/v1
```

All endpoints require authentication via Bearer token (except where noted). Content-Type for requests with a body is `application/json`.

---

## Endpoints

### 1. List notes

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| GET | `/notes` | Return a paginated list of notes belonging to the authenticated user. Supports query params `limit` (default 20, max 100) and `offset`. | 200 OK |

**Example response**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Meeting notes",
      "body": "Discuss Q3 roadmap",
      "user_id": "user-123",
      "created_at": "2026-10-01T10:00:00Z",
      "updated_at": "2026-10-01T10:00:00Z",
      "tags": ["work", "meeting"]
    }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 2. Create a note

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/notes` | Create a new note for the authenticated user. Title is required (1–100 characters). Body is optional. | 201 Created |

**Example request**

```json
{
  "title": "Shopping list",
  "body": "Milk, eggs, bread",
  "tag_ids": ["tag-1", "tag-2"]
}
```

**Example response**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "Shopping list",
  "body": "Milk, eggs, bread",
  "user_id": "user-123",
  "created_at": "2026-10-18T12:00:00Z",
  "updated_at": "2026-10-18T12:00:00Z",
  "tags": [
    { "id": "tag-1", "name": "personal" },
    { "id": "tag-2", "name": "errands" }
  ]
}
```

---

### 3. Get a single note

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| GET | `/notes/{id}` | Retrieve one note by its ID. Returns 404 if the note does not exist or does not belong to the user. | 200 OK |

---

### 4. Update a note

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| PUT | `/notes/{id}` | Replace the title and/or body of an existing note. Partial updates are supported; omitted fields keep their current value. | 200 OK |

---

### 5. Delete a note

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| DELETE | `/notes/{id}` | Permanently delete a note. Returns 204 No Content on success. | 204 No Content |

---

### 6. List tags

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| GET | `/tags` | Return all tags belonging to the authenticated user. | 200 OK |

---

### 7. Create a tag (bonus)

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/tags` | Create a new tag. Name must be unique per user. | 201 Created |

---

## Error status codes

| Status | Meaning | When used |
|--------|---------|-----------|
| 400 Bad Request | Validation failed | Missing title, title > 100 chars, invalid JSON, malformed UUID |
| 401 Unauthorized | Missing or invalid auth token | No Bearer token or expired token |
| 403 Forbidden | Authenticated but not allowed | Attempting to access another user’s note |
| 404 Not Found | Resource does not exist | Unknown note ID or tag ID |
| 500 Internal Server Error | Unexpected server failure | Database down, unhandled exception |

**Example error body**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be between 1 and 100 characters.",
    "details": [
      {
        "field": "title",
        "reason": "required"
      }
    ]
  }
}
```
