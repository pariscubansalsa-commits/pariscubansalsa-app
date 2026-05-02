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
    working: true
    file: "/app/frontend/app/(tabs)/_layout.tsx, /app/frontend/app/(tabs)/profs.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Removed Workshops standalone tab (href:null), renamed Profs tab to 'Profs & Workshops' with school icon. Updated tab headline to 'Les profs et leurs workshops à venir.'"
        - working: true
          agent: "testing"
          comment: "Verified in mobile viewport (390x844). Bottom tab labels (rendered uppercase via textTransform): ACCUEIL, SOIRÉES, FESTIVALS, PROFS & WORKSHOPS, GALERIE. No standalone 'Workshops' tab. Profs page hero shows overline 'PROFS & WORKSHOPS' and headline 'Les profs et leurs workshops à venir.' Teacher grid shows Lorenys & Manolo, OBINISA Relámpago, Yanet Fuentes, Pablo Ramos."

  - task: "Teacher detail page with workshops + dance styles + propose CTA"
    implemented: true
    working: true
    file: "/app/frontend/app/profs/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Rewrote teacher detail page to fetch listTeacherWorkshops, render dance_styles chips, featured-first workshop list, social links, and a 'propose workshop' CTA pre-bound to teacher_id."
        - working: true
          agent: "testing"
          comment: "Verified end-to-end on Lorenys & Manolo profile: header 'FICHE PROF', LO initials placeholder, title 'Lorenys & Manolo', yellow chips SALSA CUBAINE / SON CUBANO / RUMBA, bio paragraph, Instagram (@lorenys_y_manolo) and Facebook social buttons, 'WORKSHOPS À VENIR — Avec Lorenys' section, '★ COUP DE CŒUR PCS' featured band with 'Formation intensive Lorenys y Manolo' (Centre Momboye)."

  - task: "SubmitEntryButton with presetTeacherId support"
    implemented: true
    working: true
    file: "/app/frontend/src/SubmitEntryButton.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Fixed corrupted styles file. Added presetTeacherId prop: when provided the teacher chip selector is hidden and the locked teacher banner appears."

backend:
  - task: "Google Calendar sync — pending queue"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Added a background loop that polls the GOOGLE_CALENDAR_ICAL_URL every
            GCAL_SYNC_INTERVAL_SECONDS (default 900) and upserts events into the
            entries collection with source='gcal', external_id=ical UID,
            status='pending'. Existing entries are matched by external_id; if
            content changed, status is reset to 'pending' for re-validation;
            already 'rejected' entries are skipped to avoid resurrecting them.
            Manual trigger: POST /api/calendar/sync (admin only).
        - working: true
          agent: "testing"
          comment: |
            Verified end-to-end against https://rhythm-frames-3.preview.emergentagent.com/api.
            - POST /api/calendar/sync without admin -> 401 'Admin authentication required'.
            - POST /api/calendar/sync as admin -> 200 {ok:true, created:0, updated:0,
              unchanged:31, skipped:0}; total (created+updated+unchanged)=31 (>0).
              All four counters are non-negative ints, schema matches expectation.
            - GET /api/entries?status=pending (admin) returns 31 entries, all with
              source='gcal' and external_id populated (sample external_id is iCal UID).
            - Reject-then-resync invariant: rejected one gcal entry, re-ran sync ->
              {created:0, updated:0, unchanged:30, skipped:1}. The same external_id
              now has zero pending docs and one rejected doc; sync did NOT resurrect it.
            - GET /api/entries?status=rejected (admin) includes the rejected gcal entry.

  - task: "Reject endpoint now archives instead of deleting"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            POST /api/entries/{id}/reject now sets status='rejected' instead of
            deleting the row. GET /api/entries?status=rejected (admin) returns
            the archived list.
        - working: true
          agent: "testing"
          comment: |
            Verified. Created pending workshop via POST /api/entries/submit (no
            teacher_id), then:
            - POST /api/entries/{id}/reject without admin -> 401.
            - POST /api/entries/{id}/reject with admin Bearer test_session_pcs_admin_000
              -> 200 {ok:true, id:<uuid>, status:'rejected'}.
            - GET /api/entries/{id} -> 200 with status='rejected' (entry is archived,
              NOT deleted; previous behaviour was 404). All assertions pass.

  - task: "Approve endpoint accepts type query param"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            POST /api/entries/{id}/approve?type=soiree|workshop|festival|agenda
            allows admin to reclassify an entry's type at validation time.
        - working: true
          agent: "testing"
          comment: |
            Verified. Pending workshop submitted with type='workshop':
            - POST /api/entries/{id}/approve?type=festival (admin) -> 200, response
              has type='festival' and status='approved' (reclassification works).
            - POST /api/entries/{id}/approve?type=invalid (admin) -> 400
              {"detail":"Invalid type"}.
            Regression: POST /api/entries/{id}/feature on a manually approved entry
            returns 200 with status='featured' and featured=true.
            GET /api/calendar/events still returns the raw iCal list (count=31).
            GET /api/entries?type=workshop returns only approved+featured (no
            pending/rejected leaks).

