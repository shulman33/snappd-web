---
description: Sync task list with GitHub issues, creating/updating based on completion status
argument-hint: "[task-file-path] [--dry-run] [--force-update]"
allowed-tools:
  - bash
---

You are helping with GitHub issue management by syncing a task list document with GitHub issues. You will analyze the task completion status and create or update GitHub issues accordingly with appropriate labels.

Arguments provided: $ARGUMENTS

Please follow this workflow:

1. **Parse Arguments and Setup**
   - Extract task file path from $ARGUMENTS (default to current directory if not provided)
   - Check for flags: --dry-run (show what would be done), --force-update (update all issues)
   - Verify GitHub CLI (gh) is installed and authenticated
   - Verify we're in a git repository with GitHub remote

2. **Analyze Task Document**
   - Read the task file (markdown format expected)
   - Parse tasks with format: `- [x] T### [P?] [Story?] Description`
   - Extract for each task:
     - **Task ID**: T### number
     - **Completion status**: [x] = done, [ ] = todo
     - **Parallel flag**: [P] if present
     - **User Story**: [US#] if present  
     - **Phase**: Based on heading structure
     - **Priority**: P1, P2, P3 based on user story or phase
     - **Description**: Full task description
     - **Dependencies**: Extract "Depends on" or prerequisite mentions

3. **Generate Issue Labels Based on Task Analysis**
   
   **Completion Status Labels:**
   - `status:todo` - Task not started
   - `status:in-progress` - Could be added manually
   - `status:done` - Task completed
   
   **Priority Labels:**
   - `priority:high` - P1 tasks (MVP critical)
   - `priority:medium` - P2 tasks 
   - `priority:low` - P3 tasks
   
   **Phase/Category Labels:**
   - `phase:setup` - Phase 1 tasks
   - `phase:foundation` - Phase 2 tasks (critical blockers)
   - `phase:user-stories` - Phase 3-10 tasks
   - `phase:polish` - Phase 11 tasks
   
   **User Story Labels:**
   - `story:us1` through `story:us8` - Based on [US#] tags
   
   **Technical Category Labels:**
   - `tech:database` - Database migrations, Supabase MCP tasks
   - `tech:auth` - Authentication related tasks
   - `tech:api` - API route handlers
   - `tech:frontend` - UI/UX tasks
   - `tech:security` - Security, rate limiting, validation
   - `tech:docs` - Documentation tasks
   - `tech:testing` - Testing related tasks
   - `tech:infrastructure` - Setup, configuration, deployment
   
   **Special Flags:**
   - `parallel` - Tasks marked with [P] that can run in parallel
   - `blocker` - Phase 2 foundational tasks that block user stories
   - `mcp:context7` - Tasks using Context7 MCP tools
   - `mcp:supabase` - Tasks using Supabase MCP tools

4. **GitHub Issue Operations**
   
   **For each task, determine action:**
   - Check if issue exists: `gh issue list --search "T### in:title"`
   - **If issue doesn't exist**: Create new issue
   - **If issue exists**: Update labels and status if needed
   - **If task completed**: Close issue and add completion comment
   
   **Issue Title Format**: `T### - [Phase] Description`
   Example: `T024 - [US1] Implement POST /api/auth/signup route handler`
   
   **Issue Body Template**:
   ```markdown
   ## Task Details
   - **Task ID**: T###
   - **Phase**: Phase Name
   - **User Story**: US# (if applicable)
   - **Priority**: P1/P2/P3
   - **Parallel**: Yes/No
   - **Dependencies**: List any prerequisites
   
   ## Description
   [Full task description from document]
   
   ## Acceptance Criteria
   - [ ] Task implementation complete
   - [ ] Code reviewed and merged
   - [ ] Documentation updated (if applicable)
   - [ ] Testing verified (if applicable)
   
   ## Technical Notes
   [Any USE CONTEXT7 or USE SUPABASE MCP instructions]
   
   ---
   *Auto-generated from task list. Do not edit issue title or this section.*
   ```

5. **Batch Operations**
   - Process tasks in dependency order (foundational first)
   - Create/update issues in batches to avoid rate limiting
   - Show progress for large task lists
   - Handle GitHub API errors gracefully

6. **Summary Report**
   - **Created**: Count of new issues created
   - **Updated**: Count of existing issues updated  
   - **Closed**: Count of completed tasks closed
   - **Skipped**: Count of issues skipped (no changes needed)
   - **Errors**: Any GitHub API errors encountered
   
   **Label Summary**: Show count of each label applied
   **Phase Progress**: Show completion percentage by phase

7. **Advanced Features**
   - **Milestone Creation**: Auto-create milestones for phases (Phase 1: Setup, Phase 2: Foundation, etc.)
   - **Assignees**: Extract and set assignees if mentioned in task description
   - **Due Dates**: Set due dates for critical path tasks
   - **Issue Templates**: Use GitHub issue templates if they exist in the repo

8. **Error Handling & Safety**
   - Validate task file format before processing
   - Handle GitHub API rate limits with exponential backoff
   - Provide clear error messages for authentication issues
   - Show preview in dry-run mode before making changes
   - Backup existing issue data before major updates
   - Handle issues that were manually modified vs auto-generated

9. **Special Task Type Handling**
   
   **Context7 Tasks**: Tasks marked "USE CONTEXT7"
   - Add `mcp:context7` label
   - Include library documentation fetch instructions in issue body
   
   **Supabase MCP Tasks**: Tasks marked "USE SUPABASE MCP"
   - Add `mcp:supabase` label  
   - Include database operation instructions in issue body
   
   **Foundational Tasks**: Phase 2 tasks
   - Add `blocker` label
   - Set high priority regardless of user story priority
   - Add warning about blocking other tasks

Always provide clear feedback about what issues are being created/updated and why specific labels were applied based on the task analysis. Show the mapping between task completion status and GitHub issue state.