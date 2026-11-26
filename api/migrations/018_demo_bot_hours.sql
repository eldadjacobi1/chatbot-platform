-- Demo bot: answer "when are you open" style questions.
UPDATE bots
SET context = context || '
Hours: the Chatknock chatbot is on 24/7, every day, including nights and holidays. A business''s own chatbot answers at any hour, even when the business is closed. Support by email is answered on business days.'
WHERE id = 'bot_chattr_demo'
  AND context NOT LIKE '%the Chatknock chatbot is on 24/7%';
