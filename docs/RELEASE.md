# Release Process

This project uses [Release Please](https://github.com/googleapis/release-please-action) for automated releases.

## Quick Start

**Commit format:** `<type>: <description>`

* `fix:` which represents bug fixes, and correlates to a [SemVer](https://semver.org/) patch.
* `feat:` which represents a new feature, and correlates to a SemVer minor.
* `feat!:`, or `fix!:`, `refactor!:`, etc., which represent a breaking change (indicated by the `!`) and will result in a SemVer major.

**Workflow:**

1. Commit to main with conventional commits
2. Release Please creates a Release PR
3. Merge the Release PR
4. Automatic deployment to Lambda

## Token Setup

Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with:

- **Contents**: Read and write
- **Pull requests**: Read and write
- **Workflows**: Read and write

Add as secret: `MY_RELEASE_PLEASE_TOKEN`

## Common Issues

- **"Error adding to tree"** → Token missing `Contents: Write` permission
- **"commit could not be parsed"** → Use format: `type: description` (with colon!)
- **No Release PR** → Need at least one `feat:` or `fix:` commit
