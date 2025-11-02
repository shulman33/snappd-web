---
description: Analyze changes, generate commit message, and push to repository
argument-hint: "[optional: custom commit message]"
allowed-tools:
  - bash
---

You are helping with intelligent git operations. You will analyze the changes made, automatically generate an appropriate commit message following conventional commit standards, and push to the remote repository.

Arguments provided: $ARGUMENTS

Please follow this workflow:

1. **Check git repository status**
   - Verify we're in a git repository
   - Show current branch
   - Display git status to see what changes exist

2. **Analyze changes to generate commit message**
   - If $ARGUMENTS contains a custom commit message, use it
   - If $ARGUMENTS is empty, analyze the changes automatically:
     - Run `git diff --cached --name-only` and `git diff --name-only` to see changed files
     - Run `git diff --cached` and `git diff` to see the actual changes
     - Analyze the code changes to understand what was modified, added, or removed
     - Generate a conventional commit message in the format: `type(scope): description`
     - Use appropriate types: feat, fix, docs, style, refactor, test, chore, etc.
     - Include a brief but descriptive summary of what changed
     - If changes are significant, also generate a more detailed commit body

3. **Process changes**
   - Add all changes with `git add .`
   - Show what files will be committed with `git status --short`
   - Display the generated commit message and ask for confirmation
   - Create the commit with the generated or provided message
   - Push to the current branch using `git push origin $(git branch --show-current)`

4. **Commit message generation guidelines**
   - **feat**: New features or functionality
   - **fix**: Bug fixes
   - **docs**: Documentation changes
   - **style**: Code style changes (formatting, semicolons, etc.)
   - **refactor**: Code refactoring without changing functionality
   - **test**: Adding or updating tests
   - **chore**: Maintenance tasks, dependency updates, build changes
   - **perf**: Performance improvements
   - **ci**: CI/CD changes
   - Include scope when relevant (e.g., `feat(auth): add login functionality`)
   - Keep the description under 50 characters for the first line
   - Use imperative mood ("add" not "added" or "adds")

5. **Provide feedback**
   - Show the generated commit message clearly
   - Explain why this commit message was chosen based on the changes
   - Show clear status messages for each step
   - Confirm successful operations
   - Display a summary of what was accomplished

6. **Error handling**
   - Handle cases where push fails (suggest pulling first)
   - Handle cases where there's no remote repository
   - Handle cases where there are merge conflicts
   - If unable to generate a meaningful commit message, ask the user for input
   - Provide helpful error messages and recovery suggestions

Always analyze the actual code changes intelligently to create meaningful, conventional commit messages that accurately describe what was changed.