agent_communication:
    - agent: "main"
      message: |
        Please test the new Google Calendar pipeline:
        1) GET /api/entries?status=pending should include source='gcal' entries.
        2) POST /api/calendar/sync (admin) returns {ok, created, updated, unchanged, skipped}.
        3) POST /api/entries/{id}/approve?type=soiree on a gcal-pending entry
           should set status=approved + type=soiree.
        4) POST /api/entries/{id}/reject sets status=rejected (not deleted).
        5) GET /api/entries?status=rejected (admin) returns the archived list.
        6) Re-running sync_gcal_to_pending after a reject must NOT re-create the
           rejected entry.
        Auth: see /app/memory/test_credentials.md.

        - working: true
          agent: "testing"
          comment: "Verified end-to-end. Tapping 'PROPOSER UN WORKSHOP' on Lorenys profile opens modal sheet with title 'Proposer un workshop'. The teacher chip selector (FICHE PROF optional) is HIDDEN as expected. Yellow locked banner 'Ce workshop sera rattaché à cette fiche prof.' is shown. Filled and submitted form (Test Workshop E2E / 2026-09-15 / Intermédiaire / Salsa cubaine / 60€ / Tester E2E / tester-e2e@example.com) -> success screen 'Merci !' with checkmark appeared. After reload, 'Test Workshop E2E' appears on Lorenys profile (auto-approved via trusted_teacher flag). All 5 scenarios PASSED."

  - task: "Admin entries — add reject + feature/unfeature actions"
    implemented: true
    working: true
    file: "/app/frontend/app/admin/entries.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added Reject button (calls api.rejectEntry), Feature/Unfeature actions on approved items, and Validate+Feature shortcut on pending items."
        - working: true
          agent: "testing"
          comment: |
            E2E mobile (390x844) on https://rhythm-frames-3.preview.emergentagent.com/admin/entries with Bearer token via localStorage.pcs_session_token. ALL 7 SCENARIOS PASSED.
            - S1 PASS: Topbar 'AGENDA & SORTIES' + gcal-sync-btn visible. À VALIDER tab default. 30 pending entries with GOOGLE CALENDAR label, RECLASSER EN row + 4 chips (SOIRÉE/WORKSHOP/FESTIVAL/SORTIE), and 3 action buttons (VALIDER, VALIDER + COUP DE CŒUR, REFUSER).
            - S2 PASS: Manual sync via gcal-sync-btn produced yellow banner "Synchro OK — 0 nouveaux, 0 mis à jour, 30 inchangés" within 3s; auto-dismissed after ~5s.
            - S3 PASS: Reclassified pending entry as SOIRÉE via set-type-{id}-soiree, then approve-{id} → entry disappeared from pending and appeared on filter-soiree tab (feature-{id} button present).
            - S4 PASS: reject-{id} with auto-dialog handler → entry removed from pending, present in filter-rejected tab with restore-{id} button.
            - S5 PASS: restore-{id} → entry removed from rejected and appeared in filter-agenda tab (gcal default type=agenda).
            - S6 PASS: feature-pending-{id} → entry removed from pending; verified via API GET /api/entries/{id} that status='featured'.
            - S7 PASS: On SOIRÉES tab, clicked feature-{id} on approved entry → after reload unfeature-{id} appeared. Clicked back → feature-{id} restored. Toggle works both directions.
            No console errors during test. Note: localhost:3000 origin fails CORS due to credentials='include' against preview backend; testing must be performed against the preview URL (rhythm-frames-3.preview.emergentagent.com) directly — this is a test-environment quirk only, production uses same origin.

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
    - "PUT /api/entries/{id} preserves description + handles status=null"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

