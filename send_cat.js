const owner = "falllendev";
const repo = "Cat-bot";
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

async function main() {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`);
  const files = await res.json();
  const images = files.filter(f => /\.(jpe?g|png|gif)$/i.test(f.name));
  const pick = images[Math.floor(Math.random() * images.length)];
  const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${pick.name}`;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: imageUrl })
  });

  console.log("Posted:", imageUrl);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
