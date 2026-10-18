const API_URL = 'https://jsonplaceholder.typicode.com/posts';

/**
 * Reusable async request helper.
 * Calls fetch, checks response.ok and throws on errors.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  // DELETE often returns empty body
  if (response.status === 204 || options.method === 'DELETE') {
    return null;
  }
  return response.json();
}

const loadBtn = document.getElementById('load-btn');
const statusEl = document.getElementById('status');
const notesList = document.getElementById('notes-list');
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitBtn = document.getElementById('submit-btn');

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = type;
}

function setLoading(isLoading) {
  loadBtn.disabled = isLoading;
  submitBtn.disabled = isLoading;
}

function clearNotesList() {
  while (notesList.firstChild) {
    notesList.removeChild(notesList.firstChild);
  }
}

function renderNote(note) {
  const li = document.createElement('li');
  li.className = 'note-item';
  li.dataset.id = note.id;

  const title = document.createElement('h3');
  title.textContent = note.title;

  const body = document.createElement('p');
  body.textContent = note.body || '(no body)';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => deleteNote(note.id, li));

  li.appendChild(title);
  li.appendChild(body);
  li.appendChild(deleteBtn);
  return li;
}

/**
 * GET – load 10 notes
 */
async function loadNotes() {
  setLoading(true);
  setStatus('Loading notes...', 'loading');
  clearNotesList();

  try {
    const notes = await request(`${API_URL}?_limit=10`);

    if (!notes || notes.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'No notes found. Create one above!';
      notesList.appendChild(empty);
      setStatus('No notes available.', 'success');
      return;
    }

    notes.forEach((note) => {
      notesList.appendChild(renderNote(note));
    });

    setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
  } catch (err) {
    console.error(err);
    setStatus('Could not load notes. Please try again later.', 'error');
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Failed to load notes.';
    notesList.appendChild(empty);
  } finally {
    setLoading(false);
  }
}

/**
 * POST – create a note
 */
async function createNote(title, body) {
  setLoading(true);
  setStatus('Creating note...', 'loading');

  try {
    const newNote = await request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        body: body || '',
        userId: 1,
      }),
    });

    // Prepend the new note so it appears at the top
    const li = renderNote(newNote);
    if (notesList.firstChild && notesList.firstChild.classList.contains('empty-state')) {
      clearNotesList();
    }
    notesList.insertBefore(li, notesList.firstChild);

    setStatus('Note created successfully!', 'success');
    noteForm.reset();
  } catch (err) {
    console.error(err);
    setStatus('Could not create the note. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * DELETE – remove a note
 */
async function deleteNote(id, listItem) {
  setLoading(true);
  setStatus('Deleting note...', 'loading');

  try {
    await request(`\( {API_URL}/ \){id}`, {
      method: 'DELETE',
    });

    listItem.remove();

    if (notesList.children.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'No notes left. Create one above!';
      notesList.appendChild(empty);
    }

    setStatus('Note deleted successfully.', 'success');
  } catch (err) {
    console.error(err);
    setStatus('Could not delete the note. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
}

// Event listeners
loadBtn.addEventListener('click', loadNotes);

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validation: title required, max 100 characters
  if (!title) {
    setStatus('Title is required.', 'error');
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus('Title must be 100 characters or fewer.', 'error');
    titleInput.focus();
    return;
  }

  createNote(title, body);
});
