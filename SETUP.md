# Card Vault — Setup Guide

This guide takes you from the zip file to a live app on your phone. Follow it top to bottom. It takes about 30–45 minutes the first time.

**What you'll set up:**

| Piece | What it does | Cost |
|---|---|---|
| GitHub | Holds your code | Free |
| Supabase | Your database and login | Free |
| TCG API | TCGplayer market prices for TCG cards and sealed | Free tier, paid plans if you need more |
| eBay Developer | Prices for sports sealed boxes from eBay Buy It Now listings | Free |
| Vercel | Hosts the website and runs the nightly price job | Free |

SportsCardsPro (sports singles and slabs) and PriceCharting (graded TCG) are optional paid add-ons. You can skip them.

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

> **Already ran an older copy of `schema.sql`?** Run this new one again the same way. It's safe to run twice and won't delete anything. It adds eBay as an allowed price source.

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

### 3b. eBay Developer keys (sports sealed prices, free)
The app searches eBay for new, Buy It Now listings of each box you own. It drops junk (cases, breaks, opened or empty boxes, wrong years, suspiciously cheap listings), then uses the middle of the 5 cheapest that remain as the market price.

1. Go to **developer.ebay.com** and click **Register**. You can sign in with your normal eBay account.
2. Fill out the sign-up form. eBay may take up to one business day to approve your developer account. You'll get an email.
3. Once approved, sign in and go to **Application Keys** (under your account name, or **My Account → Application Access Keys**).
4. Give your app a name like `card-vault`, then click **Create a keyset** under **Production** (not Sandbox).
5. eBay may ask about **Marketplace Account Deletion** notifications before turning on your Production keys. This app doesn't store any eBay user data, so choose the option to **apply for an exemption** (it says something like "I do not persist eBay data"), pick that reason, and submit.
6. Your Production keyset shows several values. You need two:
   - **App ID (Client ID)**: copy it as `EBAY CLIENT ID`.
   - **Cert ID (Client Secret)**: copy it as `EBAY CLIENT SECRET`. Keep this one private.
   - You can ignore the Dev ID.

### 3c. SportsCardsPro (optional, paid)
Only if you later want sports **singles or slabs** priced automatically. Skip it for now.
1. Subscribe at **sportscardspro.com** to a plan with API access.
2. On your **Subscription** page, click **API/Download** and copy the 40-character token as `SPORTSCARDSPRO TOKEN`.

### 3d. PriceCharting (optional)
Only do this if you want **graded Pokémon and other TCG slabs** (like a PSA 10 Charizard) priced automatically. TCGplayer only prices raw cards. Without this, you can still add graded TCG cards and enter their value yourself.
1. Go to **pricecharting.com**, subscribe to a plan with API access, and copy the token from your subscription page as `PRICECHARTING TOKEN`.

### 3e. Make a cron secret
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
| `EBAY_CLIENT_ID` | your EBAY CLIENT ID |
| `EBAY_CLIENT_SECRET` | your EBAY CLIENT SECRET |
| `CRON_SECRET` | your CRON SECRET |
| `SPORTSCARDSPRO_TOKEN` | optional: only if you did Step 3c |
| `PRICECHARTING_TOKEN` | optional: only if you did Step 3d |

   Skip the optional ones if you didn't sign up for them. Don't add them with an empty value.

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

**A sports sealed box:**
1. In the app, tap **+ Add**. **Sports** and **Sealed** are already selected, with **eBay Buy It Now** as the price source.
2. Type the box the way you'd search eBay, like `2024 Panini Prizm Football Hobby Box`. Include the year, brand, sport, and box type (Hobby, Blaster, Mega, FOTL, Jumbo…).
3. Tap **Check eBay**. You'll see the estimated price and the 5 listings it used.
4. **Look at those listings.** If any are the wrong product (say, a Blaster when you own a Hobby box), add words to leave out, like `blaster, mega`, and tap **Check eBay** again.
5. Fill in quantity and what you paid per box. Tap **Add to vault**.

**A TCG card or box:**
1. Tap **+ Add**, then **TCG**, then **Single** or **Sealed**.
2. Search something like `Charizard ex Obsidian Flames` or `Surging Sparks booster box`, and tap **Search**.
3. Tap the right result. Pick the printing you own (e.g. **Normal** or **Holofoil**).
4. Fill in quantity and cost. Tap **Add to vault**.

Then open any item and tap **Refresh price** to make sure live pricing works.

Sports singles and slabs still work. They just use **Enter price myself**, unless you add SportsCardsPro later.

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
| Search says "TCGAPI_KEY is not set in Vercel" (or another key name) | Add that variable in Vercel, then redeploy. |
| Search says "Session expired" or "Not signed in" | Sign out and sign back in. If it keeps happening, check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. |
| "Price source daily limit reached" | You used up the TCG API free tier for today. It resets daily, or upgrade your plan. |
| An item says "Price check failed: No current market price…" | That grade or printing has no recent sales. Open the item → **Edit** → check "Stop automatic pricing" and enter a value yourself. |
| "eBay sign-in failed" | Check `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` in Vercel. Make sure they're the **Production** keys, not Sandbox, and that your Production keyset is turned on (Step 3b, part 5). Redeploy after fixing. |
| A sports box's eBay price looks too high or too low | Open it → **See listings** to check what's matching. Then **Edit** the eBay search or add words to leave out, save, and tap **Refresh price**. |
| "No current market price for eBay low Buy It Now" | No new Buy It Now listings matched tonight. Usually it's an older or rare box. Broaden the search, or switch it to a manual price. |
| The nightly job never runs | Make sure `CRON_SECRET` is set in Vercel and that you redeployed after adding it. Check **Settings → Cron Jobs**. |
| Changed code or settings but nothing changed | Redeploy (Step 4 note). For code changes, upload the changed files to GitHub. Vercel redeploys on its own after each commit. |
