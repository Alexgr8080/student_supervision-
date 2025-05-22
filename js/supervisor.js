// public/js/supervisor.js
// (Enhanced Version)

console.log('supervisor.js: Script execution started.');

// --- Module State ---
let supSupabaseClient = null;
let supCurrentUser = null; // Supabase auth.user object
let supUserOrgData = null; // { organization: {id, name}, roles: [{id, name}] }
// supSupervisorProfile is not explicitly defined in the schema but could be part of users.raw_user_meta_data
let supModuleInitialized = false;
let supFlatpickrInstance = null;

// Chart instances
let supProjectPhaseChartInstance = null;
let supAttendanceChartInstance = null;

// --- DOM Element Cache ---
const SupervisorDOM = {
    // Header & User Info
    userNameDisplay: null, userAvatar: null, portalType: null, notificationCountBadge: null,
    // Overview Stats
    totalStudentsStat: null, onTrackStat: null, behindScheduleStat: null, needsAttentionStat: null,
    currentAcademicYear: null, recentActivityContainer: null, upcomingEventsContainer: null,
    // Students Section
    studentListContainer: null, openAddStudentModalBtn: null,
    // Meetings Section
    meetingsCalendarDatepicker: null, meetingsForSelectedDate: null, // Corrected ID
    upcomingMeetingsListContainer: null, openScheduleMeetingModalBtn: null, // Corrected ID
    // Progress Charts
    supervisorProjectPhaseChartCanvas: null, supervisorAttendanceChartCanvas: null,
    // Modals & Forms
    addStudentModal: null, addStudentForm: null, studentSearchExistingInput: null, studentSearchResultsDiv: null,
    flagIssueModal: null, flagIssueForm: null, flagStudentSelect: null,
    // Quick Action Buttons (Sidebar)
    quickScheduleMeetingBtn: null, quickFlagIssueBtn: null,
    // Alerts
    studentAlertsContainer: null,
    toastContainer: null, // From index.html
    // Sidebar & Main Content
    sidebarNav: null, mainContentArea: null, pageSections: [],
    // Logout (if distinct from a global one)
    logoutButton: null
};

/**
 * Main initialization function for the Supervisor Dashboard.
 * @param {object} authUser - The authenticated Supabase user object.
 * @param {object} userOrgData - User's organization and role data.
 */
async function initializeSupervisorDashboard(authUser, userOrgData) {
    if (supModuleInitialized) {
        console.log('supervisor.js: Dashboard already initialized.');
        return;
    }
    console.log('supervisor.js: Initializing Supervisor Dashboard...');

    supCurrentUser = authUser;
    supUserOrgData = userOrgData;

    if (!supCurrentUser || !supUserOrgData || !supUserOrgData.organization) {
        console.error('supervisor.js: Critical - User or Organization data is missing. Cannot initialize.');
        if(document.body) document.body.innerHTML = '<p style="color:red; padding:20px;">Supervisor Dashboard Error: Missing critical user data.</p>';
        return;
    }

    try {
        supSupabaseClient = await getSupabaseClient();
        if (!supSupabaseClient) throw new Error('Supabase client not available.');
    } catch (error) {
        console.error('supervisor.js: Failed to get Supabase client.', error);
        showSupervisorToast('Connection error. Dashboard may not function correctly.', 'error', 0);
        return;
    }

    cacheSupervisorDOMElements();
    updateSupervisorCommonUI();
    setupSupervisorEventListeners(); // Listeners specific to supervisor.js logic
    // Inline script in index.html handles its own UI (sidebar, dropdowns, basic modal toggles).

    // Default to overview section, load its data
    await loadDataForVisibleSection('overview'); // Ensure 'overview' is default
    // Set active state for 'overview' link explicitly if not handled by inline script at this stage
    const overviewLink = SupervisorDOM.sidebarNav.querySelector('a[data-section="overview"]');
    if (overviewLink && !overviewLink.classList.contains('active')) {
         SupervisorDOM.sidebarNav.querySelectorAll('.sidebar-nav-link').forEach(nav => nav.classList.remove('active', 'bg-blue-700', 'text-white')); // Assuming active classes from HTML
         overviewLink.classList.add('active', 'bg-blue-700', 'text-white');
    }


    await loadStudentAlerts(); // Initial load

    supModuleInitialized = true;
    console.log('supervisor.js: Supervisor Dashboard initialized successfully.');
    showSupervisorToast('Welcome to your dashboard!', 'success', 2000);
}

