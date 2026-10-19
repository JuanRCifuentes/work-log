-- A project groups a client's tasks, such as ProSearch under CCS.
CREATE TABLE projects (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	short_name TEXT NOT NULL UNIQUE, -- unique across all clients
	client_id INTEGER NOT NULL REFERENCES clients (id)
);

CREATE INDEX idx_projects_client_id ON projects (client_id);

-- Existing tasks have no project yet; edit_task files them under one. New tasks always get a project.
-- tasks.client_id stays, and the tools keep it equal to the project's client. Once every task has a
-- project, a later migration can make project_id NOT NULL and drop client_id.
ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects (id);

CREATE INDEX idx_tasks_project_id ON tasks (project_id);
