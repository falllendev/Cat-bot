const fs = require("fs");

const owner = "falllendev";
const repo = "Cat-bot";
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

async function main() {
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL environment variable is not set");
  }

  const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`);
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status} ${res.statusText}`);
  const files = await res.json();
  const images = files.filter(f => /\.(jpe?g|png|gif)$/i.test(f.name));
  if (images.length === 0) throw new Error("No image files found in repository");

  const pick = images[Math.floor(Math.random() * images.length)];
  const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodeURIComponent(pick.name)}`;

  const content = config.roleId
    ? `<@&${config.roleId}> ${config.message}\n${imageUrl}`
    : `${config.message}\n${imageUrl}`;

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      allowed_mentions: config.roleId ? { roles: [config.roleId] } : { parse: [] }
    })
  });
  if (!discordRes.ok) throw new Error(`Discord webhook failed: ${discordRes.status} ${discordRes.statusText}`);
  console.log("Posted:", imageUrl);

  let history = [];
  try { history = JSON.parse(fs.readFileSync("history.json", "utf-8")); } catch (e) { history = []; }
  history.unshift({ photo: pick.name, timestamp: new Date().toISOString() });
  history = history.slice(0, 200);
  fs.writeFileSync("history.json", JSON.stringify(history, null, 2));
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