function cacheSupervisorDOMElements() {
    const D = SupervisorDOM;
    D.userNameDisplay = document.getElementById('userNameDisplay');
    D.userAvatar = document.getElementById('userAvatar');
    D.portalType = document.getElementById('portalType');
    D.notificationCountBadge = document.getElementById('notificationCountBadge');
    D.currentAcademicYear = document.getElementById('currentAcademicYear');

    D.totalStudentsStat = document.getElementById('totalStudentsStat');
    D.onTrackStat = document.getElementById('onTrackStat');
    D.behindScheduleStat = document.getElementById('behindScheduleStat');
    D.needsAttentionStat = document.getElementById('needsAttentionStat');
    D.recentActivityContainer = document.getElementById('recentActivityContainer');
    D.upcomingEventsContainer = document.getElementById('upcomingEventsContainer');

    D.studentListContainer = document.getElementById('studentListContainer');
    D.openAddStudentModalBtn = document.getElementById('openAddStudentModalBtn'); // In "My Students" section

    D.meetingsCalendarDatepicker = document.getElementById('meetingCalendarDatepicker');
    D.meetingsForSelectedDate = document.getElementById('meetingsForSelectedDate');
    D.upcomingMeetingsListContainer = document.getElementById('upcomingMeetingsListContainer');
    D.openScheduleMeetingModalBtn = document.getElementById('openScheduleMeetingModalBtn'); // In "My Meetings" section

    D.supervisorProjectPhaseChartCanvas = document.getElementById('supervisorProjectPhaseChart');
    D.supervisorAttendanceChartCanvas = document.getElementById('supervisorAttendanceChart');

    D.addStudentModal = document.getElementById('supervisorAddStudentModal');
    D.addStudentForm = document.getElementById('supervisorAddStudentForm');
    D.studentSearchExistingInput = document.getElementById('studentSearchExisting');
    D.studentSearchResultsDiv = document.getElementById('studentSearchResults');


    D.flagIssueModal = document.getElementById('supervisorFlagIssueModal');
    D.flagIssueForm = document.getElementById('supervisorFlagIssueForm');
    D.flagStudentSelect = document.getElementById('flagStudentSelect');

    D.quickScheduleMeetingBtn = document.getElementById('quickScheduleMeetingBtn'); // Sidebar
    D.quickFlagIssueBtn = document.getElementById('quickFlagIssueBtn');         // Sidebar

    D.studentAlertsContainer = document.getElementById('studentAlertsContainer'); // Sidebar
    D.toastContainer = document.getElementById('toastContainer');

    D.sidebarNav = document.getElementById('sidebarNav');
    D.mainContentArea = document.getElementById('mainContentArea');
    if (D.mainContentArea) D.pageSections = Array.from(D.mainContentArea.querySelectorAll('.page-section'));
    D.logoutButton = document.getElementById('logoutButton'); // In user dropdown
    console.log('supervisor.js: DOM elements cached.');
}

