-- A client is who the work is for. Rates are in US cents per hour.
CREATE TABLE clients (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	short_name TEXT NOT NULL UNIQUE,
	hourly_rate_cents INTEGER NOT NULL
);

INSERT INTO clients (name, short_name, hourly_rate_cents) VALUES ('Richard', 'Max', 0);
