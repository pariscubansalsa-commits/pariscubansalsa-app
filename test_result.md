#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Merge the existing "Cours" / "Workshops" section into a single curated section
  called "Profs & Workshops". The teacher directory becomes the entry point.
  Each teacher card is clickable. Each teacher profile must show: name, bio,
  dance styles, social links, and upcoming workshops linked to this teacher.
  Workshops are no longer a separate disconnected feed, they are attached to
  teacher profiles. Public users only see workshops with status approved or
  featured. Featured workshops appear first inside each teacher profile. Admin
  moderation system is preserved with: pending by default, approve, reject,
  featured. Editorial premium aesthetic preserved.

backend:
  - task: "Teacher model: dance_styles array field"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added dance_styles: List[str] = [] to Teacher and TeacherCreate Pydantic models."
        - working: true
          agent: "testing"
          comment: "Verified end-to-end. POST /api/teachers with dance_styles=['Salsa cubaine','Rumba'] returns 200 and persists the array. GET /api/teachers/{id} returns the same dance_styles. PUT /api/teachers/{id} successfully updates dance_styles to ['Son','Rueda de casino','Afro-cubain']. Field round-trips correctly."

  - task: "Reject endpoint for pending entries"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added POST /api/entries/{id}/reject (admin-only) that deletes the pending entry."
        - working: true
          agent: "testing"
          comment: "Verified. POST /api/entries/submit (type=workshop, no teacher_id) creates entry with status=pending. POST /api/entries/{id}/reject without admin -> 401 'Admin authentication required'. With admin Bearer token -> 200 {ok:true,id:<uuid>}. GET /api/entries/{id} on rejected id -> 404 'Entry not found' confirming hard delete."

  - task: "Teacher workshops endpoint (existing)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/teachers/{id}/workshops returns approved+featured workshops with featured first. Verify still works after model changes."
        - working: true
          agent: "testing"
          comment: "Verified. For a trusted teacher, the auto-approved workshop appears in GET /api/teachers/{id}/workshops. After POST /api/entries/{id}/feature, the featured workshop appears first even though its date is later than the second approved workshop (date 2026-04-10 featured listed before 2026-04-05 approved). For an untrusted teacher with only a pending submission, the workshops list is correctly empty (no pending leaks)."

  - task: "Submit entry with teacher_id auto-approve trusted teacher (existing)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/entries/submit should set status=pending if teacher.trusted_teacher is false, status=approved if true."
        - working: true
          agent: "testing"
          comment: "Verified. Submit workshop with teacher_id of a trusted_teacher=true teacher -> response status='approved'. Submit workshop with teacher_id of a default (trusted_teacher=false) teacher -> response status='pending'. Submit with no teacher_id -> status='pending'. Regression checks: GET /api/entries?type=workshop returns only approved+featured (4 items, no pending leak); GET /api/entries?status=pending without admin -> 401, with admin -> 200 list of pending; GET /api/calendar/events still returns iCal feed (30 events)."

frontend:
  - task: "Profs & Workshops merged tab"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/_layout.tsx, /app/frontend/app/(tabs)/profs.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Removed Workshops standalone tab (href:null), renamed Profs tab to 'Profs & Workshops' with school icon. Updated tab headline to 'Les profs et leurs workshops à venir.'"

  - task: "Teacher detail page with workshops + dance styles + propose CTA"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/profs/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Rewrote teacher detail page to fetch listTeacherWorkshops, render dance_styles chips, featured-first workshop list, social links, and a 'propose workshop' CTA pre-bound to teacher_id."

  - task: "SubmitEntryButton with presetTeacherId support"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/SubmitEntryButton.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Fixed corrupted styles file. Added presetTeacherId prop: when provided the teacher chip selector is hidden and the locked teacher banner appears."

  - task: "Admin entries — add reject + feature/unfeature actions"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/entries.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added Reject button (calls api.rejectEntry), Feature/Unfeature actions on approved items, and Validate+Feature shortcut on pending items."

  - task: "Admin teachers — dance_styles chips + trusted_teacher toggle"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/teachers.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added dance_styles multi-select chips (predefined options) and a 'Prof vérifié' toggle that bypasses moderation."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Reject endpoint for pending entries"
    - "Teacher model: dance_styles array field"
    - "Submit entry with teacher_id auto-approve trusted teacher (existing)"
    - "Teacher workshops endpoint (existing)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Refactored: merged Workshops + Profs into a single "Profs & Workshops" tab.
        Backend changes:
        1. Teacher model now includes dance_styles: List[str].
        2. New endpoint POST /api/entries/{id}/reject (admin only).
        Frontend: teacher profile now shows workshops linked via teacher_id, featured first.
        Please test:
        a) Create a teacher with dance_styles (admin auth needed).
        b) Submit a workshop with that teacher_id (should be pending).
        c) Set teacher trusted_teacher=true, submit again -> should be approved.
        d) Verify GET /api/teachers/{id}/workshops returns only approved+featured, featured first.
        e) Approve a pending workshop, verify it appears in teacher's workshops.
        f) Reject another pending submission, verify it's deleted (404 on subsequent get).
        Auth credentials: see /app/memory/test_credentials.md.
    - agent: "testing"
      message: |
        Backend test suite executed against https://rhythm-frames-3.preview.emergentagent.com/api
        using admin Bearer token test_session_pcs_admin_000. ALL 21 ASSERTIONS PASSED (0 failures).
        Coverage:
          1. Reject endpoint: pending submission -> 401 without admin -> 200 {ok,id} with admin
             -> GET returns 404 (hard delete confirmed).
          2. Teacher dance_styles: POST/GET/PUT all round-trip the array correctly
             (tested ['Salsa cubaine','Rumba'] then update to ['Son','Rueda de casino','Afro-cubain']).
          3. trusted_teacher auto-approve: trusted=true -> submitted workshop status=approved;
             trusted=false (default) -> status=pending; no teacher_id -> status=pending.
          4. GET /api/teachers/{id}/workshops: featured workshop ordered before approved one
             (featured 2026-04-10 listed BEFORE approved 2026-04-05, confirming featured-first sort).
             Pending workshops are correctly excluded.
          5. Regression: GET /api/entries?type=workshop returns only approved+featured;
             GET /api/calendar/events returns 30 iCal events; GET /api/entries?status=pending
             rejects non-admin (401) and returns admin-filtered list with admin token.
        All test resources (3 teachers + 3 entries) cleaned up; verified 404 on each teacher_id post-cleanup.
        Backend is fully working; no blockers. Test script: /app/backend_test.py.
