# Runner: going live

The site works right now in **preview mode** (pretend login, data saved only in your browser).
Follow these steps to turn on real Discord login, video uploads and journals.
Everything below is free to start, except the domain (about $10–12 a year).

---

## 1. Look at it on your Mac

In Terminal:

```bash
cd ~/Documents/Website
python3 -m http.server 5173
```

Open http://localhost:5173. Press `Ctrl + C` in Terminal to stop it.

## 2. Create the database (Supabase)

1. Make a free account at https://supabase.com and create a project (any name, e.g. `nq-inducement`).
2. In the project, open **SQL Editor → New query**, paste everything from `schema.sql`, and press **Run**.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Paste them into `config.js`:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```
   The anon key is meant to be public. The database rules in `schema.sql` keep each member's journal private and only let admins upload.

## 3. Create the Discord login

1. Go to https://discord.com/developers/applications → **New Application** → name it `Runner`.
2. Upload `logo-mark.svg` (as PNG) as the app icon if you like. Members see it on the "Authorize" screen.
3. Open **OAuth2**. Copy the **Client ID**, then **Reset Secret** and copy the **Client Secret**.
4. Under **Redirects**, add:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   (your Supabase Project URL followed by `/auth/v1/callback`).
5. In Supabase: **Authentication → Sign In / Providers → Discord**. Turn it on, paste the Client ID and Client Secret, and save.
6. In Supabase: **Authentication → URL Configuration**:
   - **Site URL:** `https://your-domain.com` (or `http://localhost:5173` until the domain is live)
   - **Redirect URLs:** add `http://localhost:5173/**` and `https://your-domain.com/**`

## 4. Make yourself the admin (so you can upload)

1. Sign in on the site once with your Discord account.
2. In Supabase, go to **Authentication → Users**, find yourself, and copy your **User UID**.
3. In **SQL Editor**, run:
   ```sql
   insert into public.admins (user_id) values ('PASTE-YOUR-USER-UID-HERE');
   ```
4. Refresh the Library page. An **Upload a video** button appears for you only.

To add another admin later, repeat with their User UID.

## 5. Show your Discord server

In `config.js`, set your invite link:

```js
DISCORD_INVITE_URL: "https://discord.gg/yourcode",
```

This turns on the **Join the Discord** button and the live "online · members" count in the header.
Use an invite that never expires.

## 6. Buy the domain

Pick a domain for Runner and buy it at any registrar, for example:

- Cloudflare Registrar (cheapest renewals): https://www.cloudflare.com/products/registrar/
- Porkbun: https://porkbun.com
- Namecheap: https://www.namecheap.com

## 7. Put it online

The site is plain HTML, CSS and JavaScript, so any static host works. The simplest:

1. Make a free account at https://app.netlify.com.
2. Drag the whole `Website` folder onto **Sites → Deploy manually**.
3. In **Domain management**, add `your-domain.com` and follow the steps to point your domain at it.
4. Make sure `https://your-domain.com/**` is in Supabase's Redirect URLs (step 3.6).

Vercel and Cloudflare Pages work the same way.

---

## Good to know

- **Video size:** Supabase's free plan gives 1 GB of storage and 50 MB per file. The Pro plan ($25/month) gives 100 GB and much larger files. If the library grows big, a video service like Bunny Stream or Mux is cheaper for streaming. Only `data.js` would need to change.
- **Categories and instruments:** edit the lists in `config.js`.
- **Who can sign in:** anyone with a Discord account. Only the library and journal need sign-in; the homepage is public.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Homepage |
| `library.html` | Video library and admin upload |
| `journal.html` | Trade journal |
| `config.js` | Your settings (keys, invite link, categories) |
| `data.js` | Talks to Supabase, or the browser in preview mode |
| `sakura.js` | Falling sakura animation and candlesticks |
| `styles.css` | All styling and colors |
| `logo-mark.svg` | Logo |
| `schema.sql` | Database tables and security rules |
