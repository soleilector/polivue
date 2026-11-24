# PoliVue Setup and User Guide

Nov 24, 2026 · @Soleil Ector

## What PoliVue and Hadi are

PoliVue is a web app for storing, reading and tracking policy documents in an Amazon S3 bucket, with an AI assistant built in. You upload policies (PDF, Markdown or text), read and edit them in the browser, mark each one resolved, unresolved or remediating, and export Markdown or text as PDF.

Hadi is the assistant, named after Hedy Lamarr. It runs on Anthropic's Claude through your own API key. Ask Hadi a general question, or attach stored documents and ask it to summarize or analyze them. Hadi can also pull files from connected GitHub repositories when your question names them. Any answer can be saved back to the bucket as a new Markdown policy.

The app has two parts: a React client (Vite) in `client/` and an Express server in `server/`. The server serves the built client and talks to S3, AWS Secrets Manager, Anthropic and GitHub, so you open everything at one address: http://localhost:3000.

## Prerequisites

Have these ready before you start.

| Item | Why it's needed | Where to get it |
| --- | --- | --- |
| Node.js 20 or newer, with npm | Runs the server and builds the client | nodejs.org |
| Git (optional) | Cloning the project | git-scm.com |
| An AWS account | S3 stores every document and the connector file; Secrets Manager holds keys | aws.amazon.com |
| An Anthropic API key | Powers Hadi | console.anthropic.com, under API keys |
| A GitHub personal access token (optional) | Lets Hadi read files from your repositories | GitHub, Settings, Developer settings, Personal access tokens |
| About 300 MB of free disk space | The PDF exporter (Puppeteer) downloads its own copy of Chrome during install | Nothing to download by hand |

## AWS setup

You need one S3 bucket, one IAM user with access keys, and (recommended) your keys stored as secrets in Secrets Manager. Do everything in one region, for example us-east-2. A region mismatch is the most common setup error.

1. **Create the bucket.** In S3, choose Create bucket and pick a globally unique name, such as `polivue-yourname-docs`, and your region.
   - Keep Block all public access turned on. The app only hands out short-lived signed links.
   - Set Object Ownership to Bucket owner enforced (the default).
   - Default encryption (SSE-S3) is fine.
2. **Allow browser uploads (CORS).** The Create Policy page uploads straight from the browser to S3, so the bucket must accept requests from the app. Under the bucket's Permissions, CORS, paste:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "POST", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

3. **Create the IAM user.** In IAM, Users, create a user such as `polivue` with no console access. Attach this inline policy, replacing the bucket name, region and account ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::polivue-yourname-docs"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:GetObjectTagging", "s3:PutObjectTagging"],
      "Resource": "arn:aws:s3:::polivue-yourname-docs/*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-2:123456789012:secret:PoliVue-*"
    }
  ]
}
```

4. **Create access keys.** On the user's Security credentials tab, create an access key for an application running outside AWS. Copy the access key ID and the secret access key now, because AWS shows the secret only once.
5. **Store your keys as secrets (recommended).** In Secrets Manager, in the same region, choose Store a new secret, then Other type of secret, then the Plaintext tab. Clear the box and paste only the key, with no quotes, spaces or line breaks. Create one secret per key:
   - `PoliVue-Anthropic`, holding your Anthropic API key (`sk-ant-…`).
   - `PoliVue-GitHub`, holding your GitHub token (`ghp_…` or `github_pat_…`), if you use GitHub.

   Secret names are case-sensitive. Starting every name with `PoliVue-` keeps the IAM policy above to one line.

## Install and run on localhost

You build the client once, then the server serves it at http://localhost:3000. The commands below work the same in PowerShell, Command Prompt or a macOS/Linux terminal.

1. **Get the code.** Clone or copy the `Polivue` folder. It contains `client/`, `server/` and a root `.gitignore` that already keeps `.env` files out of git.
2. **Create `server/.env`.** This file holds the server's settings. Never commit or share it.

```
PORT=3000
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=polivue-yourname-docs
# Optional fallbacks, used only when a connector's own key is blank or can't be fetched:
ANTHROPIC_API_KEY=
GITHUB_TOKEN=
# Only inside Docker or some Linux servers, where Chrome can't sandbox:
# PUPPETEER_NO_SANDBOX=true
```

`AWS_REGION` must be the bucket's region. The keys are the IAM user's keys from AWS setup step 4.

3. **Install the server packages.**

```
cd server
npm install
```

This also downloads Chrome for the PDF exporter, so the first install takes a few minutes.

4. **Install and build the client.**

```
cd ../client
npm install
npm run build
```

The build writes the app to `client/dist`, which the server serves.

5. **Start the server.**

```
cd ../server
node server.js
```

You should see `Server running on http://localhost:3000`. Keep this window open.

6. **Open the app** at http://localhost:3000. The sidebar menu lists the pages.

**After any code change:** rebuild the client (`npm run build` in `client`) for page changes, and stop the server (Ctrl+C) and run `node server.js` again for server changes. After pulling new code, run `npm install` in both folders first.

