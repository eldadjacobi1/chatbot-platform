// Customer embed script. Usage on their website:
//   <script src="https://YOUR-API/embed.js" data-bot="BOT_ID"></script>
// Adds a chat button; the chat window loads in a sandboxed iframe on first click.
(function () {
  var script = document.currentScript;
  var botId = script && script.getAttribute("data-bot");
  if (!botId) {
    console.error("Chat widget: missing data-bot attribute.");
    return;
  }
  var base = new URL(script.src).origin;

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");
  button.textContent = "💬";
  button.style.cssText =
    "position:fixed;right:16px;bottom:16px;width:56px;height:56px;border-radius:50%;" +
    "border:0;background:#1a73e8;color:#fff;font-size:26px;cursor:pointer;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:2147483646;";

  var frame = document.createElement("iframe");
  frame.title = "Chat";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.style.cssText =
    "position:fixed;right:16px;bottom:84px;width:min(360px,calc(100vw - 32px));" +
    "height:min(520px,calc(100vh - 100px));border:0;border-radius:12px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.25);background:#fff;display:none;z-index:2147483647;";

  var loaded = false;
  button.addEventListener("click", function () {
    var open = frame.style.display === "none";
    if (open && !loaded) {
      // Load the chat only on first open, so visitors who never click cost nothing.
      frame.src = base + "/widget/" + encodeURIComponent(botId);
      loaded = true;
    }
    frame.style.display = open ? "block" : "none";
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);
})();
