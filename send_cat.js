const owner = "falllendev";
const repo = "Cat-bot";
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const roleId = "1524624410185826355";

async function main() {
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL environment variable is not set");
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`);
  if (!res.ok) {
    throw new Error(`GitHub API failed: ${res.status} ${res.statusText}`);
  }

  const files = await res.json();
  const images = files.filter(f => /\.(jpe?g|png|gif)$/i.test(f.name));

  if (images.length === 0) {
    throw new Error("No image files found in repository");
  }

  const pick = images[Math.floor(Math.random() * images.length)];
  const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodeURIComponent(pick.name)}`;

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `<@&${roleId}> Hourly cat photo is here\n${imageUrl}`,
      allowed_mentions: { roles: [roleId] }
    })
  });

  if (!discordRes.ok) {
    throw new Error(`Discord webhook failed: ${discordRes.status} ${discordRes.statusText}`);
  }

  console.log("Posted:", imageUrl);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
