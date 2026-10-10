# WebSound Academy on Netlify

Netlify cannot run PHP, so the PHP was rebuilt like this:

| Before (PHP) | Now (Netlify) |
|---|---|
| HTML / CSS / JS pages | Same pages, in the `public/` folder |
| All `.php` files | One file: `netlify/functions/api.mjs` |
| PHP sessions | Safe signed login cookies |
| `uploads/` folder (PDF, pictures) | Netlify Blobs (new uploads) and `public/uploads/notes` (your 2 old PDFs) |
| MySQL on InfinityFree | MySQL on Aiven (outside Netlify) |
| `admin.php` | `admin.html` + `admin.js` (same design) |

## Folder map

```
websound-netlify/
  netlify.toml
  package.json
  schema.sql                  (only for a new empty database)
  netlify/functions/api.mjs   (the whole backend)
  public/                     (the website)
    index.html, about.html, contact.html, categories.html
    courses.html              (student portal, was courses.php)
    login.html, register.html, welcome.html
    forgot-password.html, reset-password.html
    admin-login.html, admin.html, admin.css, admin.js
    uploads/notes/            (your 2 old PDFs)
```

## Step 1: Database (Aiven MySQL)

1. Create a free MySQL service on Aiven (the same way as your other projects).
2. Copy the connection URL. It looks like `mysql://USER:PASSWORD@HOST:PORT/defaultdb`.
3. Put the tables in it. Choose one:
   - **Keep your old data:** in phpMyAdmin on InfinityFree click *Export* (SQL), then import that file into Aiven with MySQL Workbench or DBeaver.
   - **Start fresh:** run `schema.sql`. (I rebuilt it from your PHP code, so compare it with your old tables.)

## Step 2: Put the project on GitHub and connect it to Netlify

1. Upload the `websound-netlify` folder to a new GitHub repository.
2. On Netlify: *Add new site* > *Import an existing project* > choose the repository.
3. Leave the build settings as they are (`netlify.toml` already sets them).

## Step 3: Environment variables

Netlify > Site configuration > Environment variables. Add:

| Name | What to put |
|---|---|
| `DATABASE_URL` | the Aiven URL from Step 1 |
| `JWT_SECRET` | any long random text, 30+ characters |
| `ADMIN_PASSWORD_HASH` | the hash from your old `admin-login.php` (the long text starting with `$2y$`, between the quotes). Your admin password stays the same. |

For the "forgot password" email (optional but needed for that feature):

| Name | What to put |
|---|---|
| `BREVO_API_KEY` | API key from brevo.com (free plan) |
| `MAIL_FROM` | the sender email you verified in Brevo |
| `SITE_URL` | your Netlify link, for example `https://websound.netlify.app` |

After adding variables, deploy again (*Deploys* > *Trigger deploy*).

## Step 4: Test

1. Open the site, register a student, log in. You should see the welcome door animation, then the courses.
2. Open `/admin-login.html`, log in, add a course, then add a video, a PDF and a quiz link.
3. Log in as the student again and open the course. The content should show.

## Important changes and limits

- **Forgot password is now safe.** The old code sent the reset link straight to the browser, so anyone who knew a student's email could reset that password. Now the link is sent by email only.
- **PDF notes: maximum 4.5 MB. Pictures: maximum 2 MB.** For a bigger PDF, upload it to Google Drive and add it as a link.
- **Deleting a course** now also deletes its videos, notes and quiz links.
- Old course pictures from InfinityFree were not in the zip. If your courses had pictures, upload them again from the admin page.
- Admin logs out after 30 minutes without activity (same as before).
- The Payments menu, certificates page, chatbot and AI quiz are not built yet (they were not in the PHP code either).
- Links like `certificates.html`, `booking.html` and `cv.html`, and the social links `YOUR_FACEBOOK_LINK` and similar, still do not exist or are placeholders.
