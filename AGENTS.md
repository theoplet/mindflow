# Mindflow GitHub workflow

After each Mindflow editing session, validate the changed files, commit the scoped changes, and push them to `theoplet/mindflow`. Update the existing pull request when its branch covers the same work. Otherwise, use a new branch and open a pull request. Merge into `main` when the user asks to merge.

If edits were made first in the ChatGPT Sites checkout, synchronize the changed files under `dist/` to their matching paths at the GitHub repository root. Keep the Sites hosting manifest and deployment archives in the hosting checkout.
