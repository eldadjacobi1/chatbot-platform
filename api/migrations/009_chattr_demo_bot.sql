-- The live demo bot on the landing page. It answers questions about the product itself.
INSERT INTO bots (id, owner_id, name, greeting, context, allowed_domains, enabled, collect_leads, suggestions, theme, color, tone)
VALUES (
  'bot_chattr_demo',
  NULL,
  'Chattr',
  'Hi! Ask me anything about Chattr. I''m a Chattr chatbot myself.',
  'Chattr adds an AI chatbot to a small business website. The chatbot answers visitors using only the business information the owner writes, so it does not invent prices or hours.
Setup takes a few minutes: sign up, write your business information, and paste one line of code into your website. It works on any website where you can add a line of code.
Designs: three chat designs (Clean, Bold and Soft), your own brand color, button on the left or right, a custom chat title, and a tone (friendly, professional, playful or short and to the point) for an audience (everyone, kids, seniors or professionals). Owners can also add suggested question buttons.
When the chatbot cannot answer, the visitor can leave their email or phone number. The owner sees these leads in the dashboard.
The dashboard shows how many questions customers asked, the most asked questions, and the questions the chatbot could not answer, so the owner knows what to add to their business information.
Costs stay low: repeated questions are answered instantly without extra cost, chats are kept short, and there are daily limits per plan. A chat that goes nowhere is closed politely.
Plans: Free is $0 and includes 1 chatbot, 50 messages a day, all designs, report totals, and the latest 3 leads. Pro is $9.99 per month and includes 1 chatbot, 300 messages a day, full reports with unanswered and most asked questions, all leads, and extra instructions for the chatbot. Business is $49.99 per month and includes 3 chatbots, 1,500 messages a day, and everything in Pro. Plans can be cancelled any time from the billing page.
Chattr currently answers in English. The chat only works on the website the owner entered, so nobody can copy it onto another site.',
  ARRAY['chatbot-platform-roan.vercel.app', 'localhost'],
  true,
  false,
  ARRAY['How does it work?', 'What does it cost?', 'Can I change how it looks?'],
  'clean',
  '#4338ca',
  'friendly'
)
ON CONFLICT (id) DO NOTHING;
