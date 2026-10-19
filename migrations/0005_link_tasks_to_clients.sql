-- SQLite can't add a NOT NULL foreign key to a table with rows, so rebuild tasks.
-- The rows are copied aside and back in so activities' references to tasks stay
-- valid; foreign keys are checked once, at the end.
-- Existing tasks all go to Max for now; edit_task can move them to another client.
PRAGMA defer_foreign_keys = true;

CREATE TABLE tasks_backup AS SELECT id, external_id, description FROM tasks;
DROP TABLE tasks;

CREATE TABLE tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	external_id TEXT UNIQUE, -- external id, e.g. the Jira key SPS-204; NULL when there is none
	description TEXT NOT NULL,
	client_id INTEGER NOT NULL REFERENCES clients (id)
);

INSERT INTO tasks (id, external_id, description, client_id)
SELECT
	id,
	external_id,
	description,
	(SELECT id FROM clients WHERE short_name = 'Max')
FROM tasks_backup;

DROP TABLE tasks_backup;

CREATE INDEX idx_tasks_client_id ON tasks (client_id);
