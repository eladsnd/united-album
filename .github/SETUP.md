# GitHub Actions CI/CD Setup

This guide shows you how to configure GitHub Secrets for automated deployment to Vercel.

## Required GitHub Secrets

Go to **Repository Settings → Secrets and variables → Actions** and add these secrets:

### 1. Vercel Secrets

#### `VERCEL_TOKEN` (REQUIRED)

**How to get it**:
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "GitHub Actions Deploy Token"
4. Scope: Full Account
5. Expiration: No expiration (or set your preference)
6. Copy the token (you won't see it again!)
7. Add to GitHub Secrets as `VERCEL_TOKEN`

#### `VERCEL_ORG_ID` (REQUIRED)

**How to get it**:
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (from project root)
vercel link

# The command will create .vercel/project.json with:
# {
#   "orgId": "team_xxxxx",  ← Copy this value
#   "projectId": "prj_xxxxx"
# }
```

**Or find it manually**:
1. Go to https://vercel.com/dashboard
2. Click on your team/account name in the top-left
3. Go to Settings
4. Copy the "Team ID" (this is your `orgId`)

Add to GitHub Secrets as `VERCEL_ORG_ID`

#### `VERCEL_PROJECT_ID` (REQUIRED)

From the same `.vercel/project.json` file created above, copy the `projectId` value.

**Or find it manually**:
1. Go to your project in Vercel Dashboard
2. Go to Settings
3. Scroll to "Project ID"
4. Copy the value

Add to GitHub Secrets as `VERCEL_PROJECT_ID`

### 2. Database Secret

#### `DATABASE_URL` (REQUIRED for production migrations)

**How to get it**:
1. Go to Vercel Dashboard → Your Project
2. Go to **Storage** tab
3. Click on your Postgres database
4. Go to **Settings** tab
5. Find "Connection String" section
6. Copy the `POSTGRES_URL` value
7. Add to GitHub Secrets as `DATABASE_URL`

**Format**:
```
postgres://username:password@host.postgres.vercel-storage.com:5432/dbname?sslmode=require
```

### 3. Google Drive Credentials (OPTIONAL - for build checks)

These are only needed if you want to test builds in CI with actual Google Drive integration:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`

**Note**: The deployment workflow doesn't need these because they're already configured in Vercel's environment variables.

## Workflow Files

### `deploy.yml` - Main Deployment Workflow

**Triggers**:
- Push to `main` branch → Production deployment
- Push to `feature/*` branches → Preview deployment (if configured)
- Pull requests to `main` → Preview deployment with comment

**Jobs**:
1. **test**: Run Jest tests with coverage
2. **deploy-preview**: Deploy PR preview (for pull requests)
3. **deploy-production**: Deploy to production + run migrations (for main branch)
4. **notify-failure**: Create GitHub issue if deployment fails

**Features**:
- ✅ Automatic database migrations on production deploy
- ✅ Preview deployments for PRs with comment
- ✅ Test results uploaded as artifacts
- ✅ Deployment summary in GitHub Actions UI
- ✅ Failure notifications via GitHub issues

### `test.yml` - Continuous Testing

**Triggers**:
- Push to any branch
- Pull requests to `main` or `develop`

**Jobs**:
1. **test**: Run tests on Node 18 and Node 20 (matrix)
   - Lint code
   - Run unit tests with coverage
   - Upload coverage to Codecov
   - Check build compiles
2. **test-summary**: Aggregate test results

## Setup Checklist

### Step 1: Get Vercel Credentials

- [ ] Create Vercel account and project
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Run `vercel link` to create `.vercel/project.json`
- [ ] Copy `orgId` from `.vercel/project.json`
- [ ] Copy `projectId` from `.vercel/project.json`
- [ ] Create Vercel API token at https://vercel.com/account/tokens

### Step 2: Add GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

- [ ] Add `VERCEL_TOKEN`
- [ ] Add `VERCEL_ORG_ID`
- [ ] Add `VERCEL_PROJECT_ID`
- [ ] Add `DATABASE_URL` (after creating Vercel Postgres)

### Step 3: Configure Vercel Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

- [ ] Add `GOOGLE_CLIENT_ID`
- [ ] Add `GOOGLE_CLIENT_SECRET`
- [ ] Add `GOOGLE_REFRESH_TOKEN`
- [ ] Add `GOOGLE_DRIVE_FOLDER_ID`
- [ ] Add `ADMIN_PASSWORD`
- [ ] `DATABASE_URL` (auto-added by Vercel Postgres)

### Step 4: Test the Workflow

1. Push to a feature branch:
   ```bash
   git checkout -b test-ci-cd
   git push origin test-ci-cd
   ```

2. Check GitHub Actions tab:
   - Test workflow should run
   - All tests should pass

3. Create a Pull Request:
   - Preview deployment should be created
   - Comment with preview URL should appear

4. Merge to main:
   - Production deployment should trigger
   - Database migrations should run
   - Deployment URL should be added as commit comment

## Troubleshooting

### Issue 1: "VERCEL_TOKEN not found"

**Solution**: Make sure you added `VERCEL_TOKEN` to GitHub Secrets (Repository Settings → Secrets → Actions).

### Issue 2: "Project not found" or "Invalid orgId/projectId"

**Solution**:
1. Run `vercel link` locally to create `.vercel/project.json`
2. Copy the exact `orgId` and `projectId` values
3. Update GitHub Secrets with these values

### Issue 3: Database migrations fail

**Solution**:
1. Verify `DATABASE_URL` secret is set in GitHub
2. Ensure the format is: `postgres://user:pass@host:5432/db?sslmode=require`
3. Check Vercel Postgres is enabled in your project
4. Verify migrations exist in `prisma/migrations/` directory

### Issue 4: Build fails with "Environment variable not found"

**Solution**:
1. Check that all required env vars are in Vercel Dashboard
2. For Vercel environment variables, the workflow automatically pulls them with `vercel pull`
3. For build-time checks, add the env vars to GitHub Secrets (optional)

### Issue 5: Preview deployment doesn't comment on PR

**Solution**:
1. Ensure GitHub Actions has write permissions:
   - Go to Repository Settings → Actions → General
   - Under "Workflow permissions", select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"

## Workflow Behavior

### On Push to `main`:
1. ✅ Run tests
2. ✅ Build project
3. ✅ Run database migrations
4. ✅ Deploy to production
5. ✅ Add deployment comment to commit

### On Pull Request:
1. ✅ Run tests
2. ✅ Build project
3. ✅ Deploy preview
4. ✅ Comment preview URL on PR

### On Push to Feature Branch:
1. ✅ Run tests
2. ✅ Check build compiles

## Customization

### Change Node.js Version

Edit `.github/workflows/test.yml`:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 21]  # Add more versions
```

### Add More Test Environments

Edit `.github/workflows/test.yml`:

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest, macos-latest]
```

