-- The landing-page demo bot: new product name, and allowed on the new domain.
UPDATE bots
SET name = 'Chatknock',
    greeting = 'Hi! Ask me anything about Chatknock. I''m a Chatknock chatbot myself.',
    context = REPLACE(context, 'Chattr', 'Chatknock'),
    allowed_domains = ARRAY['chatknock.com', 'www.chatknock.com', 'chatbot-platform-roan.vercel.app', 'localhost']
WHERE id = 'bot_chattr_demo';
