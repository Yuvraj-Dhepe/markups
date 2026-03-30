# OAuth Proxy Worker

To enable a truly 1-click single sign-on experience for GitHub and GitLab without a backend server, you can deploy a tiny, free "OAuth Proxy" using Cloudflare Workers.

This proxy securely exchanges the temporary OAuth \`code\` for an \`access_token\` without exposing your Client Secret to the browser.

## How to deploy on Cloudflare Workers (Free)

1. Sign up for a free account at [Cloudflare Workers](https://workers.cloudflare.com/)
2. Click **Create a Service**
3. Name it \`markups-oauth-proxy\`
4. Select **Quick Edit**
5. Paste the following code:

\`\`\`javascript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const provider = url.searchParams.get("provider"); // 'github' or 'gitlab'

    if (!code || !provider) {
      return new Response("Missing code or provider", { status: 400, headers: CORS_HEADERS });
    }

    let tokenUrl, clientId, clientSecret;

    if (provider === "github") {
      tokenUrl = "https://github.com/login/oauth/access_token";
      clientId = env.GITHUB_CLIENT_ID;
      clientSecret = env.GITHUB_CLIENT_SECRET;
    } else if (provider === "gitlab") {
      tokenUrl = "https://gitlab.com/oauth/token";
      clientId = env.GITLAB_CLIENT_ID;
      clientSecret = env.GITLAB_CLIENT_SECRET;
    } else {
      return new Response("Invalid provider", { status: 400, headers: CORS_HEADERS });
    }

    try {
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      });

      const data = await tokenResponse.json();

      if (data.error) {
        return new Response(JSON.stringify({ error: data.error }), {
            status: 400,
            headers: CORS_HEADERS
        });
      }

      // Return the token to the frontend securely
      return new Response(JSON.stringify({ access_token: data.access_token }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          headers: CORS_HEADERS
      });
    }
  },
};
\`\`\`

6. Click **Save and Deploy**.
7. Go to the **Settings > Variables** tab of your new Worker.
8. Add your Client IDs and Secrets as **Environment Variables** (make sure to click "Encrypt" for the secrets):
   - \`GITHUB_CLIENT_ID\`
   - \`GITHUB_CLIENT_SECRET\`
   - \`GITLAB_CLIENT_ID\`
   - \`GITLAB_CLIENT_SECRET\`

### Using the proxy

Once deployed, your Cloudflare Worker URL will look something like \`https://markups-oauth-proxy.yourname.workers.dev\`.

In the Markups codebase, you can now implement the OAuth flow by pointing the frontend to this proxy URL to exchange the code for a token.

> *Note: In the current version of the app, we use Personal Access Tokens (PATs) directly for simplicity. If you wish to use this proxy in the future, you can update \`GitHubProvider.js\` and \`GitLabProvider.js\` to open an OAuth popup and call this worker.*
