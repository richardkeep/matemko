-- JSON array of the round's sums and the learner's answers: [{a, op, b, c, hide, answer}]; NULL for older rounds
ALTER TABLE attempts ADD COLUMN problems TEXT;
