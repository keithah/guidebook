# GitHub Pages HERE Secret Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supply the existing local HERE browser key to the production GitHub Pages build through a GitHub Actions repository secret and verify the deployed bundle receives it.

**Architecture:** GitHub stores `VITE_HERE_API_KEY` as an encrypted repository secret populated from the ignored local `app/.env`. The Pages workflow exposes that secret only to its Vite build step, which already reads the same environment name in HERE Search and Transit. A focused pull request delivers the workflow change and its merge triggers the production deployment.

**Tech Stack:** GitHub Actions, GitHub CLI, Vite, GitHub Pages, Bash.

## Global Constraints

- Never print, interpolate into command output, commit, or include the HERE key in tests.
- Read the key only from the ignored local `app/.env` entry named `VITE_HERE_API_KEY`.
- Store it as a repository Actions secret named `VITE_HERE_API_KEY` in `keithah/guidebook`.
- Expose it only to the existing Pages workflow build step.
- Verify secret metadata and deployed behavior without printing the value.
- Do not bypass branch protection or failing required checks.

---

### Task 1: Populate the repository secret safely

**Files:**
- Read only: `app/.env`
- Read only: `.gitignore`

**Interfaces:**
- Consumes: the non-empty `VITE_HERE_API_KEY` assignment in `app/.env`.
- Produces: GitHub repository secret `VITE_HERE_API_KEY` for `keithah/guidebook`.

- [ ] **Step 1: Verify the local source is safe and non-empty**

Run without displaying the value:

```bash
git check-ignore -q app/.env
! git ls-files --error-unmatch app/.env >/dev/null 2>&1
here_key_value_task=$(awk -F= '$1 == "VITE_HERE_API_KEY" { sub(/^[^=]*=/, ""); sub(/\r$/, ""); print; exit }' app/.env)
test -n "$here_key_value_task"
```

Expected: every command exits zero; `app/.env` is ignored and untracked and the variable is non-empty.

- [ ] **Step 2: Set the GitHub repository secret through standard input**

In the same shell process so the local variable remains available:

```bash
printf '%s' "$here_key_value_task" | gh secret set VITE_HERE_API_KEY --repo keithah/guidebook
```

Expected: GitHub confirms the secret was set without showing its value.

- [ ] **Step 3: Verify secret metadata only**

```bash
gh secret list --repo keithah/guidebook --json name,updatedAt \
  --jq '.[] | select(.name == "VITE_HERE_API_KEY") | .name'
```

Expected output: `VITE_HERE_API_KEY` and no secret value.

---

### Task 2: Inject the HERE secret into the Pages build

**Files:**
- Modify: `.github/workflows/deploy-guidebook.yml`

**Interfaces:**
- Consumes: GitHub secret `secrets.VITE_HERE_API_KEY`.
- Produces: build-step environment variable `VITE_HERE_API_KEY`, consumed by the existing `import.meta.env.VITE_HERE_API_KEY` calls.

- [ ] **Step 1: Verify RED against the current workflow**

```bash
rg -q 'VITE_HERE_API_KEY:.*secrets\.VITE_HERE_API_KEY' .github/workflows/deploy-guidebook.yml
```

Expected: exit 1 because the Pages build does not yet inject the HERE secret.

- [ ] **Step 2: Add the minimal workflow environment entry**

Change the existing build step environment to:

```yaml
env:
  VITE_HERE_API_KEY: ${{ secrets.VITE_HERE_API_KEY }}
  VITE_API_511_KEY: ${{ secrets.VITE_API_511_KEY }}
```

- [ ] **Step 3: Verify GREEN and repository safety**

```bash
rg -q 'VITE_HERE_API_KEY:.*secrets\.VITE_HERE_API_KEY' .github/workflows/deploy-guidebook.yml
git check-ignore -q app/.env
! git ls-files --error-unmatch app/.env >/dev/null 2>&1
git diff --check
```

Expected: every command exits zero and the diff contains only the secret reference, never the configured value.

- [ ] **Step 4: Run the application verification gate**

```bash
cd app
npm test
npm run build
```

Expected: the full test suite passes and the production PWA build completes.

- [ ] **Step 5: Commit the workflow change**

```bash
git add .github/workflows/deploy-guidebook.yml
git commit -m "fix: supply HERE key to Pages build"
```

---

### Task 3: Publish, merge, and verify the Pages deployment

**Files:**
- Remote update: GitHub pull request from `fix/deploy-here-secret` into `main`.
- Remote observation: Pages workflow and deployed bundle.

**Interfaces:**
- Consumes: the verified Task 2 commit and repository secret.
- Produces: a merged workflow change and successful GitHub Pages deployment containing the configured HERE browser key.

- [ ] **Step 1: Push and create the focused pull request**

```bash
git push -u origin fix/deploy-here-secret
gh pr create --base main --head fix/deploy-here-secret \
  --title "Fix HERE key injection for Pages" \
  --body "Adds the existing repository HERE secret to the Vite build environment and verifies the deployment path without exposing the key."
```

- [ ] **Step 2: Wait for required review/check state and merge normally**

Inspect the PR with `gh pr view --json reviewDecision,mergeable,mergeStateStatus,statusCheckRollup`. Merge with `gh pr merge --merge` only when GitHub reports it mergeable and no required check is pending or failing. Never use an administrative bypass.

- [ ] **Step 3: Identify and monitor the merge-triggered Pages run**

```bash
gh run list --workflow deploy-guidebook.yml --branch main --limit 5 \
  --json databaseId,headSha,status,conclusion,url
gh run watch <run-id> --exit-status
```

Expected: the run whose `headSha` equals the PR merge commit completes successfully, including both build and deploy jobs.

- [ ] **Step 4: Verify GitHub Pages and the deployed bundle without revealing the key**

```bash
gh api repos/keithah/guidebook/pages --jq '{html_url: .html_url}'
here_key_value_task=$(awk -F= '$1 == "VITE_HERE_API_KEY" { sub(/^[^=]*=/, ""); sub(/\r$/, ""); print; exit }' app/.env)
page_html_task=$(curl -fsS "https://keithah.github.io/guidebook/?verify=$(date +%s)")
asset_path_task=$(printf '%s' "$page_html_task" | rg -o 'assets/index-[^" ]+\.js' | head -1)
test -n "$asset_path_task"
curl -fsS "https://keithah.github.io/guidebook/$asset_path_task?verify=$(date +%s)" \
  | rg -F -q "$here_key_value_task"
```

Expected: Pages reports its URL, the current application asset resolves, and the non-printing comparison proves the deployed bundle contains the configured browser key.

- [ ] **Step 5: Confirm final state**

Confirm the pull request is merged, `origin/main` contains its head, the deployment run succeeded at the merge commit, the worktree is clean, and no key value appeared in output or tracked files.

