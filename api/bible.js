// api/bible.js
// Returns a verse of the day (rotates daily) + a short reflection.
// Uses bible-api.com — free, no key needed.

const VERSES = [
  { ref: "philippians+4:13", display: "Philippians 4:13", reflection: "Whatever challenge you face today, you don't face it in your own strength. God equips you for every task he calls you to." },
  { ref: "joshua+1:9", display: "Joshua 1:9", reflection: "Courage isn't the absence of fear — it's moving forward anyway, knowing God is with you wherever you go." },
  { ref: "psalm+23:1", display: "Psalm 23:1", reflection: "When God is your shepherd, you lack nothing. Rest in the truth that he provides, protects, and leads you." },
  { ref: "romans+8:28", display: "Romans 8:28", reflection: "Even in your hardest seasons, God is weaving something good. Trust the process even when you can't see the full picture." },
  { ref: "proverbs+3:5-6", display: "Proverbs 3:5–6", reflection: "Lean into God's understanding, not just your own. When you acknowledge him in your decisions, he will direct your path." },
  { ref: "isaiah+40:31", display: "Isaiah 40:31", reflection: "Waiting on God isn't passive — it's an act of faith. Those who trust him are renewed with strength that outlasts any obstacle." },
  { ref: "john+3:16", display: "John 3:16", reflection: "The foundation of everything. God's love isn't earned — it's freely given to whoever believes. That includes you, today." },
  { ref: "matthew+6:33", display: "Matthew 6:33", reflection: "When we prioritize God's kingdom above our worries and ambitions, we find that everything we truly need is provided." },
  { ref: "2+corinthians+5:7", display: "2 Corinthians 5:7", reflection: "Faith means taking the next step even when you can't see the staircase. God's promises are more reliable than what your eyes can see." },
  { ref: "psalm+46:1", display: "Psalm 46:1", reflection: "In every storm — personal, relational, or spiritual — God is a refuge that never fails. You can run to him without hesitation." },
  { ref: "jeremiah+29:11", display: "Jeremiah 29:11", reflection: "God's plans for you were formed before you were born. Even in seasons of uncertainty, his purpose for your life holds firm." },
  { ref: "galatians+5:22-23", display: "Galatians 5:22–23", reflection: "The fruit of the Spirit isn't manufactured by willpower — it grows naturally when we walk in step with God each day." },
  { ref: "romans+12:2", display: "Romans 12:2", reflection: "The world constantly tries to shape how we think and live. Transformation comes not from conforming, but from renewing your mind in God's truth." },
  { ref: "psalm+119:105", display: "Psalm 119:105", reflection: "God's Word doesn't illuminate the entire road ahead — just enough for the next step. That's all the light you need." },
  { ref: "matthew+5:14", display: "Matthew 5:14", reflection: "You are not a small, insignificant person. You carry light into every room you enter. Let it shine without apology." },
  { ref: "1+corinthians+13:4-5", display: "1 Corinthians 13:4–5", reflection: "Love is not a feeling — it's a daily choice. These verses set the standard and remind us how far we can grow." },
  { ref: "ephesians+2:8-9", display: "Ephesians 2:8–9", reflection: "Salvation is not something you earn or deserve. It's a gift. That should fill you with gratitude and free you from striving." },
  { ref: "psalm+27:1", display: "Psalm 27:1", reflection: "If God is your light and salvation, what is there left to fear? Let this truth settle into every anxious corner of your heart." },
  { ref: "colossians+3:23", display: "Colossians 3:23", reflection: "Whatever you do today — work hard at it as if you're doing it for God, not just for people. That reframe changes everything." },
  { ref: "hebrews+11:1", display: "Hebrews 11:1", reflection: "Faith is not wishful thinking — it's confident trust in what God has promised. It gives substance to hope before it arrives." },
  { ref: "isaiah+41:10", display: "Isaiah 41:10", reflection: "God doesn't just watch from a distance — he strengthens you, helps you, and holds you up. You are not alone in anything you face." },
  { ref: "matthew+11:28", display: "Matthew 11:28", reflection: "Jesus doesn't invite the strong — he invites the weary. If you're tired today, this verse is spoken directly to you." },
  { ref: "romans+5:8", display: "Romans 5:8", reflection: "God didn't wait for you to get your life together before loving you. He loved you in the middle of your mess. That's grace." },
  { ref: "psalm+37:4", display: "Psalm 37:4", reflection: "Delight in God and your desires begin to align with his. The deepest desires of your heart were placed there by him." },
  { ref: "john+16:33", display: "John 16:33", reflection: "Jesus doesn't promise a trouble-free life — he promises peace in the middle of it. He has already overcome the world." },
  { ref: "2+timothy+1:7", display: "2 Timothy 1:7", reflection: "Fear does not come from God. When anxiety creeps in, remember what you've been given: power, love, and a sound mind." },
  { ref: "psalm+139:14", display: "Psalm 139:14", reflection: "You are not an accident. You are fearfully and wonderfully made — intentionally designed by a God who knows every detail about you." },
  { ref: "luke+6:31", display: "Luke 6:31", reflection: "The golden rule is simple but demanding. Treat every person you encounter today the way you would want to be treated." },
];

export default async function handler(req, res) {
  // Pick verse based on day of year so it rotates daily
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const entry = VERSES[dayOfYear % VERSES.length];

  try {
    const r = await fetch(`https://bible-api.com/${entry.ref}`);
    const data = await r.json();
    res.json({
      reference: entry.display,
      text: data.text?.trim() ?? "",
      translation: data.translation_name ?? "World English Bible",
      reflection: entry.reflection,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch verse" });
  }
}
