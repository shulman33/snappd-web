---
description: Create GitHub PR to develop branch with auto-generated title, description, and labels
argument-hint: "[optional: custom PR title]"
allowed-tools:
  - bash
---

You are helping with GitHub PR creation using the GitHub CLI (gh). You will analyze recent commits and changes to create a well-structured pull request to the develop branch with appropriate labels.

Arguments provided: $ARGUMENTS

Please follow this workflow:

1. **Prerequisites Check**
   - Verify we're in a git repository
   - Check if GitHub CLI (gh) is installed and authenticated (`gh auth status`)
   - Ensure we're not on the develop branch (can't create PR from develop to develop)
   - Check if there are commits ahead of develop branch

2. **Analyze Recent Changes and Commits**
   - Get current branch name
   - Get commits that are ahead of develop: `git log develop..HEAD --oneline`
   - Analyze the commit messages to understand the scope of changes
   - Run `git diff develop..HEAD --name-only` to see changed files
   - Run `git diff develop..HEAD --stat` to see change statistics

3. **Generate PR Information**
   - **Title**: If $ARGUMENTS provided, use it. Otherwise generate based on:
     - Single commit: Use the commit message (cleaned up)
     - Multiple commits: Create summary like "Feature: Add user authentication" or "Fix: Resolve API issues"
     - Follow conventional commit format when possible
   
   - **Description**: Auto-generate based on:
     - List of commits with bullet points
     - Summary of files changed
     - Brief description of the overall change
     - Use markdown formatting for better readability

   - **Labels**: Automatically determine based on analysis:
     - `feature` - for new functionality (feat commits, new files)
     - `bugfix` - for bug fixes (fix commits, error handling changes)
     - `documentation` - for docs changes (README, comments, .md files)
     - `refactor` - for code refactoring (refactor commits, code restructuring)
     - `testing` - for test-related changes (test files, spec files)
     - `chore` - for maintenance tasks (build files, dependencies)
     - `style` - for styling/formatting changes
     - `performance` - for performance improvements
     - `breaking-change` - if BREAKING CHANGE detected in commits
     - `dependencies` - for package.json, requirements.txt, etc. changes

4. **Create Pull Request**
   - Show the generated PR title, description, and labels for review
   - Ask for confirmation before creating
   - Use gh CLI to create PR: `gh pr create --base develop --title "..." --body "..." --label "..."`
   - Display the created PR URL

5. **PR Description Template**
   ```markdown
   ## Summary
   [Brief description of changes]

   ## Changes Made
   - [Bullet point list of commits]

   ## Files Changed
   - [List of modified files with brief description]

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   - [ ] Code refactor
   - [ ] Performance improvement
   - [ ] Other: ___

   ## Testing
   - [ ] Tests pass locally
   - [ ] New tests added (if applicable)
   ```

6. **Label Selection Logic**
   - Check commit messages for conventional commit types
   - Analyze file extensions and paths (.test., .spec., docs/, README, etc.)
   - Look for keywords in commit messages (fix, add, update, remove, etc.)
   - Check for dependency files (package.json, requirements.txt, Gemfile, etc.)
   - Detect breaking changes in commit messages or large refactors

7. **Error Handling**
   - Handle cases where gh CLI is not authenticated
   - Handle cases where develop branch doesn't exist
   - Handle cases where there are no commits to create PR from
   - Handle cases where PR already exists for this branch
   - Provide clear error messages and suggested solutions

8. **Additional Features**
   - Check if there are any merge conflicts with develop
   - Suggest reviewers based on git blame of changed files (optional)
   - Add milestone if conventional patterns detected
   - Set draft status for WIP branches or incomplete features

Always provide clear feedback about what PR is being created and why specific labels were chosen based on the analysis of changes.