function updateSupervisorCommonUI() {
    const D = SupervisorDOM;
    if (supCurrentUser) {
        if (D.userNameDisplay) D.userNameDisplay.textContent = supCurrentUser.user_metadata?.full_name || supCurrentUser.email.split('@')[0];
        if (D.userAvatar) {
            const nameForAvatar = supCurrentUser.user_metadata?.full_name || supCurrentUser.email.split('@')[0] || 'S';
            D.userAvatar.src = supCurrentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&background=random&color=fff&bold=true`;
        }
    }
    if (D.portalType) D.portalType.textContent = "Supervisor Portal";
    if (D.notificationCountBadge) D.notificationCountBadge.textContent = "0"; // Placeholder
    if (D.currentAcademicYear) { // Example: dynamically set academic year
        const year = new Date().getFullYear();
        D.currentAcademicYear.textContent = `Academic Year: ${year}-${year + 1}`;
    }
}

function setupSupervisorEventListeners() {
    console.log('supervisor.js: Setting up event listeners.');
    const D = SupervisorDOM;

    // Listen for section changes potentially dispatched by the inline script from index.html
    // if it handles main navigation.
    document.addEventListener('supervisorSectionChanged', (event) => {
        const sectionId = event.detail.sectionId;
        console.log('supervisor.js: Section changed event received for ->', sectionId);
        loadDataForVisibleSection(sectionId);
    });

    // If supervisor.js should handle sidebar clicks (alternative to inline script):
    if (D.sidebarNav && !D.sidebarNav.hasAttribute('data-listener-attached-by-supervisor-js')) {
        D.sidebarNav.addEventListener('click', (e) => {
            const link = e.target.closest('a.sidebar-nav-link, button.sidebar-nav-link');
            if (!link) return;

            const targetSectionId = link.dataset.section;

            if (link.id === 'quickFlagIssueBtn') {
                e.preventDefault(); // Prevent default if it's an <a>
                openModal(D.flagIssueModal);
                populateFlagIssueStudentSelect(); // Populate select when modal opens
                return;
            }
            if (link.id === 'quickScheduleMeetingBtn') {
                 e.preventDefault();
                 // Navigate to meetings section and potentially open a "new meeting" part of it
                 const meetingsLink = D.sidebarNav.querySelector('a[data-section="meetings"]');
                 if (meetingsLink) meetingsLink.click(); // Simulate click to trigger section change
                 // TODO: Add logic to focus/open new meeting form within meetings section
                 showSupervisorToast('Schedule meeting: Switched to Meetings tab. New meeting form TBD.', 'info');
                 return;
            }

            if (targetSectionId) {
                e.preventDefault();
                // Update active classes (inline script in index.html also does this, ensure no conflict)
                D.sidebarNav.querySelectorAll('.sidebar-nav-link').forEach(nav => nav.classList.remove('active', 'bg-blue-700', 'text-white'));
                link.classList.add('active', 'bg-blue-700', 'text-white');

                D.pageSections.forEach(section => section.classList.add('hidden'));
                const targetSectionEl = document.getElementById(targetSectionId);
                if (targetSectionEl) targetSectionEl.classList.remove('hidden');

                loadDataForVisibleSection(targetSectionId); // Load data for the new active section
            }
        });
        D.sidebarNav.setAttribute('data-listener-attached-by-supervisor-js', 'true');
    }


    // Add Student Modal (button within "My Students" section)
    if (D.openAddStudentModalBtn) {
        D.openAddStudentModalBtn.addEventListener('click', () => openModal(D.addStudentModal));
    }
    // Schedule Meeting Modal (button within "My Meetings" section)
    if (D.openScheduleMeetingModalBtn) {
        D.openScheduleMeetingModalBtn.addEventListener('click', () => {
            // For now, this just navigates. A dedicated modal could be used.
            const meetingsLink = D.sidebarNav.querySelector('a[data-section="meetings"]');
            if(meetingsLink) meetingsLink.click(); // Navigate to meetings section
            showSupervisorToast('New meeting form TBD within Meetings section.', 'info');
        });
    }


    // Add Student Form Submission
    if (D.addStudentForm) D.addStudentForm.addEventListener('submit', handleAddStudentSubmit);
    // Flag Issue Form Submission
    if (D.flagIssueForm) D.flagIssueForm.addEventListener('submit', handleFlagIssueSubmit);

    // Flatpickr for Meeting Calendar
    if (D.meetingsCalendarDatepicker && !D.meetingsCalendarDatepicker._flatpickr) { // Check if not already initialized
        supFlatpickrInstance = flatpickr(D.meetingsCalendarDatepicker, {
            dateFormat: "Y-m-d",
            defaultDate: "today",
            onChange: async function(selectedDates, dateStr) {
                console.log('supervisor.js: Date changed in meeting calendar:', dateStr);
                await loadMeetingsForDate(dateStr);
            }
        });
    }
}

/** Opens a modal using the classes defined in index.html */
function openModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden', 'opacity-0', 'scale-95');
        modalElement.classList.add('opacity-100', 'scale-100');
        const firstInput = modalElement.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }
}
/** Closes a modal and resets its form if one exists */
function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modalElement.classList.add('hidden'), 300); // Match transition duration
        const form = modalElement.querySelector('form');
        if (form) form.reset();
    }
}


async function loadDataForVisibleSection(sectionId) {
    console.log('supervisor.js: Loading data for section:', sectionId);
    switch (sectionId) {
        case 'overview': await loadOverviewData(); break;
        case 'students': await loadMyStudents(); break;
        case 'meetings':
            await loadMyMeetings(); // Load upcoming list
            // Load for selected date or today if nothing selected by flatpickr
            const selectedDate = supFlatpickrInstance?.selectedDates[0] || new Date();
            await loadMeetingsForDate(selectedDate);
            break;
        case 'progress': await loadProgressTrackingData(); break;
        case 'reports':
            if(document.getElementById('reports')) document.getElementById('reports').innerHTML = '<h2 class="text-3xl font-semibold text-gray-800 mb-6">Generate Reports</h2><div class="bg-white rounded-xl shadow-lg p-6"><p>Report generation options will be available here.</p></div>';
            break;
        case 'profile': await loadSupervisorProfile(); break;
        case 'settings':
            if(document.getElementById('settings')) document.getElementById('settings').innerHTML = '<h2 class="text-3xl font-semibold text-gray-800 mb-6">Settings</h2><div class="bg-white rounded-xl shadow-lg p-6"><p>Your settings options will load here...</p></div>';
            break;
        default: console.warn('supervisor.js: No data loading logic for section:', sectionId);
    }
}

async function loadOverviewData() {
    if (!supCurrentUser || !supUserOrgData || !supSupabaseClient) return;
    console.log('supervisor.js: Loading overview data...');
    const D = SupervisorDOM;
    try {
        // Fetch projects supervised by the current user
        const { data: supervisedData, error: projectsError } = await supSupabaseClient
            .from('project_supervisors')
            .select(`
                projects!inner (
                    student_id,
                    supervisions!inner ( overall_status )
                )
            `)
            .eq('supervisor_user_id', supCurrentUser.id)
            .eq('projects.supervisions.organization_id', supUserOrgData.organization.id); // Ensure supervisions are for the same org

        if (projectsError) throw projectsError;

        let totalStudents = 0;
        let onTrack = 0;
        let behind = 0;
        let needsAttention = 0;

        if (supervisedData) {
            const studentIds = new Set();
            supervisedData.forEach(ps => {
                if (ps.projects) {
                    studentIds.add(ps.projects.student_id); // Count unique students
                    if (ps.projects.supervisions && ps.projects.supervisions.length > 0) {
                        // Assuming one supervision record per project for this overview
                        const status = ps.projects.supervisions[0].overall_status;
                        if (status === 'On Track') onTrack++;
                        else if (status === 'Behind Schedule') behind++;
                        else if (status === 'Needs Attention') needsAttention++;
                        // Other statuses like 'Planning', 'Completed' are not explicitly counted here but contribute to total.
                    }
                }
            });
            totalStudents = studentIds.size;
        }

        if (D.totalStudentsStat) D.totalStudentsStat.textContent = totalStudents;
        if (D.onTrackStat) D.onTrackStat.textContent = onTrack;
        if (D.behindScheduleStat) D.behindScheduleStat.textContent = behind;
        if (D.needsAttentionStat) D.needsAttentionStat.textContent = needsAttention;

        // Placeholder for recent activity and upcoming events
        if(D.recentActivityContainer) D.recentActivityContainer.innerHTML = '<p class="text-gray-500 text-sm">No recent activity to display.</p>';
        if(D.upcomingEventsContainer) D.upcomingEventsContainer.innerHTML = '<p class="text-gray-500 text-sm">No upcoming deadlines or meetings.</p>';

    } catch (error) {
        console.error('supervisor.js: Error loading overview data:', error);
        showSupervisorToast('Failed to load overview statistics.', 'error');
    }
}

async function loadMyStudents() {
    if (!supCurrentUser || !SupervisorDOM.studentListContainer || !supSupabaseClient) return;
    SupervisorDOM.studentListContainer.innerHTML = '<p class="p-4 text-gray-500">Loading your students...</p>';
    try {
        const { data: supervised, error } = await supSupabaseClient
            .from('project_supervisors')
            .select(`
                projects!inner (
                    id, title, status,
                    students!inner ( id, user_id, users!inner(email, raw_user_meta_data) ),
                    supervisions!inner ( overall_status, meetings(scheduled_date_time), supervision_program_templates(name) )
                )
            `)
            .eq('supervisor_user_id', supCurrentUser.id)
            .eq('projects.supervisions.organization_id', supUserOrgData.organization.id) // Filter by org
            .order('created_at', { foreignTable: 'projects', ascending: false });


        if (error) throw error;

        if (supervised && supervised.length > 0) {
            let html = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project Title</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overall Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Meeting</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr></thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

            supervised.forEach(sp_join => {
                const project = sp_join.projects;
                if (!project || !project.students || !project.students.users) return;

                const studentUser = project.students.users;
                const studentFullName = studentUser.raw_user_meta_data?.full_name || studentUser.email;
                const studentAvatarName = studentUser.raw_user_meta_data?.full_name || studentUser.email.split('@')[0] || 'S';

                const supervision = project.supervisions && project.supervisions.length > 0 ? project.supervisions[0] : null;
                const programName = supervision?.supervision_program_templates?.name || 'N/A';
                const overallStatus = supervision?.overall_status || 'N/A';

                // Find the most recent meeting for this supervision
                let lastMeetingDate = 'N/A';
                if (supervision && supervision.meetings && supervision.meetings.length > 0) {
                    const sortedMeetings = supervision.meetings.sort((a,b) => new Date(b.scheduled_date_time) - new Date(a.scheduled_date_time));
                    lastMeetingDate = new Date(sortedMeetings[0].scheduled_date_time).toLocaleDateString();
                }

                html += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 h-10 w-10">
                                    <img class="h-10 w-10 rounded-full" src="https://ui-avatars.com/api/?name=${encodeURIComponent(studentAvatarName)}&background=random&color=fff" alt="${studentFullName}">
                                </div>
                                <div class="ml-4">
                                    <div class="text-sm font-medium text-gray-900">${studentFullName}</div>
                                    <div class="text-sm text-gray-500">${studentUser.email || ''}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4"><div class="text-sm text-gray-900">${project.title}</div></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${programName}</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="status-pill ${getStatusClass(overallStatus)}">${overallStatus}</span></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lastMeetingDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-800" onclick="viewStudentDetails('${project.students.id}', '${project.id}')">Details</button>
                        </td>
                    </tr>`;
            });
            html += `</tbody></table>`;
            SupervisorDOM.studentListContainer.innerHTML = html;
        } else {
            SupervisorDOM.studentListContainer.innerHTML = '<p class="p-4 text-gray-500">You are not currently supervising any students/projects.</p>';
        }
    } catch (error) {
        console.error('supervisor.js: Error loading supervised students:', error);
        SupervisorDOM.studentListContainer.innerHTML = '<p class="p-4 text-red-500">Failed to load student list.</p>';
    }
}

