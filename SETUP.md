# Card Vault — Setup Guide

This guide takes you from the zip file to a live app on your phone. Follow it top to bottom. It takes about 30–45 minutes the first time.

**What you'll set up:**

| Piece | What it does | Cost |
|---|---|---|
| GitHub | Holds your code | Free |
| Supabase | Your database and login | Free |
| TCG API | TCGplayer market prices for TCG cards and sealed | Free tier, paid plans if you need more |
| SportsCardsPro | Raw and graded sports card prices | Paid subscription |
| Vercel | Hosts the website and runs the nightly price job | Free |

You'll collect several keys along the way. Keep a note open (Notes app, a text file) and paste each one in as you get it. **Never post these keys anywhere public or put them in GitHub.**

---

## Step 1 — Put the code on GitHub

1. Unzip `card-vault.zip`. You'll get a folder called `card-vault`.
2. Go to **github.com** and sign in.
3. Click the **+** in the top right, then **New repository**.
4. Name it `card-vault`. Choose **Private**. Leave everything else alone. Click **Create repository**.
5. On the next page, click the link that says **uploading an existing file**.
6. Open the `card-vault` folder on your computer. Select **everything inside it** (not the folder itself) and drag it into the GitHub upload box.
   - On a Mac, files starting with a dot (`.gitignore`, `.env.example`) are hidden. Press **Cmd + Shift + .** in Finder to show them, then drag them too. If you skip them, the app still works.
   - Do **not** upload `node_modules` or `dist` folders if you see them. The zip doesn't include them.
7. Make sure you can see the folders `api`, `src`, `supabase`, `public` and files like `package.json` and `vercel.json` in the upload list.
8. Click **Commit changes**.

---

## Step 2 — Set up Supabase (database and login)

You can create a **new Supabase project** (recommended, keeps this separate from your other apps) or reuse an existing one. All tables in this app start with `cv_`, so they won't clash with your other apps' tables.

