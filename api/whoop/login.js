// api/whoop/login.js
// Redirects the user to WHOOP's OAuth login page

export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: `${process.env.WHOOP_REDIRECT_BASE}/api/whoop/callback`,
    response_type: "code",
    scope: "read:recovery read:sleep read:cycles read:workout read:profile",
  });

  res.redirect(`https://api.prod.whoop.com/oauth/oauth2/auth?${params}`);
}