backend_regression_2026_05_02:
  - task: "PUT /api/entries/{id} preserves description + handles status=null"
    implemented: true
    working: false
    file: "/app/backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
        - working: false
          agent: "testing"
          comment: |
            Regression test for the PUT /api/entries/{id} fix (review request
            2026-05-02). Results 12/13 PASS, 1 FAIL + 1 related 500 found.

            PASS (aligned with review request):
              1) PUT on existing workshop (status was 'featured') with
                 {type,title,date,featured:true}  -> 200 status='featured' featured=true ✔
                 {type,title,date,featured:false} -> 200 status='approved' featured=false ✔
                 Title preserved across both calls. The original "crash on
                 entries with status=null" is fixed — handler returns 200.
              3) DELETE /api/entries/{id} -> 200 {ok:true}; subsequent
                 GET /api/entries/{id} -> 404. ✔
              4) POST /api/entries/submit then
                 POST /api/entries/{id}/approve?type=festival (admin) -> 200
                 with type='festival' status='approved'. ✔
              5) Submit soiree -> status='pending'; reject -> 200
                 {ok:true,status:'rejected'}; GET /entries?status=rejected
                 includes it; approve -> status='approved'. ✔

            FAIL (blocker, requirement #2):
              2) PUT /api/entries/{id} with body {type,title,date} (no
                 description) WIPES the existing description to "".
                 Reproduction:
                   seed POST /entries {…, description:"Valse cubaine avancée…"}
                   PUT  /entries/{id} {type:"workshop", title, date}
                   GET  /entries/{id} -> description=""  ← should be preserved
                 Root cause: EntryCreate.description defaults to "" (not None),
                 so payload.dict(exclude_none=True) still includes description=""
                 which overwrites the stored value via $set. The same bug will
                 silently wipe venue, address, time, instructor, level, price,
                 category, ticket_link, cover_photo, end_date on any PUT that
                 only carries a partial payload. Fix suggestions:
                   a) Switch EntryCreate optional fields to default to None
                      so exclude_none actually excludes them, OR
                   b) In update_entry, use payload.dict(exclude_unset=True)
                      and remove Optional defaults, OR
                   c) Explicitly drop empty-string fields before $set when
                      the stored value is non-empty.

            RELATED 500 discovered during testing (not in review request but
            reproducible and logged every call):
              POST /api/entries (admin create) with a body that omits `status`
              returns 500. Stack trace in /var/log/supervisor/backend.err.log:
                pydantic ValidationError: Entry.status
                  Input should be a valid string [input_value=None]
                at server.py:597  entry = Entry(**payload.dict())
              Cause: EntryCreate.status is Optional[str]=None; Entry.status is
              required str. create_entry must default status to "approved" (or
              drop None before instantiation) the same way submit_entry does.
              Workaround used in tests: send status="approved" in the seed body.

            Cleanup: all 3 test entries deleted; the pre-existing
            'Formation intensive Lorenys y Manolo' workshop was restored to
            featured=true at end of test.

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

    - agent: "testing"
      message: |
        ## Frontend E2E regression — "Artistes" rename (Mobile 390x844)
        
        ### SUMMARY (per scenario)
        - ✅ S1 PASS — Bottom tab bar shows ACCUEIL, SOIRÉES, FESTIVALS, ARTISTES, GALERIE in order. No "Workshops"/"Profs & Workshops" tab present.
        - ✅ S2 PASS — Artistes page: overline "ARTISTES", headline italic yellow "artistes" ("Les *artistes* et leurs workshops à venir."), subtitle "Profs, danseurs, performers — découvrez celles et ceux qui font vivre la salsa cubaine à Paris." All 8 chips visible: TOUS, CASINO, RUMBA, AFRO, SON, LADY STYLE, REGGAETON, FOLKLORE. Multiple teacher tiles render by default (Lorenys & Manolo, OBINISA Relámpago, Yanet Fuentes, Pablo Ramos).
        - ⚠️ S3 LIKELY PASS — Tapping CASINO chip (filter-Casino) keeps Lorenys & Manolo and Pablo Ramos visible. Body-text contained "OBINISA" string after filter, but this is most likely from a workshop title appearing elsewhere on screen ("Stage OBINISA Relámpago" featured workshop) — not the OBINISA artist tile (visual confirmation by main agent recommended).
        - ✅ S4 PASS — Tapping AFRO chip (filter-Afro) shows OBINISA Relámpago and Yanet Fuentes; Pablo Ramos correctly hidden. Filter mechanism confirmed working.
        - ✅ S5 PASS (visual) — Tapping TOUS (filter-all) re-displays all teacher tiles. Note: artist cards lack teacher-card-* / artist-card-* data-testids, so a programmatic count returned 0; visual screenshot confirms reset works.
        - ⚠️ S6 NOT VERIFIED — Could not click into Lorenys & Manolo detail page programmatically because the tile name text is not pressable and there is no data-testid on the card itself. Navigation requires tapping the "VOIR L'ARTISTE" button. The detail-page strings (FICHE ARTISTE, ARTISTE — SCÈNE CUBAINE PARISIENNE, VOUS ÊTES CET ARTISTE ?, "Formation intensive Lorenys y Manolo") were therefore not directly confirmed by automation. Main agent should verify the detail page rename manually or add a data-testid to the artist card root for testability.
        - ✅ S7 PASS — Soirées tab overline reads "SOIRÉES & CONCERTS"; headline reads "Nos *soirées & concerts*." with italic yellow on "soirées & concerts.". Subtitle: "Les rendez-vous mensuels et concerts live de la scène cubaine parisienne — Callesol, Cabeza Loca, CUBAILA & Cie."
        
        ### Action items for main agent
        1. (Optional) Add `data-testid="artist-card-<slug>"` (or similar) to each artist card root in the Artistes list to make tile counts and detail-navigation deterministic for E2E.
        2. (Optional) Add `data-testid="tab-artistes"`, `tab-soirees`, etc. to bottom-nav buttons; current automation had to fall back to text matching.
        3. Visually verify S6 flow (tap Lorenys & Manolo → FICHE ARTISTE header, "ARTISTE — SCÈNE CUBAINE PARISIENNE" overline, "VOUS ÊTES CET ARTISTE ?" propose section, and the "Formation intensive Lorenys y Manolo" featured workshop card). Source already shows the new strings exist (no FICHE PROF / VOUS ÊTES CE PROF found anywhere in the body during checks). High confidence the rename is applied; just not auto-verified.
        4. S3 OBINISA presence is most likely a featured-workshop title; if Artistes page currently renders the workshop carousel below the grid, no fix needed. Otherwise inspect filter logic.
        
        Overall: Rename rollout looks correct. 5 of 7 scenarios fully PASS, 1 likely-pass (filter false-negative from string match), 1 not-verified-by-automation (no testid).

    - agent: "testing"
      message: |
        ## Backend regression — GCal sync + admin moderation queue

        Test suite: /app/backend_test.py against
        https://rhythm-frames-3.preview.emergentagent.com/api with admin Bearer
        token test_session_pcs_admin_000. ALL 16 ASSERTIONS PASSED (0 failures).

        ### A. Reject endpoint archives instead of deleting — PASS (4/4)
          - submit pending workshop -> id ok
          - reject without admin -> 401
          - reject with admin -> 200 {ok:true,id,status:'rejected'}
          - GET /api/entries/{id} after reject -> 200 status='rejected' (NOT 404,
            confirming archival behaviour)

        ### B. Approve accepts type query param — PASS (3/3)
          - approve?type=invalid -> 400 'Invalid type'
          - approve?type=festival -> 200 type='festival', status='approved'
          - submission of type=workshop reclassified to festival successfully

        ### C. Google Calendar sync pipeline — PASS (6/6)
          - POST /api/calendar/sync without admin -> 401
          - POST /api/calendar/sync as admin -> 200
            {ok:true, created:0, updated:0, unchanged:31, skipped:0};
            total (created+updated+unchanged) = 31 (>0 ✔). All counters non-negative ints.
          - GET /api/entries?status=pending (admin) -> 31 entries, all
            source='gcal', external_id populated.
          - Reject one gcal entry, re-run sync -> {created:0, updated:0,
            unchanged:30, skipped:1}. The same external_id has 0 pending and 1
            rejected — sync did NOT resurrect it. Rejected entry left in DB
            (per cleanup instructions; gcal entries not deleted).
          - GET /api/entries?status=rejected (admin) includes the rejected gcal entry.

        ### D. Regression — PASS (3/3)
          - GET /api/calendar/events -> 200, list of 31 iCal events.
          - GET /api/entries?type=workshop -> only approved+featured (no leaks).
          - POST /api/entries/{id}/feature on approved entry -> status='featured',
            featured=true.

        Cleanup: deleted the 3 manual test entries (sections A, B, D). The single
        gcal entry rejected during section C is intentionally left archived so
        the moderation queue stays consistent — and the next sync correctly
        skips it instead of resurrecting it.

        No blockers. Backend is fully working. Test script: /app/backend_test.py.

    - agent: "testing"
      message: |
        ## PWA configuration E2E (Mobile 390x844) — ALL 6 SCENARIOS PASS

        Target: https://rhythm-frames-3.preview.emergentagent.com (read from
        EXPO_PUBLIC_BACKEND_URL).

        ### S1 — Manifest is reachable & valid ✅ PASS
          GET /manifest.json -> 200, content-type application/json.
          name="Paris Cuban Salsa", short_name="PCS", theme_color="#111111",
          background_color="#111111", display="standalone", start_url="/",
          icons=10 (>=8), at least one with purpose:"maskable". All 10 checks pass.

        ### S2 — Icons reachable ✅ PASS
          /icons/icon-192.png         -> 200, image/png, 4816 bytes
          /icons/icon-512.png         -> 200, image/png, 14034 bytes
          /icons/icon-maskable-512.png -> 200, image/png, 11181 bytes
          All > 1000 bytes.

        ### S3 — Service worker registered ✅ PASS
          After 5s on /, navigator.serviceWorker.getRegistration() returned a
          registration. scope = "https://rhythm-frames-3.preview.emergentagent.com/"
          (ends with "/"). active scriptURL = /sw.js. After reload,
          navigator.serviceWorker.controller != null (controlled by /sw.js).

        ### S4 — Offline fallback ✅ PASS
          GET /offline.html -> 200, body contains "hors connexion" and "PCS".

        ### S5 — HTML head meta tags ✅ PASS
          <title> = "Paris Cuban Salsa — Soirées · Concerts · Festivals · Artistes"
          (contains "Paris Cuban Salsa" and starts with it via page.title()).
          <meta name="theme-color" content="#111111"> present.
          <meta name="apple-mobile-web-app-capable" content="yes"> present.
          <meta name="apple-mobile-web-app-title" content="PCS"> present.
          <link rel="manifest" href="/manifest.json"> present.
          <link rel="apple-touch-icon"> present.
          <meta property="og:image" content="/icons/icon-512.png"> present.

        ### S6 — Install banner (iOS UA) ✅ PASS
          Spawned new context with iOS Safari 17 UA, cleared
          localStorage.pcs_pwa_banner_dismissed, navigated to /.
          [data-testid="pwa-banner-ios"] became visible within ~5s.
          Banner text contains "Installer Paris Cuban Salsa" plus the iOS
          Share/Add-to-Home-Screen instructions.
          Tapped [data-testid="pwa-banner-close"] -> banner disappeared.
          Reloaded page -> banner did NOT reappear; localStorage flag
          pcs_pwa_banner_dismissed = "1" persisted.

        No console errors observed during the run. The PWA install / offline
        plumbing is fully wired and working.

    - agent: "testing"
      message: |
        ## Backend regression — past-event filter + duplicate endpoint (2026-05-02)

        Test suite: /app/backend_test.py against
        https://rhythm-frames-3.preview.emergentagent.com/api with admin Bearer
        token test_session_pcs_admin_000. Result: 23/24 PASS, 1 FAIL.
        TODAY Europe/Paris = 2026-05-02.

        ### Section 1 — Public past-filter — PASS (4/4)
          - GET /api/entries -> 200, 6 items, 0 past leaks.
          - GET /api/entries?type=workshop -> 200, 2 items, 0 past leaks.
          - GET /api/entries?featured=true -> 200, 4 items, 0 past leaks.
          - GET /api/calendar/events -> 200, 29 items, 0 past leaks.
          Rule enforced: date >= today OR end_date >= today (multi-day festivals
          still ongoing are correctly kept).

        ### Section 2 — Admin History tab — PASS (2/2)
          - GET /api/entries?include_past=true WITHOUT auth -> 401 ✔
          - GET /api/entries?include_past=true WITH admin -> 200, 8 items; every
            item has date<today AND (no end_date OR end_date<today). 0 leaks.

        ### Section 3 — Featured carousel filter — PASS (4/4)
          - Picked featured workshop "Bootcamp Lady Cuban Style"
            (id=19d6b8e5…, original date=2026-06-14).
          - PUT /api/entries/{id} with {type,title,date:2026-05-01,featured:true}
            -> 200.
          - GET /api/entries?featured=true -> 3 items, target NOT present (hidden).
          - GET /api/entries?include_past=true (admin) -> target present in
            history.
          - Restored original date=2026-06-14 via PUT -> 200.

        ### Section 4 — Duplicate endpoint — 7/8 PASS, 1 FAIL
          Source: approved/featured workshop id=19d6b8e5…
          POST /api/entries/{id}/duplicate -> 200, response validated:
            ✔ new id differs from source (18b675f5…)
            ✔ status='pending'
            ✔ featured=False
            ✔ source='manual'
            ✔ external_id=None
            ✔ title="Bootcamp Lady Cuban Style (copie)" (ends with ' (copie)')
            ✔ date='' (cleared)

          ❌ FAIL: GET /api/entries?status=pending (admin) does NOT include the
             duplicated entry.
             Observed: pending count=27, contains_dup=False.
             Repro with explicit include_past=true: GET
             /api/entries?status=pending&include_past=true -> 1 item (the dup)
             — so the duplicate IS stored correctly, but it is FILTERED OUT of
             the admin pending queue by the default date filter in
             list_entries().
             Root cause: in server.py:498-508, when `include_past` is false,
             the handler adds `$or: [{date: {$gte: today}}, {end_date: {$gte:
             today}}]` to the query UNCONDITIONALLY — including for admin
             calls with status=pending/rejected. The duplicate has date=""
             and end_date=None so both branches fail and it is hidden.
             Impact: admins won't see newly-duplicated drafts in the "À
             VALIDER" tab until they set a date on them. Breaks the
             duplicate → edit → publish workflow described in the review
             request ("GET /api/entries?status=pending (admin) must include
             the duplicated entry").
             Suggested fix (server.py list_entries):
               - If `status` is explicitly provided by an admin (pending /
                 rejected / approved / featured), OR the entry has an empty
                 `date` (draft), skip the "future date" filter.
               - Simple patch:
                   if not include_past and not status:
                       query["$or"] = [...]
                 (i.e. skip date filter whenever admin passes a status filter).
             Cleanup: duplicate entry was deleted after the test.

        ### Section 5 — Sort order — PASS (3/3)
          GET /api/entries?type=workshop:
            - All status='featured' items precede status='approved' items. ✔
            - featured dates ascending: ['2026-06-14', '2026-07-04'] ✔
            - approved group empty (only featured workshops are public here). ✔

        ### Section 6 — GCal sync skips past events — PASS (2/2)
          - POST /api/calendar/sync (admin) -> 200
            {ok:true, created:0, updated:0, unchanged:29, skipped:2}.
            Skipped counter is a non-negative int, consistent with past events
            being filtered out on ingestion.
          - GET /api/entries?status=pending (admin) filtered to source='gcal':
            27 items, 0 past (all have date >= today). Past ingest-skip rule is
            enforced.

        ### Blocker / Action items
          ❌ Fix list_entries date filter so that admin status=pending queries
             include draft entries with empty date (needed for duplicate
             endpoint usability).

        Test script: /app/backend_test.py (re-runnable with
        BACKEND_URL env override). All test-created data cleaned up.
