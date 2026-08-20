# Vision Craft

Create a production-ready full-stack desktop-first web app called AI Video Editor. Build the base application, not a landing page or static prototype. The app should start directly on a Projects dashboard and be structured for long-video AI editing workflows. Use a modern dark UI with a professional creative-tool feel, spacious layout, strong typography, subtle microinteractions, and clean shadcn/ui components. Avoid generic corporate dashboard styling, excessive gradients, neon colors, or clutter.

Core product goal: users upload a long video/live recording and choose one or more outputs: (1) short clips, (2) highlights video around 10–15 minutes or custom duration, and (3) a long edited version that removes low-value sections while preserving context. The architecture must be prepared for real async processing later, including jobs, queue, status, progress, cancellation, errors, and future integration with video analysis, transcription, silence detection, visual analysis, and rendering. Do not fake AI processing as if it were real; if demo/mock data is used, it must be clearly isolated from production logic.

Build these main areas and routes/pages: Projects dashboard, New Project upload flow, Edit Configuration, Processing page, Project detail page, Results page, and a reusable timeline/segment review area. The app should support a sidebar navigation and top bar, with clear empty/loading/error states.

Projects dashboard: show a New Project button, recent projects, project name, source file name, duration, date, processing type, status badge, and thumbnail when available. Include statuses Draft, Ready to process, Queued, Processing, Analyzing, Generating clips, Rendering, Completed, Error.

New Project: large drag-and-drop upload zone with select file button, file preview, project name, source file details, ability to replace/remove the selected video before continuing.

Edit Configuration: allow selecting one or more output goals with large cards. Goal 1: Short clips. Goal 2: Highlights video with preset durations 10 min, 15 min, or custom. Goal 3: Long edited video with intensity options Conservative, Balanced, Aggressive. Show a summary when multiple goals are selected.

Processing page: dedicated detailed progress view, not a spinner. Show overall percent, current step, elapsed time, only show ETA when real data exists, cancel processing button, and continue-using-app feeling. Design for async jobs and updateable status. Include step list such as video prepared, audio extracted, transcribing speech, analyzing moments, creating timeline, generating videos, finalizing.

Results page: tabs for Clips, Highlights, and Edited Long Video. For clips, show thumbnail, title, duration, source start time, category, relevance/confidence, preview, keep, delete, and future export actions. For highlights, show final duration, segments used, preview, reorder future capability, add/remove segments future capability, export future capability. For long edited video, show original duration, final duration, removed time, cuts count, and approximate removal percent plus a timeline visualization of kept and cut regions.

Project detail page: top bar with project name, status, actions; main preview area; metadata; right-side configuration and stats panel; and a segment timeline. Use a conceptual segment model with start, end, duration, decision, score, reason, category, and related result. Make it ready for manual review and future AI explanations.

Data model and architecture: create typed models and reusable components. Include Project, ProcessingJob, EditConfiguration, VideoSegment, ShortClip, GeneratedVideo. Create a separate service layer for future backend integration, e.g. videoProcessingService with methods like createProject, uploadVideo, createProcessingJob, getJobStatus, cancelJob, getProjectAnalysis, getGeneratedClips, getHighlightsVideo, getEditedLongVideo, exportResult. Keep UI separate from processing logic. Prepare persistence for projects, configs, jobs, segments, and results; store large videos externally and keep references in DB. Use a database-backed architecture ready for Supabase/PostgreSQL if needed.

Implement the initial MVP with real functionality for: create project, list projects, open project, delete project; video selection and validation; configuration selection; job creation/status; processing page; results page skeleton; timeline structure; persistent project records; and a codebase organized into reusable components and clear folders. No login, subscriptions, or payments in this first version. Desktop-first responsive behavior for 1440px and 1920px, but still usable on smaller screens.

Important: start the app in the projects area. Provide realistic empty states and loading states. If you use mock/demo results for the first build, clearly separate them from the real processing layer so they can be swapped later without refactoring the UI.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7bb8cffc-14e9-47fb-b4d2-507bced08ded).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
