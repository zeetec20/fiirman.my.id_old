---
title: 'I Love Lazygit, But it’s Missing One Thing'
description: >-
  I don’t remember how long I’ve been using Lazygit, but it’s definitely been
  more than a year. One of the first things I set up whenever I install Lazygit
  is the diff section.The default diff view is a
thumbnail: /article/i-love-lazygit-but-its-missing-one-thing/thumbnail.jpg
createdAt: 01-10-2026
writer: zeetec20
tag:
  - software-engineering
  - experience
  - lazygit
  - git
  - terminal
source: medium
sourceUrl: >-
  https://firmanlestari.medium.com/i-love-lazygit-but-its-missing-one-thing-ffc74324ee3d?source=rss-de2e53234d37------2
---
I don’t remember how long I’ve been using Lazygit, but it’s definitely been more than a year. One of the first things I set up whenever I install Lazygit is the diff section.

The default diff view is already useful. It lets you preview changes directly inside Lazygit, but I still find it a little hard to read, especially when there are a lot of changes. So I modified it to use git-split-diffs instead.

### **git-split-diffs**

Before changing the Lazygit configuration, you need to install the third-party CLI that will render the diff.

git-split-diffs makes the output look more like the diff view you see on GitHub, so it’s easier to follow changes. You can use it inside Lazygit or directly with git diff.

### Install

It’s pretty simple. Install it with npm, or use your favorite package manager. In my case, I use Homebrew.

```bash
npm install -g git-split-diffs
```

Then you can either add it to your Git config or try it manually first:

```bash
# Configure Git
git config --global core.pager "git-split-diffs --color | less -RFX"

# Run manually
git diff | git-split-diffs --color | less -RFX
```

### Setup Lazygit

Once git-split-diffs is installed, we can configure Lazygit.  
First, check where Lazygit stores its configuration:

```text
lazygit --print-config-dir
```

This will show the configuration directory. Inside it, you’ll find config.yml. That’s the file we need to modify. If you already have other settings in the file, find the git section and add this:

```text
git:
  pagers:
    - colorArg: always
      pager: git-split-diffs --color
```

Save the file and open Lazygit again. You should see a difference like in the image below, with a cleaner and more readable diff section.

![](/article/i-love-lazygit-but-its-missing-one-thing/img-1.png)

Now the diff section should use git-split-diffs instead of the default diff view. This small change has made Lazygit much easier for me to use because I can read changes in a format that’s closer to the GitHub diff UI.

If you spend a lot of time reviewing diffs inside Lazygit, this is one of the first customizations I’d recommend trying.
