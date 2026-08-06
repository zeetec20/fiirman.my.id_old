---
title: Enforcing Branch Protection Without Upgrading Your GitHub Plan
description: >-
  I think every team project should have a rule that prevents developers from
  pushing code directly to the master or main branch. Directly pushing to these
  branches can be risky because it may accidenta
thumbnail: >-
  /article/enforcing-branch-protection-without-upgrading-your-github-plan/thumbnail.jpg
createdAt: 17-06-2026
writer: zeetec20
tag:
  - automated
  - software-engineering
  - security
  - git
  - teamwork
source: medium
sourceUrl: >-
  https://firmanlestari.medium.com/enforcing-branch-protection-without-upgrading-your-github-plan-be252860bd6d?source=rss-de2e53234d37------2
---
I think every team project should have a rule that prevents developers from pushing code directly to the master or main branch. Directly pushing to these branches can be risky because it may accidentally overwrite someone else’s work and introduce issues into the codebase.

It also bypasses many important parts of the development workflow. Without creating a Pull Request (PR), there is no opportunity for code review, automated testing, linting, or other quality checks that may be configured in the project. As a result, bugs or code quality issues can reach the main branch more easily.

In addition, when changes are made directly to the master or main branch, other team members cannot properly review the code or provide feedback before it is merged. This makes collaboration more difficult and increases the chance of mistakes going unnoticed.

GitHub already provides branch protection features for this purpose. Unfortunately, for private repositories, these features are not available on the free plan. They are available for public repositories, but most of my projects use private repositories.

Since I wanted to stay on the free plan, I looked for an alternative way to protect important branches. My solution was to use **Husky**. Husky is a package that allows you to create Git hooks and automate tasks in your Git workflow. With it, you can make your workflow more structured and enforce rules that help your team follow best practices.

For the branch protection case discussed in this article, we can use Git hooks on both **commit** and **push** actions.

### 1\. Setup and Install Husky

The installation depends on the package manager you use. In this example, I am using Bun:

```bash
bun add -d husky
bunx husky init
```

### 2\. Update the Pre-Commit Hook

Add the following script to your pre-commit file:

```bash
protected="master"
branch="$(git symbolic-ref --short HEAD 2>/dev/null)"

if [ "$branch" = "$protected" ]; then
  echo "✖ Direct commits to 'master' are blocked. Create a feature branch."
  exit 1
fi
```

This hook prevents repository members from creating commits directly on the protected branch. If someone tries to commit to the master or main branch, they will see the following message:

```text
✖ Direct commits to 'master' are blocked. Create a feature branch.
```

### 3\. Update the Pre-Push Hook

Add the following script to your pre-push file:

```bash
protected="master"
zero="0000000000000000000000000000000000000000"

while read -r local_ref local_sha remote_ref remote_sha; do
  case "$remote_ref" in
    refs/heads/"$protected")
      if [ "$local_sha" = "$zero" ]; then
        echo "✖ Deleting remote '$protected' is blocked."
        exit 1
      fi

      if [ "$remote_sha" != "$zero" ]; then
        if ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
          echo "✖ Force push to '$protected' is blocked."
          exit 1
        fi
      fi

      echo "✖ Pushing to '$protected' is blocked. Open a PR from a feature branch."
      exit 1
      ;;
  esac
done
```

This hook prevents repository members from pushing changes directly to the protected branch. It also blocks force pushes and branch deletion attempts.

The following messages will be shown depending on the action:

✖ Pushing to '$protected' is blocked. Open a PR from a feature branch.

-   When someone tries to push directly to the protected branch.

✖ Force push to '$protected' is blocked.

-   When someone tries to force push to the protected branch.

✖ Deleting remote '$protected' is blocked.

-   When someone tries to delete the protected branch from the remote repository.

### Limitations

Using Husky allows us to effectively protect the master or main branch in local development. However, since this solution only runs on the developer's machine, it can still be bypassed.

For example, Git hooks can be skipped using the --no-verify flag:

```bash
git commit --no-verify -m "your message"
git push --no-verify
```

Because of this limitation, Husky should be considered an additional layer of protection rather than a complete replacement for GitHub’s server-side branch protection rules.
