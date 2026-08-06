UPDATE likes SET reaction = '❤️' WHERE reaction IS NULL OR reaction = '';

ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_pkey;
ALTER TABLE likes ADD PRIMARY KEY (entry_id, user_id, reaction);