function getStatusClass(status) { /* ... same as admin.js ... */
    if (!status) return 'bg-gray-200 text-gray-800';
    status = status.toLowerCase();
    if (status.includes('on track')) return 'status-on-track'; // Ensure these classes are in index.html's <style>
    if (status.includes('behind')) return 'status-behind';
    if (status.includes('attention')) return 'status-attention';
    if (status.includes('planning')) return 'bg-blue-100 text-blue-800';
    if (status.includes('completed')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-700';
}

window.viewStudentDetails = function(studentProfileId, projectId) {
    console.log(`supervisor.js: View details for student profile ID ${studentProfileId}, project ID ${projectId}`);
    // This would typically navigate to a detailed student page or open a large modal.
    showSupervisorToast(`Student Details (Profile: ${studentProfileId}, Project: ${projectId}) - TBD`, 'info');
};

async function loadMyMeetings() {
    if (!supCurrentUser || !SupervisorDOM.upcomingMeetingsListContainer || !supSupabaseClient) return;
    SupervisorDOM.upcomingMeetingsListContainer.innerHTML = '<p class="text-gray-500">Loading upcoming meetings...</p>';
    try {
        const today = new Date().toISOString();
        const { data: meetings, error } = await supSupabaseClient
            .from('meetings')
            .select(`
                id, scheduled_date_time, purpose, status,
                supervisions!inner (
                    project_id,
                    projects!inner ( title, students!inner (user_id, users!inner(email, raw_user_meta_data)) ),
                    project_supervisors!inner (supervisor_user_id)
                )
            `)
            .eq('supervisions.project_supervisors.supervisor_user_id', supCurrentUser.id)
            .eq('supervisions.organization_id', supUserOrgData.organization.id)
            .gte('scheduled_date_time', today)
            .order('scheduled_date_time', { ascending: true })
            .limit(10);

        if (error) throw error;

        if (meetings && meetings.length > 0) {
            SupervisorDOM.upcomingMeetingsListContainer.innerHTML = meetings.map(m => {
                const studentUser = m.supervisions.projects.students.users;
                const studentName = studentUser.raw_user_meta_data?.full_name || studentUser.email;
                const projectTitle = m.supervisions.projects.title;
                return `
                <div class="p-3 mb-2 border rounded-md hover:bg-gray-50">
                    <p class="font-semibold text-gray-800">${studentName} - ${projectTitle}</p>
                    <p class="text-sm text-blue-600">${new Date(m.scheduled_date_time).toLocaleString()} (${m.status || 'Scheduled'})</p>
                    <p class="text-xs text-gray-600">${m.purpose || 'No purpose specified.'}</p>
                </div>`;
            }).join('');
        } else {
            SupervisorDOM.upcomingMeetingsListContainer.innerHTML = '<p class="text-gray-500">No upcoming meetings scheduled.</p>';
        }
    } catch (error) {
        console.error('supervisor.js: Error loading upcoming meetings:', error);
        SupervisorDOM.upcomingMeetingsListContainer.innerHTML = '<p class="text-red-500">Failed to load meetings.</p>';
    }
}

async function loadMeetingsForDate(date) {
    if (!supCurrentUser || !SupervisorDOM.meetingsForSelectedDate || !supSupabaseClient) return;
    const dateStr = (date instanceof Date) ? date.toISOString().split('T')[0] : date.split('T')[0];
    SupervisorDOM.meetingsForSelectedDate.innerHTML = `<p class="text-gray-500">Loading meetings for ${dateStr}...</p>`;
    try {
        const nextDayStr = new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: meetings, error } = await supSupabaseClient
            .from('meetings')
            .select(`
                id, scheduled_date_time, purpose, status,
                supervisions!inner (
                    project_id,
                    projects!inner ( title, students!inner (user_id, users!inner(email, raw_user_meta_data)) ),
                    project_supervisors!inner (supervisor_user_id)
                )
            `)
            .eq('supervisions.project_supervisors.supervisor_user_id', supCurrentUser.id)
            .eq('supervisions.organization_id', supUserOrgData.organization.id)
            .gte('scheduled_date_time', `${dateStr}T00:00:00.000Z`)
            .lt('scheduled_date_time', `${nextDayStr}T00:00:00.000Z`)
            .order('scheduled_date_time', { ascending: true });

        if (error) throw error;
        if (meetings && meetings.length > 0) {
             SupervisorDOM.meetingsForSelectedDate.innerHTML = meetings.map(m => { /* ... similar to upcoming ... */
                const studentUser = m.supervisions.projects.students.users;
                const studentName = studentUser.raw_user_meta_data?.full_name || studentUser.email;
                const projectTitle = m.supervisions.projects.title;
                return `
                <div class="p-3 mb-2 border rounded-md hover:bg-gray-50">
                    <p class="font-semibold text-gray-800">${studentName} - ${projectTitle}</p>
                    <p class="text-sm text-blue-600">${new Date(m.scheduled_date_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (${m.status || 'Scheduled'})</p>
                    <p class="text-xs text-gray-600">${m.purpose || 'No purpose.'}</p>
                </div>`;
            }).join('');
        } else {
            SupervisorDOM.meetingsForSelectedDate.innerHTML = `<p class="text-gray-500">No meetings scheduled for ${dateStr}.</p>`;
        }
     } catch (error) {
        console.error('supervisor.js: Error loading meetings for date:', error);
        SupervisorDOM.meetingsForSelectedDate.innerHTML = `<p class="text-red-500">Failed to load meetings for ${dateStr}.</p>`;
     }
}