`npm run dev` (Vite's dev server) isn't supported yet: the pages call the server's routes directly, and the dev proxy only forwards `/api`. Use the build-and-serve steps above.

## Connector setup

Connectors tell PoliVue how to reach outside services. Set them up in this order on the **Connections** page, because each step depends on the one before:

| Order | Connector | Required? | How many allowed | What it's for |
| --- | --- | --- | --- | --- |
| 1 | AWS Secrets Manager | Yes, if any key is written as `AWS-<secret name>` | 1 | Fetches the secrets from AWS setup step 5 |
| 2 | Anthropic API | Yes, for the Query page | 1 | Hadi's model and API key |
| 3 | GitHub repository | No | Unlimited | Lets Hadi read files from a repository |

**Creating a connector**

1. Open Connections from the sidebar. The first save creates the connector file (`config.json`) in your bucket.
2. Pick the type in the Connector type dropdown, then click Create connection. A type that's already at its limit shows "(limit reached)".
3. Type a name: 1 to 64 letters, numbers, dashes or underscores, such as `Anthropic_API`. Names can't be changed later.
4. Edit the settings in the text box. It holds JSON, so keep the double quotes and commas and replace only the values between quotes. The line above the box lists the required settings.
5. Click Save. A missing value shows "Please fill the … field(s) to save". Fix it and save again.

**Writing keys:** wherever a setting is `authToken`, you can either paste the key itself or write `AWS-` plus a secret's name, for example `AWS-PoliVue-Anthropic`. The `AWS-` form is safer, because the real key never touches the bucket. When you reopen a connector, keys show as `***`. Leave `***` as it is to keep the stored key, or type a new one to replace it.

**1. AWS Secrets Manager.** Use the IAM user's keys, and the region your secrets are in:

```json
{
  "accessKeyId": "AKIA...",
  "secretAccessKey": "your-secret-access-key",
  "region": "us-east-2",
  "description": "Holds PoliVue's API keys"
}
```

**2. Anthropic API.** The model must be a Claude model name starting with `claude-`:

```json
{
  "authToken": "AWS-PoliVue-Anthropic",
  "model": "claude-sonnet-4-5-20250929",
  "description": ""
}
```

**3. GitHub repository.** `username` is the repository's owner, `repoNm` its name, and `subdirectory` can stay empty. Write the description (up to 100 words) for Hadi: it uses descriptions to work out which repository a question means.

```json
{
  "authToken": "AWS-PoliVue-GitHub",
  "username": "your-github-username",
  "repoNm": "your-repository",
  "branch": "main",
  "subdirectory": "",
  "description": "Infrastructure code and runbooks for the payments service."
}
```

To change a connector later, click it in the table, edit the box, and save.

## Using PoliVue

The sidebar holds the pages you'll use day to day: Create Policy, Connections, Query and Documents.

### Upload a policy (Create Policy)

1. Click Attach File and choose a PDF, Markdown (`.md`) or text (`.txt`) file of up to 10 MB. A PDF opens in a preview window.
2. Click Upload. The file goes straight to your bucket and appears in the policy table and on the Documents page.

Avoid naming a file `config.json`, which is reserved for connectors.

### Ask Hadi (Query)

The line at the top shows which model Hadi is using, with a link to change it on the Connections page. If the page shows "Please connect to Anthropic API to proceed." or "Please connect to AWS Secrets Manager to proceed.", follow its button and finish the connector setup.

1. Type a question in the chat box and press Enter.
2. **To ask about your own documents,** click the document icon beside the box, then Select each PDF, Markdown or text file you want, then close the list. The count beside the icon shows how many are attached. Hadi reads the attached files with your question, for example "Summarize the access-control rules in these policies."
3. **To pull in GitHub files,** name the file and the project in your question, for example "Review `src/auth.js` in the payments repository." Hadi uses connector descriptions to match the project and fetches the file before answering. This only happens when documents are attached.
4. Hadi's answer appears formatted (headings, lists, tables).

**Copy an answer:** click anywhere on Hadi's answer to copy it to your clipboard as Markdown. Nothing on screen confirms the copy, so paste it to check.

**When Hadi can't answer:** the box shows "Hadi is confused." Click Retry? to resend the same question, or type a new one and press Enter.

**Save an answer as a policy:** after a successful answer, click Upload Policy?. PoliVue saves the answer to your bucket as `hadi-report-<number>.md` and shows a link to open it. If the upload fails, you can retry up to 3 times. After the third failure, PoliVue copies the answer to your clipboard and reloads the page after 5 seconds, so the text isn't lost.

### Browse documents (Documents)

The table lists every PDF, Markdown and text file in the bucket, with columns for Name, Created, Modified and Status, plus View and Edit buttons (Edit appears for Markdown only). Click a column header to sort. Status tags are pale green for resolved, pale red for unresolved, and pale orange for remediating. A document with no status counts as unresolved.

### Read, mark and download a document (View)

- Markdown appears formatted, and PDF and text files open in an embedded viewer.
- Beside the file name: "This document has been marked as \[status\]." To change it, click Edit Status, pick from the dropdown, and click Save (or Cancel).
- **Download** saves the file as it is stored, and also shows a download link you can click again.
- **Download PDF** (Markdown and text only) converts the file on the server and downloads it. The link is kept, so clicking again during the same visit doesn't convert it twice.
- A floating Edit button stays in the corner for Markdown files as you scroll. Back returns to Documents.

### Edit a Markdown document (Edit)

Open Edit from Documents or the view page. Type on the left and the formatted preview updates on the right. Click Save to write the changes to the bucket (up to 1 MB). The document keeps its status. If you leave with unsaved changes, the page shows "You have unsaved changes." and the browser asks before closing. View opens the saved document.

## Troubleshooting

Most problems show up in the server window's log. Check it first.

| What you see | Likely cause | Fix |
| --- | --- | --- |
| `Could not resolve entry module "index.html"` during build | `client/index.html` is missing | Restore it from the project copy |
| `Cannot find module '…'` or Rollup can't resolve a package | Packages not installed | Run `npm install` in that folder (`client` or `server`) |
| Log: `Could not retrieve the secret … AccessDeniedException` | The IAM user lacks `secretsmanager:GetSecretValue`, or the policy is on a different user | Attach the policy from AWS setup step 3 to the user whose key is in the AWS connector |
| Log: `Could not retrieve the secret … ResourceNotFoundException` | Wrong secret name, or the secret is in another region or account | Compare the secret's ARN with the AWS connector's `region` and the name after `AWS-` |
| Log: `Cannot find module '@aws-sdk/client-secrets-manager'` | Server packages are out of date | Run `npm install` in `server` |
| Document list or uploads fail, or `PermanentRedirect` errors | `AWS_REGION` in `server/.env` doesn't match the bucket | Set it to the bucket's region and restart |
| Uploads fail in the browser with a CORS error | Bucket CORS not set | Add the CORS rule from AWS setup step 2 |
| Every status shows as "unknown" | Missing tagging permissions | Add `s3:GetObjectTagging` and `s3:PutObjectTagging` for the bucket |
| "Hadi is confused." on long questions | The plain chat gives up after 10 seconds | Ask a shorter question, or attach a document, which allows up to 2 minutes |
| A GitHub token works without AWS | The key fell back to `GITHUB_TOKEN` in `server/.env` | Look for `Retrieved the secret …` in the log to confirm AWS was used |
| Download PDF fails on Linux or Docker | Chrome can't start its sandbox | Set `PUPPETEER_NO_SANDBOX=true` in `server/.env` |

## Known limitations and security concerns

PoliVue is built for running on your own machine. Don't expose it to the internet until the first three security items are fixed.

**Security**

| Concern | Risk | Status |
| --- | --- | --- |
| No login on any page or server route | Anyone who can reach the server can read and change documents and connectors | Open |
| `config.json` in the bucket holds connector settings in plain text, including the AWS secret access key and any key not written as `AWS-` | Anyone with read access to the bucket sees them | Open; a plan exists to move connectors into Secrets Manager |
| GitHub file paths from Hadi aren't checked | A crafted question can reach other repositories that the GitHub token can read | Open |
| Keys shown to the browser | They were visible on the Connections page | Fixed: keys show as `***` |
| Anthropic key in error logs | It was printed in the plain chat's error output | Fixed |
| `.env` files in git | They could be committed | Fixed: listed in `.gitignore` |
| A GitHub token once sat in a code comment | It may have been exposed | Comment removed; revoke the token on GitHub if it was ever valid |

**Behaviour to know**

- **Fallback keys:** when an `AWS-` key can't be fetched, the server quietly uses `ANTHROPIC_API_KEY` or `GITHUB_TOKEN` from `server/.env`. That can hide an AWS problem, so check the log for `Retrieved the secret …`. The one exception: if the Anthropic key starts with `AWS-` and there is no AWS connector, Hadi refuses instead.
- **One region for secrets:** there is a single AWS connector, so every `AWS-` secret must be in its region.
- **Status on edits:** if a file's tags can't be read when you save an edit, the save still happens but the status resets to unresolved.
- **Dates:** S3 records only the last-modified time, so Created and Modified always match on the Documents page.
- **Speed:** the Documents page reads each file's status separately, 10 at a time, so it slows as the bucket grows.
- **Plain chat timeout:** questions without attached documents give up after 10 seconds.

**Known bugs and unfinished pages**

- If Hadi names a GitHub connection that doesn't exist, the analysis request fails with a server error.
- A GitHub path that points to a folder, a missing file or a very large file adds the word "null" to what Hadi reads.
- On Create Policy, the loading bar can stay on screen after a failed upload. Reload the page.
- Copying an answer gives no on-screen confirmation.
- Dashboard and Manage Policies are placeholders. The sidebar's Create Connections link leads to a page that isn't connected yet. Use Connections instead.
- `npm run dev` doesn't reach the server's routes. Use the build-and-serve steps.
