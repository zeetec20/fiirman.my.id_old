---
title: Get Notified When Claude Code Needs Your Attention
description: >-
  When working with Claude Code, it’s common to start a long prompt and then
  switch to another task. Maybe you’re reading documentation, replying to
  messages, working on another project, or simply waiti
thumbnail: /article/get-notified-when-claude-code-needs-your-attention/thumbnail.jpg
createdAt: 02-07-2026
writer: zeetec20
tag:
  - claude-code
  - notifications
  - ai
  - ai-tools
  - developer-tools
source: medium
sourceUrl: >-
  https://firmanlestari.medium.com/get-notified-when-claude-code-needs-your-attention-8b83f29b1689?source=rss-de2e53234d37------2
---
When working with Claude Code, it’s common to start a long prompt and then switch to another task. Maybe you’re reading documentation, replying to messages, working on another project, or simply waiting for Claude to finish. Sometimes you even end up doom scrolling and completely forget that Claude is still running in the background.

The problem is that there’s always a productivity gap. You have to keep switching back to your terminal just to check whether Claude has finished, is asking for permission, or needs additional input. Repeating this over and over feels unnecessary and interrupts your workflow.

That’s why I started looking for a notification solution instead of constantly checking the terminal manually, and fortunately I found an open-source Claude Code plugin that solves exactly this problem.

**Repository:**  
[https://github.com/777genius/claude-notifications-go](https://github.com/777genius/claude-notifications-go)

Instead of building a notification system from scratch, you can simply install this plugin and receive desktop notifications whenever Claude needs your attention.

The plugin can notify you when:

-   Claude has finished a task.
-   Claude is requesting permission.
-   Claude needs additional information.
-   Claude encounters an error.
-   Other important workflow events (Basically notifying you when Claude Code needs your attention)

One thing I really like is that the project is completely open source. If you discover a bug, encounter an issue on your device, or want additional functionality, you can contribute back to the project by fixing bugs or implementing new features.

The README is very comprehensive and walks you through everything, including installation, initialization, and configuration. You can simply follow the documentation to get everything running in just a few minutes. The repository also provides plenty of customization options, allowing you to configure notifications to match your workflow. You can check on [here](https://github.com/777genius/claude-notifications-go#configuration) for the documentation.

This plugins it’s support multiple operation system but here’s what the notification looks like on macOS:

![](/article/get-notified-when-claude-code-needs-your-attention/img-1.png)

The only downside is that this plugin is specifically built for Claude Code. It doesn’t currently support other AI coding tools such as Codex or OpenCode, so if you’re using those you’ll need to find an alternative notification solution.

Overall, if Claude Code is part of your daily development workflow, this plugin is a simple quality-of-life improvement that helps eliminate unnecessary context switching and lets you focus on your work instead of repeatedly checking whether Claude is waiting for you.
