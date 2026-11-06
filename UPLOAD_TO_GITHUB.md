# Upload Word Quest to your GitHub repository

Target repository: https://github.com/IPACHURCHELAPPARA/Bible-Quiz-Kids

## Recommended method: GitHub Desktop

1. Download `Bible-Quiz-Kids.zip` and extract it.
2. Open GitHub Desktop and clone `IPACHURCHELAPPARA/Bible-Quiz-Kids` (use **File → Clone repository**; paste the repository URL if it is not listed).
3. Copy the *contents* of the extracted `bible-quiz-kids` folder into the cloned repository folder. Keep the folder structure, especially `.github/workflows/pages.yml`. In Windows File Explorer, enable **View → Show → Hidden items** if you cannot see `.github` or `.nojekyll`.
4. In GitHub Desktop, enter a summary such as `Add Word Quest Bible Quiz website`, click **Commit to main**, then click **Push origin**.
5. On GitHub, open **Settings → Pages** and choose **GitHub Actions** as the deployment source if it is not already selected.
6. Open **Actions** and check the “Deploy Word Quest to GitHub Pages” workflow. When it finishes successfully, the workflow summary provides the public site URL.

## What gets published

The root `index.html` is the website entry point. The CSS and JavaScript files sit beside it, and the included workflow deploys these static files whenever you push to `main`.

## Note on the leaderboard

Scores, ranks and book insights are stored in the visitor's browser. This first version does not send children's names or scores to a shared server, so each device has its own Hall of Fame.
