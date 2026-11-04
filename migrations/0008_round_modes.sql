-- How a round was played: 'mix', 'mistakes', 'table-7', 'bonds-10'; NULL for older rounds
ALTER TABLE attempts ADD COLUMN mode TEXT;
