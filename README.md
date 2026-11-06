# Word Quest — Bible Quiz Adventure

A mobile-friendly, static Bible quiz website designed for kids, teens and young adults. It runs directly in a browser and is ready for GitHub Pages—no build tools, database or API keys are required.

## Features

- **Three age tracks:** Little Lights (5–10), Faith Explorers (11–15), and Word Masters (16–20).
- **50 questions per quest:** ten progressive stages, five questions per stage, and no repeated questions within a single run.
- **60-second timer per question:** a question is marked when time expires.
- **Marks and ranks:** a final score out of 50, accuracy, XP, a rank title and local Hall of Fame position.
- **Streak rewards:** consecutive correct answers earn extra points; the best streak is recorded.
- **50:50 lifeline:** one use per quest removes two incorrect options.
- **Learn after each answer:** the correct answer, explanation and Bible reference appear before the Next Question button.
- **Bible-book insights:** see stronger areas and books to revisit, plus ongoing stats from finished quizzes.
- **Achievements:** badges for milestones such as a perfect quest, a 10-answer streak and exploring many Bible books.
- **Review and share:** review all 50 answers at the end and share/copy the result summary.
- **Responsive design:** desktop, tablet and mobile layouts, reduced-motion support and keyboard-friendly controls.

## Run it locally

Open `index.html` in a modern browser. For the best local testing experience, serve this folder with a simple HTTP server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish to GitHub Pages

The included workflow at `.github/workflows/pages.yml` deploys the static site whenever new commits are pushed to `main`.

1. Upload/commit all files and folders in this project to the root of `IPACHURCHELAPPARA/Bible-Quiz-Kids` on the `main` branch. Include the hidden `.github` folder and `.nojekyll` file.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source if it is not already selected.
3. Open the **Actions** tab and wait for the “Deploy Word Quest to GitHub Pages” workflow to finish successfully. The workflow summary will show the published URL. GitHub Pages may take a short time to make a first deployment available.

## Important note about rankings and saved progress

This is a front-end website, so names, finished attempts, badges and Bible-book statistics are saved in **local storage in the current browser on the current device**. The Hall of Fame is personal to that browser; it is not a shared online leaderboard across all church members or devices. Clearing browser data can erase saved progress. A shared church-wide leaderboard would require a backend/database with suitable privacy and access controls.

## Project files

- `index.html` — page layout and application views
- `styles.css` — full responsive visual design
- `app.js` — timer, scoring, game flow, ranks, badges and local storage
- `questions.js` — age-tiered Bible quiz question banks and explanations
- `.github/workflows/pages.yml` — automatic GitHub Pages deployment

## Editing the question banks

Each item in `questions.js` has this format:

```js
[question, "Option A|Option B|Option C|Option D", correctOptionIndex, "Book", "Chapter:verse", "Explanation"]
```

The correct option index is zero-based. Add new questions at the appropriate difficulty stage and keep at least five entries in each of the ten stage groups for each age track so that every quiz can contain 50 distinct questions.