async function loadProgressTrackingData() { /* ... same as admin.js, but filter data by supervisor_id ... */
    if (!supCurrentUser || !supSupabaseClient) return;
    console.log('supervisor.js: Loading data for progress tracking charts...');
    const projectPhases = { 'Planning':0, 'On Track': 0, 'Behind Schedule': 0, 'Needs Attention': 0, 'Completed': 0 };
    let attendedMeetings = 0;
    let missedMeetings = 0; // This would require tracking meeting attendance status

    try {
        const { data: supervised, error } = await supSupabaseClient
            .from('project_supervisors')
            .select('projects!inner(supervisions!inner(overall_status, meetings(status)))')
            .eq('supervisor_user_id', supCurrentUser.id)
            .eq('projects.supervisions.organization_id', supUserOrgData.organization.id);

        if (error) throw error;

        supervised.forEach(s_join => {
            const project = s_join.projects;
            if (project && project.supervisions && project.supervisions.length > 0) {
                const supervision = project.supervisions[0];
                const status = supervision.overall_status;
                if (projectPhases[status] !== undefined) projectPhases[status]++;
                else projectPhases['Other'] = (projectPhases['Other'] || 0) + 1;

                if (supervision.meetings && supervision.meetings.length > 0) {
                    supervision.meetings.forEach(meeting => {
                        if (meeting.status === 'Completed' || meeting.status === 'Attended') attendedMeetings++;
                        else if (meeting.status === 'Missed' || meeting.status === 'Cancelled') missedMeetings++;
                    });
                }
            }
        });

        renderSupervisorProjectPhaseChart(projectPhases);
        renderSupervisorAttendanceChart(attendedMeetings, missedMeetings);

    } catch (error) {
        console.error('supervisor.js: Error loading data for progress charts:', error);
        showSupervisorToast('Failed to load progress chart data.', 'error');
    }
}

