# QuickNotes System Design

A full-stack system-design exercise: a small browser client that talks to a practice REST API, plus the design documents needed to build a production QuickNotes service for 1 million users.

## Description

QuickNotes is a simple note-taking application. Users can load existing notes, create new ones, and delete notes. The front-end client is built with plain HTML, CSS and JavaScript and currently uses the public JSONPlaceholder API for practice. The three design documents in `docs/` describe the real API, the relational data model, and a scalable architecture that can support one million users.

## How to run the API client

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/quicknotes-system-design.git
   cd quicknotes-system-design
