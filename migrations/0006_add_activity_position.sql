-- SQLite can't add a NOT NULL column to a table with rows, so rebuild activities.
-- position orders a task's activities, starting at 1; existing rows keep the
-- order they were logged in.
CREATE TABLE activities_backup AS SELECT id, description, date, task_id, time_spent FROM activities;
DROP TABLE activities;

CREATE TABLE activities (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	description TEXT NOT NULL,
	date TEXT NOT NULL, -- YYYY-MM-DD
	task_id INTEGER NOT NULL REFERENCES tasks (id),
	time_spent INTEGER NOT NULL, -- minutes
	position INTEGER NOT NULL,
	UNIQUE (task_id, position)
);

INSERT INTO activities (id, description, date, task_id, time_spent, position)
SELECT id, description, date, task_id, time_spent, ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY date, id)
FROM activities_backup;

DROP TABLE activities_backup;

CREATE INDEX idx_activities_date ON activities (date);