function renderSupervisorProjectPhaseChart(phaseData) { /* ... same as admin.js ... */
    if (!SupervisorDOM.supervisorProjectPhaseChartCanvas) return;
    const ctx = SupervisorDOM.supervisorProjectPhaseChartCanvas.getContext('2d');
    if (supProjectPhaseChartInstance) supProjectPhaseChartInstance.destroy();
    supProjectPhaseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(phaseData),
            datasets: [{ data: Object.values(phaseData), backgroundColor: ['#2196F3', '#4CAF50', '#FFC107', '#F44336', '#9C27B0', '#7895CB'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}
function renderSupervisorAttendanceChart(attended, missed) { /* ... same as admin.js ... */
    if (!SupervisorDOM.supervisorAttendanceChartCanvas) return;
    const ctx = SupervisorDOM.supervisorAttendanceChartCanvas.getContext('2d');
    if (supAttendanceChartInstance) supAttendanceChartInstance.destroy();
    supAttendanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Meeting Attendance'],
            datasets: [
                { label: 'Attended/Completed', data: [attended], backgroundColor: '#10B981' },
                { label: 'Missed/Cancelled', data: [missed], backgroundColor: '#EF4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, stacked: true }, x: { stacked: true } } }
    });
}

async function handleAddStudentSubmit(e) {
    e.preventDefault();
    if (!supCurrentUser || !supUserOrgData || !supSupabaseClient) return;
    const form = e.target;
    // Logic for searching existing student vs. quick adding new one
    const searchEmail = form.studentSearchExisting.value.trim();
    const newStudentFullName = form.newStudentFullName.value.trim();
    const newStudentEmail = form.newStudentEmail.value.trim();
    const newProjectTitle = form.newStudentProjectTitle.value.trim();

    showSupervisorToast('Processing student assignment...', 'info');

    try {
        let studentAuthId;
        let studentProfileId;

        if (searchEmail) { // Priority to searching existing student
            const { data: foundUser, error: searchErr } = await supSupabaseClient
                .from('users')
                .select('id')
                .eq('email', searchEmail)
                .single();
            if (searchErr && searchErr.code !== 'PGRST116') throw searchErr;

            if (foundUser) {
                studentAuthId = foundUser.id;
                // Check if a student profile exists for this user in this org
                const {data: foundStudentProfile, error: spErr} = await supSupabaseClient
                    .from('students')
                    .select('id')
                    .eq('user_id', studentAuthId)
                    .eq('organization_id', supUserOrgData.organization.id)
                    .single();
                if(spErr && spErr.code !== 'PGRST116') throw spErr;
                if(foundStudentProfile) studentProfileId = foundStudentProfile.id;
                else { // Create student profile if user exists but profile doesn't for this org
                     const { data: newSP, error: newSPErr } = await supSupabaseClient.from('students').insert({ user_id: studentAuthId, organization_id: supUserOrgData.organization.id, student_identifier: searchEmail }).select('id').single();
                     if(newSPErr) throw newSPErr;
                     studentProfileId = newSP.id;
                }
                if (!newProjectTitle) { // If assigning existing student, project title might be optional if they already have projects
                    showSupervisorToast('Please provide a project title to assign to this existing student.', 'error'); return;
                }
            } else {
                showSupervisorToast(`No user found with email ${searchEmail}. Try Quick Add.`, 'error'); return;
            }
        } else if (newStudentFullName && newStudentEmail && newProjectTitle) { // Quick Add
            // Admin should ideally invite them. For supervisor "quick add", this is simplified.
            // Check if user exists by email first for quick add
            const { data: existingUser, error: qSearchErr } = await supSupabaseClient.from('users').select('id').eq('email', newStudentEmail).single();
            if(qSearchErr && qSearchErr.code !== 'PGRST116') throw qSearchErr;

            if(existingUser) {
                 studentAuthId = existingUser.id;
            } else {
                showSupervisorToast(`Quick Add Error: User ${newStudentEmail} must have an account. Ask admin to invite them.`, 'error', 7000); return;
            }
            // Create student profile
            const { data: qStudentProfile, error: qSPErr } = await supSupabaseClient.from('students').insert({ user_id: studentAuthId, organization_id: supUserOrgData.organization.id, student_identifier: newStudentEmail }).select('id').single();
            if (qSPErr) throw qSPErr;
            studentProfileId = qStudentProfile.id;

        } else {
            showSupervisorToast('Please either search for an existing student or fill all Quick Add fields.', 'error'); return;
        }

        // Common logic: Create project and link supervision
        const { data: newProject, error: projectErr } = await supSupabaseClient.from('projects').insert({ student_id: studentProfileId, title: newProjectTitle, status: 'Planning', organization_id: supUserOrgData.organization.id }).select('id').single();
        if (projectErr) throw projectErr;

        await supSupabaseClient.from('project_supervisors').insert({ project_id: newProject.id, supervisor_user_id: supCurrentUser.id, is_primary_supervisor: true });
        await supSupabaseClient.from('supervisions').insert({ project_id: newProject.id, overall_status: 'Planning', organization_id: supUserOrgData.organization.id });

        showSupervisorToast('Student assigned/added to a new project successfully!', 'success');
        closeModal(SupervisorDOM.addStudentModal);
        await loadMyStudents();
        await loadOverviewData();
    } catch (error) {
        console.error('supervisor.js: Error adding/assigning student:', error);
        showSupervisorToast(`Operation failed: ${error.message}`, 'error');
    }
}


async function populateFlagIssueStudentSelect() {
    if (!supCurrentUser || !SupervisorDOM.flagStudentSelect || !supSupabaseClient) return;
    try {
        const { data: supervised, error } = await supSupabaseClient
            .from('project_supervisors')
            .select('projects!inner(id, title, students!inner(id, user_id, users!inner(raw_user_meta_data)))')
            .eq('supervisor_user_id', supCurrentUser.id)
            .eq('projects.supervisions.organization_id', supUserOrgData.organization.id); // Ensure projects are within the same org context

        if (error) throw error;

        SupervisorDOM.flagStudentSelect.innerHTML = '<option value="">Select a student/project...</option>';
        const uniqueStudentsProjects = new Map();
        supervised.forEach(sp_join => {
            const project = sp_join.projects;
            if (project && project.students && project.students.users) {
                const studentUser = project.students.users;
                const studentName = studentUser.raw_user_meta_data?.full_name || studentUser.email;
                const key = `${project.students.id}-${project.id}`; // student_profile_id - project_id
                uniqueStudentsProjects.set(key, `${studentName} - Project: ${project.title}`);
            }
        });
        uniqueStudentsProjects.forEach((displayText, valueKey) => {
            const option = document.createElement('option');
            option.value = valueKey; // e.g. "studentProfileUUID-projectUUID"
            option.textContent = displayText;
            SupervisorDOM.flagStudentSelect.appendChild(option);
        });
    } catch (error) {
        console.error('supervisor.js: Error populating student select for flagging:', error);
        SupervisorDOM.flagStudentSelect.innerHTML = '<option value="">Error loading students</option>';
    }
}
// Expose for inline script in index.html to call when flag modal opens
window.supervisorInternal = { populateFlagIssueStudentSelect };


async function handleFlagIssueSubmit(e) {
    e.preventDefault();
    if (!supCurrentUser || !supSupabaseClient) return;
    const form = e.target;
    const selectedStudentProject = form.flagStudentSelect.value; // "studentProfileId-projectId"
    const issueType = form.flagIssueType.value;
    const description = form.flagIssueDescription.value.trim();

    if (!selectedStudentProject || !issueType || !description) {
        showSupervisorToast('Please select student/project, issue type, and provide description.', 'error');
        return;
    }
    const [studentProfileId, projectId] = selectedStudentProject.split('-');
    if(!studentProfileId || !projectId){
        showSupervisorToast('Invalid student/project selection.', 'error'); return;
    }

    showSupervisorToast('Submitting flag...', 'info');
    try {
        // Assuming an 'issues' or 'flags' table:
        // This table needs: student_id (fk to students.id), project_id (fk to projects.id),
        // raised_by_user_id (fk to users.id for supervisor), issue_type, description, status, organization_id.
        const { error: flagErr } = await supSupabaseClient.from('student_issues').insert({
            student_id: studentProfileId, // This should be the ID from your 'students' table (student profile ID)
            project_id: projectId,
            raised_by_user_id: supCurrentUser.id,
            issue_type: issueType,
            description: description,
            status: 'Open', // Initial status
            organization_id: supUserOrgData.organization.id
        });
        if (flagErr) throw flagErr;

        showSupervisorToast('Issue flagged successfully!', 'success');
        closeModal(SupervisorDOM.flagIssueModal);
        await loadStudentAlerts(); // Refresh alerts (if this is where flags are shown)
        await loadDataForVisibleSection('overview'); // Status might change
    } catch (error) {
        console.error('supervisor.js: Error flagging issue:', error);
        showSupervisorToast(`Failed to flag issue: ${error.message}`, 'error');
    }
}

async function loadStudentAlerts() {
    if (!supCurrentUser || !SupervisorDOM.studentAlertsContainer || !supSupabaseClient) return;
    SupervisorDOM.studentAlertsContainer.innerHTML = '<div class="p-3 text-xs text-gray-400">Loading alerts...</div>';
    try {
         const { data: issues, error } = await supSupabaseClient
            .from('student_issues')
            .select(`
                id, description, issue_type, status, created_at,
                students!inner(users!inner(raw_user_meta_data)),
                projects!inner(title)
            `)
            .eq('raised_by_user_id', supCurrentUser.id) // Issues raised by this supervisor
            .eq('organization_id', supUserOrgData.organization.id)
            .eq('status', 'Open') // Only show open issues
            .order('created_at', { ascending: false })
            .limit(5);

        if(error) throw error;

        if(issues && issues.length > 0) {
            let htmlContent = `<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Student Alerts</h3>`;
            htmlContent += issues.map(issue => {
                const studentName = issue.students.users.raw_user_meta_data?.full_name || 'Unknown Student';
                const projectTitle = issue.projects.title;
                return `
                <div class="p-2 mb-1 border-l-4 border-red-500 bg-red-50 rounded-r-md">
                    <p class="text-xs font-semibold text-red-700">${issue.issue_type} for ${studentName} (Project: ${projectTitle})</p>
                    <p class="text-xs text-gray-600">${issue.description.substring(0,50)}...</p>
                </div>`;
            }).join('');
             SupervisorDOM.studentAlertsContainer.innerHTML = htmlContent;
        } else {
            SupervisorDOM.studentAlertsContainer.innerHTML = '<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Student Alerts</h3><div class="p-3 text-xs text-gray-400">No active student alerts.</div>';
        }
    } catch(error) {
        console.error('supervisor.js: Error loading student alerts:', error);
        SupervisorDOM.studentAlertsContainer.innerHTML = '<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Student Alerts</h3><p class="text-xs text-red-400 p-2">Could not load alerts.</p>';
    }
}


async function loadSupervisorProfile() {
    const D = SupervisorDOM;
    const container = document.getElementById('supervisorProfileContent'); // From index.html
    if (!container || !supCurrentUser || !supSupabaseClient) return;
    container.innerHTML = '<p>Loading your profile information...</p>';
    try {
        // Assuming supervisor details are within users.raw_user_meta_data or a separate 'supervisor_profiles' table
        const user = supCurrentUser; // Already fetched
        const profileHtml = `
            <form id="supervisorProfileForm" class="space-y-4">
                <div>
                    <label for="supFullName" class="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" id="supFullName" value="${user.user_metadata?.full_name || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2">
                </div>
                <div>
                    <label for="supEmail" class="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" id="supEmail" value="${user.email || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readonly>
                </div>
                <div>
                    <label for="supDepartment" class="block text-sm font-medium text-gray-700">Department (Optional)</label>
                    <input type="text" id="supDepartment" value="${user.user_metadata?.department || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2">
                </div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Update Profile</button>
            </form>`;
        container.innerHTML = profileHtml;
        document.getElementById('supervisorProfileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newFullName = document.getElementById('supFullName').value;
            const newDepartment = document.getElementById('supDepartment').value;
            try {
                // Updating auth.users.user_metadata requires a Supabase Edge Function or server-side call
                // For client-side, you might only update a public 'supervisor_profiles' table.
                // Here's how you'd conceptually update user_metadata (needs server-side handling or Edge Function)
                const { data, error } = await supSupabaseClient.auth.updateUser({
                    data: { full_name: newFullName, department: newDepartment }
                });
                if (error) throw error;
                showSupervisorToast('Profile updated successfully! (May require page refresh to see changes everywhere)', 'success');
                // Re-fetch current user to update local state if needed, or rely on auth state change
                supCurrentUser.user_metadata.full_name = newFullName; // Optimistic update
                supCurrentUser.user_metadata.department = newDepartment;
                updateSupervisorCommonUI(); // Update header display
            } catch (err) {
                showSupervisorToast(`Profile update failed: ${err.message}`, 'error');
            }
        });
    } catch (error) {
        container.innerHTML = '<p class="text-red-500">Failed to load profile.</p>';
    }
}

function showSupervisorToast(message, type = 'info', duration = 3000) {
    // Using the same toast logic as admin.js for consistency, ensure it's defined or use a shared utility.
    // For this example, I'll assume a similar toastContainer exists and the logic is available.
    // If SupervisorDOM.toastContainer is correctly cached from index.html:
    if (!SupervisorDOM.toastContainer) { console.warn('Supervisor toast container not found'); alert(message); return; }
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden mb-3 p-4`; // Basic Tailwind classes
    // Add animation prep class (e.g., opacity-0 transform translate-x-full)
    toast.classList.add('opacity-0', 'transform', 'translate-x-full', 'transition-all', 'duration-300', 'ease-in-out');


    let iconSvg, titleColor, titleText;
    switch (type) {
        case 'success':
            iconSvg = `<svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
            titleColor = 'text-green-600'; titleText = 'Success'; break;
        case 'error':
            iconSvg = `<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
            titleColor = 'text-red-600'; titleText = 'Error'; break;
        default:
            iconSvg = `<svg class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
            titleColor = 'text-blue-600'; titleText = 'Info'; break;
    }
    toast.innerHTML = `<div class="flex items-start"><div class="flex-shrink-0">${iconSvg}</div><div class="ml-3 w-0 flex-1 pt-0.5"><p class="text-sm font-medium ${titleColor}">${titleText}</p><p class="mt-1 text-sm text-gray-500">${message}</p></div><div class="ml-4 flex-shrink-0 flex"><button onclick="this.closest('#${toastId}').remove()" class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"><span class="sr-only">Close</span>&times;</button></div></div>`;
    SupervisorDOM.toastContainer.prepend(toast);
    requestAnimationFrame(() => { // Ensures initial classes are applied before transition starts
        toast.classList.remove('opacity-0', 'translate-x-full');
        toast.classList.add('opacity-100', 'translate-x-0');
    });
    if (duration > 0) setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-x-0');
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 350); // Remove after transition
    }, duration);
}

window.initializeSupervisorDashboard = initializeSupervisorDashboard;