### Disable Preview Deployments

Edit `.github/workflows/deploy.yml`:

```yaml
# Comment out or remove the entire deploy-preview job
```

### Add Slack Notifications

Add a new step to `deploy-production` job:

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚀 Production deployed: ${{ steps.deploy.outputs.url }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Security Best Practices

✅ **Never commit secrets to git**
- All credentials in GitHub Secrets
- All sensitive env vars in Vercel Dashboard
- `.env.local` in `.gitignore`

✅ **Use least-privilege tokens**
- Vercel token scoped to specific project
- GitHub Actions permissions set to minimum required

✅ **Rotate credentials regularly**
- Change `VERCEL_TOKEN` every 90 days
- Update Google OAuth tokens when needed

✅ **Review workflow runs**
- Check Actions tab for suspicious activity
- Audit deployed changes in Vercel Dashboard

## Cost Considerations

**GitHub Actions** (Free Tier):
- 2,000 minutes/month for private repos
- Unlimited for public repos
- Each workflow run: ~2-5 minutes
- Estimated usage: 50-100 minutes/month (10-20 deploys)

**Vercel** (Free Tier):
- Unlimited deployments
- 100 GB bandwidth/month
- 6,000 build minutes/month

**Total Cost**: $0 for typical wedding album usage

## Support

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Vercel CLI Docs**: https://vercel.com/docs/cli
- **Vercel GitHub Integration**: https://vercel.com/docs/deployments/git/vercel-for-github

---

🤖 **CI/CD Setup Complete!** Push to `main` to trigger your first automated deployment.
