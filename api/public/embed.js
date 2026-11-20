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
  button.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';
  button.style.cssText =
    "position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;" +
    "border:0;background:#4338ca;cursor:pointer;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 6px 20px rgba(67,56,202,.35);z-index:2147483646;";

  var frame = document.createElement("iframe");
  frame.title = "Chat";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.style.cssText =
    "position:fixed;right:20px;bottom:90px;width:min(360px,calc(100vw - 32px));" +
    "height:min(520px,calc(100vh - 100px));border:0;border-radius:20px;" +
    "box-shadow:0 12px 40px rgba(20,20,43,.25);background:#fff;display:none;z-index:2147483647;";

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

  // Only show the button if the bot is on and this website is allowed.
  fetch(base + "/bot-status/" + encodeURIComponent(botId))
    .then(function (r) { return r.json(); })
    .then(function (info) {
      if (!info || !info.show) return;
      var color = /^#[0-9a-fA-F]{6}$/.test(info.color || "") ? info.color : "#4338ca";
      var side = info.position === "left" ? "left" : "right";
      button.style.background = color;
      button.style.boxShadow = "0 6px 20px " + color + "59";
      button.style.right = button.style.left = "";
      frame.style.right = frame.style.left = "";
      button.style[side] = "20px";
      frame.style[side] = "20px";
      document.body.appendChild(frame);
      document.body.appendChild(button);
    })
    .catch(function () { /* if the check fails, show nothing */ });
})();