### 2a. Create the project
1. Go to **supabase.com** and sign in.
2. Click **New project**. Name it `card-vault`.
3. Make up a database password and save it in your note. (The app doesn't use it, but you may need it later.)
4. Pick the region closest to you (e.g. **East US** or **Central US**).
5. Click **Create new project** and wait 1–2 minutes for it to finish.

### 2b. Create the tables
1. In the left sidebar, click **SQL Editor**.
2. Click **New query** (or the **+** button).
3. Open `supabase/schema.sql` from the code folder in any text editor (TextEdit, Notepad, VS Code). Select all, copy.
4. Paste it into the Supabase SQL editor.
5. Click **Run**. You should see "Success. No rows returned."
6. Check it worked: click **Table Editor** in the left sidebar. You should see `cv_holdings`, `cv_price_history`, and `cv_sales`.

### 2c. Copy your keys
1. Click the **gear icon (Project Settings)** at the bottom of the left sidebar.
2. Find your **Project URL** (it looks like `https://abcdxyz.supabase.co`). Under **Data API** or on the main settings page. Copy it into your note as `SUPABASE URL`.
3. Click **API Keys**. You'll see two keys. Supabase has two naming styles, and either works:
   - The public one: called **publishable** key (starts with `sb_publishable_`) or **anon public** key. Copy it as `ANON KEY`.
   - The private one: called **secret** key (starts with `sb_secret_`) or **service_role** key. You may need to click **Reveal**. Copy it as `SERVICE KEY`.
   - ⚠️ The secret/service_role key can read and change everything in your database. Only ever paste it into Vercel.

### 2d. Login settings
1. In the left sidebar, click **Authentication**, then **Sign In / Providers** (on some layouts: **Providers**, then **Email**).
2. Make sure **Email** is turned on.
3. Since this app is just for you, turn **off** "Confirm email". That way you can sign in right after creating your account. (If you leave it on, you'll get a confirmation email first. That works too.)
4. Click **Save**.

You'll come back in Step 6 to turn off new sign-ups so strangers can't make accounts.

---

## Step 3 — Get your price API keys

### 3a. TCG API (TCGplayer market prices)
1. Go to **tcgapi.dev** and click **Get API Key**. Create an account.
2. In your dashboard, copy your API key into your note as `TCGAPI KEY`.
3. **About the free tier:** it allows 100 requests per day. Here's how the app uses them:
   - Each search in the Add screen = 1 request
   - Picking a result to see its prices = 1 request
   - The nightly update = 1 request per different TCG product you own
   - So the free tier covers you until you own around 80 different TCG products. Past that, upgrade to a paid plan (from about $9.99/month, check their pricing page for current prices).

### 3b. SportsCardsPro (sports card prices)
1. Go to **sportscardspro.com** and create an account.
2. Subscribe to a plan that includes API access. Check their **Subscriptions** page for current plans and prices.
3. Go to your **Subscription** page and click the **API/Download** button. Copy the 40-character token into your note as `SPORTSCARDSPRO TOKEN`.

### 3c. PriceCharting (optional)
Only do this if you want **graded Pokémon and other TCG slabs** (like a PSA 10 Charizard) priced automatically. TCGplayer only prices raw cards. Without this, you can still add graded TCG cards and enter their value yourself.
1. Go to **pricecharting.com**, subscribe to a plan with API access, and copy the token from your subscription page as `PRICECHARTING TOKEN`.

### 3d. Make a cron secret
This is a password that protects the nightly price job so random people can't trigger it.
1. Go to any password generator (your phone's password manager can make one, or search "random password generator").
2. Make one at least 32 characters long with **letters and numbers only** (no symbols).
3. Save it in your note as `CRON SECRET`.

---

## Step 4 — Deploy to Vercel

1. Go to **vercel.com** and sign in with GitHub.
2. Click **Add New…** then **Project**.
3. Find `card-vault` in the list and click **Import**. (If you don't see it, click **Adjust GitHub App Permissions** and give Vercel access to the repo.)
4. Vercel should detect **Vite** as the framework. Leave the build settings as they are.
5. Open the **Environment Variables** section. Add each of these, one at a time. Type the **Name** exactly as shown, paste the **Value** from your note, click **Add**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your SUPABASE URL |
| `VITE_SUPABASE_ANON_KEY` | your ANON KEY (publishable) |
| `SUPABASE_URL` | your SUPABASE URL (same as above) |
| `SUPABASE_SERVICE_ROLE_KEY` | your SERVICE KEY (secret) |
| `TCGAPI_KEY` | your TCGAPI KEY |
| `SPORTSCARDSPRO_TOKEN` | your SPORTSCARDSPRO TOKEN |
| `PRICECHARTING_TOKEN` | only if you did Step 3c |
| `CRON_SECRET` | your CRON SECRET |

   Double-check for extra spaces at the start or end of each value.

6. Click **Deploy**. Wait 1–2 minutes.
7. When it says "Congratulations", click the preview image or **Continue to Dashboard**, then click **Visit**. That's your app's web address (something like `card-vault-abc.vercel.app`). Save it.

> **Added or changed an environment variable later?** It doesn't apply until you redeploy. Go to your project → **Deployments** tab → click the **⋯** on the top deployment → **Redeploy**.

---

## Step 5 — Create your account

1. Open your app's web address.
2. Tap **First time? Create your account**.
3. Enter your email and a password (at least 6 characters). Tap **Create account**.
4. If you turned off "Confirm email" in Step 2d, you're in. If not, check your email, tap the link, then sign in.

**If you see "Almost there… can't find your Supabase settings":** the `VITE_` variables are missing or misspelled. Fix them in Vercel and redeploy (see the note at the end of Step 4).

---

## Step 6 — Lock it down (important)

Right now, anyone who finds your web address could make an account. Each account only sees its own data, but they could use up your price API requests. Turn off new sign-ups:

1. Go back to Supabase → **Authentication** → **Sign In / Providers** (or **Settings**).
2. Turn **off** "Allow new users to sign up".
3. Click **Save**.

You can still sign in normally.

---

## Step 7 — Add your first items and test

1. In the app, tap **+ Add**.
2. Pick **Sports** or **TCG**, then **Single**, **Graded**, or **Sealed**.
3. Choose the price source (it picks a sensible default), type a search like `Caleb Williams 2024 Prizm` or `Surging Sparks booster box`, and tap **Search**.
4. Tap the right result. You'll see its prices. Pick the one that matches what you own (e.g. **PSA 10**, or **Holofoil**).
5. Fill in quantity and what you paid per item. Tap **Add to vault**.
6. Open the item and tap **Refresh price** to make sure live pricing works.

**Add it to your phone's home screen:** open the app in Safari → tap **Share** → **Add to Home Screen**. (On Android Chrome: **⋮** menu → **Add to Home screen**.)

---

## Step 8 — Check the nightly price update

The app updates every price once a day at about **5–6 AM Central** (11:00 UTC). Vercel's free plan runs it once a day, sometime within that hour.

To test it now instead of waiting:
1. In Vercel, open your project → **Settings** → **Cron Jobs**.
2. Next to `/api/refresh-prices`, click **Run**.
3. Go to the **Logs** tab to see the result. It reports how many items it checked, updated, and any that failed.

Each night adds a point to your charts. The portfolio chart gets useful after about a week.

---

## How it all works (short version)

- **The website** (the `src` folder) is what you see and tap.
- **The server functions** (the `api` folder) run on Vercel. They hold your price API keys so the keys never reach your browser.
  - `/api/search` and `/api/quote` look up cards and their prices when you add something.
  - `/api/refresh-item` re-checks one item when you tap **Refresh price**.
  - `/api/refresh-prices` is the nightly job. It updates every item you still hold and saves the day's price.
- **Supabase** stores three tables: your holdings, a daily price history for each item, and your sales.

**How profit is calculated:**
- *Unrealized* = (current market price − what you paid) × quantity, for things you still hold.
- *Realized* = sale price − fees − shipping − what those items cost you, from your sales log.
- Items with no market price count at cost, so they don't fake a gain or loss.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Couldn't load your data… relation does not exist" | You haven't run `schema.sql` yet. Do Step 2b. |
| Search says "TCGAPI_KEY is not set in Vercel" (or the token name) | Add that variable in Vercel, then redeploy. |
| Search says "Session expired" or "Not signed in" | Sign out and sign back in. If it keeps happening, check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. |
| "Price source daily limit reached" | You used up the TCG API free tier for today. It resets daily, or upgrade your plan. |
| An item says "Price check failed: No current market price…" | That grade or printing has no recent sales. Open the item → **Edit** → check "Stop automatic pricing" and enter a value yourself. |
| A sealed sports box doesn't show up in search | SportsCardsPro may not list it. Add it with **Enter price myself**. |
| The nightly job never runs | Make sure `CRON_SECRET` is set in Vercel and that you redeployed after adding it. Check **Settings → Cron Jobs**. |
| Changed code or settings but nothing changed | Redeploy (Step 4 note). For code changes, upload the changed files to GitHub. Vercel redeploys on its own after each commit. |
