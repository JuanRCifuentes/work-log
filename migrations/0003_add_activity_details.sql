-- SQLite can't add NOT NULL columns to a table with rows, so recreate it.
-- This deletes the activities logged before tasks existed.
DROP TABLE activities;

CREATE TABLE activities (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	description TEXT NOT NULL,
	date TEXT NOT NULL, -- YYYY-MM-DD
	task_id INTEGER NOT NULL REFERENCES tasks (id),
	time_spent INTEGER NOT NULL -- minutes
);

CREATE INDEX idx_activities_task_id ON activities (task_id);
CREATE INDEX idx_activities_date ON activities (date);
