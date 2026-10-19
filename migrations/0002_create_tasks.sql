-- A task is a unit of work, such as a Jira ticket. Activities belong to tasks.
CREATE TABLE tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	external_id TEXT UNIQUE, -- external id, e.g. the Jira key SPS-204; NULL when there is none
	description TEXT NOT NULL
);
