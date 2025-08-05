# Manual GitHub Workflow Setup Required

Due to GitHub App permission constraints, the following workflow files must be
created manually:

## 1. Auto-Rebase Workflow

Create `.github/workflows/auto-rebase.yml`:

```yaml
name: auto-rebase

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

jobs:
  rebase:
    runs-on: ubuntu-latest
    permissions: write-all
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}
          persist-credentials: false
      - run: |
          git config --global rerere.enabled true
          git config --global rerere.autoupdate true
          git fetch origin ${{ github.base_ref }}
          git rebase origin/${{ github.base_ref }} || echo "::error::Manual merge required"
      - if: success()
        run: git push origin HEAD:${{ github.head_ref }}
```

## 2. Rerere Audit Workflow

Create `.github/workflows/rerere-audit.yml`:

```yaml
name: rerere-audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  audit-rerere:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure Git rerere
        run: |
          git config rerere.enabled true
          git config rerere.autoupdate true

      - name: Generate rerere audit
        run: |
          echo "# Rerere Audit Report" > rerere-audit.md
          echo "Generated on: $(date)" >> rerere-audit.md
          echo "" >> rerere-audit.md

          if git rerere diff > /dev/null 2>&1; then
            echo "## Recorded Conflict Resolutions" >> rerere-audit.md
            git rerere diff >> rerere-audit.md
          else
            echo "## No recorded conflict resolutions found" >> rerere-audit.md
          fi

          echo "" >> rerere-audit.md
          echo "## Rerere Status" >> rerere-audit.md
          git rerere status >> rerere-audit.md || echo "No pending rerere operations" >> rerere-audit.md

      - name: Upload rerere audit
        uses: actions/upload-artifact@v4
        with:
          name: rerere-audit-${{ github.sha }}
          path: rerere-audit.md
```

## 3. Setup Instructions

1. Create the `.github/workflows/` directory if it doesn't exist
2. Add both workflow files with the exact content above
3. Commit and push the workflows
4. The auto-merge system will then be fully functional

## Note

All other components (rerere config, merge drivers, hooks, Mergify) are already
configured and working. Only the GitHub Actions workflows require manual
creation due to permission constraints.
