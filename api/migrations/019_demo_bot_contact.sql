-- Demo bot: use the business address as the contact email.
UPDATE bots
SET context = REPLACE(context, 'eldad.jacobi1@gmail.com', 'hello@chatknock.com')
WHERE id = 'bot_chattr_demo';
