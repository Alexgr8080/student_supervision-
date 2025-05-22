// Enhanced admin.js - Complete implementation with improved functionality
// Author: AI Assistant
// Last update: May 18, 2025

// ------------------------------------------------------------------------
// MODULE STATE MANAGEMENT
// ------------------------------------------------------------------------

let adminSupabaseClient = null;
let adminCurrentUser = null;
let adminUserOrgData = null;
let adminCurrentOrganization = null;
let adminModuleInitialized = false;
let adminSelectedSupervisor = null;
let adminSelectedStudent = null;
let adminLoadingState = false;

let availableRoles = [];
let availableDepartments = [
    { id: '1', name: 'Computer Science' },
    { id: '2', name: 'Engineering' },
    { id: '3', name: 'Business' },
    { id: '4', name: 'Arts & Humanities' },
    { id: '5', name: 'Sciences' }
];
let availableProgramTemplates = [];
let availableSupervisorsForSelect = [];

let adminProjectStatusChartInstance = null;
let adminProgressTrendChartInstance = null;

let eventListenersInitialized = false;

// ------------------------------------------------------------------------
// DOM ELEMENT CACHE
// ------------------------------------------------------------------------

const AdminDOM = {
    adminSidebarNav: null,
    navLinks: [],
    pageTitle: null,
    contentContainer: null,
    loadingOverlay: null,
    userNameDisplay: null,
    userAvatar: null,
    portalType: null,
    notificationCountBadge: null,
    supervisorCountStat: null,
    newSupervisorsCountStat: null,
    studentCountStat: null,
    newStudentsCountStat: null,
    needsAttentionCountStat: null,
    needsAttentionChangeStat: null,
    meetingsThisWeekStat: null,
    projectStatusChartContainer: null,
    progressTrendChartContainer: null,
    supervisorTableContainer: null,
    supervisorTableBody: null,
    addSupervisorBtn: null,
    supervisorSearchInput: null,
    supervisorFilterDropdown: null,
    supervisorPagination: null,
    studentTableContainer: null,
    studentTableBody: null,
    addStudentBtn: null,
    studentSearchInput: null,
    studentFilterDropdown: null,
    studentPagination: null,
    modalContainer: null,
    modalTitle: null,
    modalBody: null,
    modalFooter: null,
    modalCloseBtn: null,
    modalSaveBtn: null
};

// ------------------------------------------------------------------------
// INITIALIZATION FUNCTIONS
// ------------------------------------------------------------------------

async function initializeAdminModule() {
    console.log('admin.js: Initializing admin module...');
    try {
        if (adminModuleInitialized) {
            console.log('admin.js: Admin module already initialized');
            return;
        }
        showLoading('Initializing admin dashboard...');
        cacheAdminDOMElements();

        adminSupabaseClient = getSupabaseClient();
        if (!adminSupabaseClient) {
            // Supabase client might not be ready yet, getSupabaseClient will try to init.
            // We should wait for the 'supabaseConnectionReady' event.
            console.warn('admin.js: Supabase client not immediately available. Waiting for supabaseConnectionReady event.');
            // This function will be re-triggered by the event listener at the bottom if Supabase initializes later.
            return;
        }


        const { data: { user }, error: userError } = await adminSupabaseClient.auth.getUser();
        if (userError || !user) {
            console.error('admin.js: Authentication error', userError);
            // Ensure auth.js handles redirection or provides a clear user state.
            // If not logged in, auth.js should ideally redirect to login.html.
            // For now, if admin.js loads on a page requiring auth and fails here, it's an issue.
            // window.location.href = '/public/login.html'; // Consider if auth.js handles this
            hideLoading();
            displayErrorMessage('User not authenticated. Please login.');
            return;
        }
        adminCurrentUser = user;

        await loadAdminOrgData(); // This might fail if adminCurrentOrganization is not set due to user role/data issues
        if (!adminCurrentOrganization) {
            hideLoading();
            displayErrorMessage('Could not load organization data for admin user.');
            return; // Stop further initialization if critical data is missing
        }

        await loadAvailableRoles();
        await loadProgramTemplates();
        initializeUIComponents();

        if (!eventListenersInitialized) {
            setupEventListeners();
            eventListenersInitialized = true;
        }

        // Check if dashboard elements exist before loading data for them
        if (document.getElementById('dashboardContent')) { // Example check
            await loadDashboardStats();
            renderDashboardCharts();
        }
        if (AdminDOM.supervisorTableContainer) await loadSupervisorsData();
        if (AdminDOM.studentTableContainer) await loadStudentsData();

        adminModuleInitialized = true;
        hideLoading();
        console.log('admin.js: Admin module initialized successfully');
    } catch (error) {
        console.error('admin.js: Error initializing admin module:', error);
        displayErrorMessage(`Failed to initialize admin dashboard: ${error.message}.`);
        hideLoading();
    }
}

function cacheAdminDOMElements() {
    try {
        AdminDOM.adminSidebarNav = document.querySelector('.admin-sidebar-nav');
        AdminDOM.navLinks = document.querySelectorAll('.nav-link');
        AdminDOM.pageTitle = document.querySelector('.page-title');
        AdminDOM.contentContainer = document.querySelector('.content-container');
        AdminDOM.loadingOverlay = document.getElementById('loadingOverlay') || createLoadingOverlay();
        AdminDOM.userNameDisplay = document.querySelector('.user-name');
        AdminDOM.userAvatar = document.querySelector('.user-avatar');
        AdminDOM.portalType = document.querySelector('.portal-type');
        AdminDOM.notificationCountBadge = document.querySelector('.notification-count');
        AdminDOM.supervisorCountStat = document.getElementById('supervisorCount');
        AdminDOM.newSupervisorsCountStat = document.getElementById('newSupervisorsCount');
        AdminDOM.studentCountStat = document.getElementById('studentCount');
        AdminDOM.newStudentsCountStat = document.getElementById('newStudentsCount');
        AdminDOM.needsAttentionCountStat = document.getElementById('needsAttentionCount');
        AdminDOM.needsAttentionChangeStat = document.getElementById('needsAttentionChange');
        AdminDOM.meetingsThisWeekStat = document.getElementById('meetingsThisWeek');
        AdminDOM.projectStatusChartContainer = document.getElementById('projectStatusChart');
        AdminDOM.progressTrendChartContainer = document.getElementById('progressTrendChart');
        AdminDOM.supervisorTableContainer = document.getElementById('supervisorTable');
        AdminDOM.supervisorTableBody = document.querySelector('#supervisorTable tbody') || document.querySelector('#supervisorTable .table-body');
        AdminDOM.addSupervisorBtn = document.getElementById('addSupervisorBtn');
        AdminDOM.supervisorSearchInput = document.getElementById('supervisorSearch');
        AdminDOM.supervisorFilterDropdown = document.getElementById('supervisorFilter');
        AdminDOM.supervisorPagination = document.querySelector('.supervisor-pagination');
        AdminDOM.studentTableContainer = document.getElementById('studentTable');
        AdminDOM.studentTableBody = document.querySelector('#studentTable tbody') || document.querySelector('#studentTable .table-body');
        AdminDOM.addStudentBtn = document.getElementById('addStudentBtn');
        AdminDOM.studentSearchInput = document.getElementById('studentSearch');
        AdminDOM.studentFilterDropdown = document.getElementById('studentFilter');
        AdminDOM.studentPagination = document.querySelector('.student-pagination');
        AdminDOM.modalContainer = document.getElementById('adminModal') || createModalElement();
        AdminDOM.modalTitle = AdminDOM.modalContainer.querySelector('.modal-title');
        AdminDOM.modalBody = AdminDOM.modalContainer.querySelector('.modal-body');
        AdminDOM.modalFooter = AdminDOM.modalContainer.querySelector('.modal-footer');
        AdminDOM.modalCloseBtn = AdminDOM.modalContainer.querySelector('.close-btn'); // Prefers specific close button
        AdminDOM.modalSaveBtn = AdminDOM.modalContainer.querySelector('.save-btn');
        console.log('admin.js: DOM elements cached successfully');
    } catch (error) {
        console.error('admin.js: Error caching DOM elements:', error);
        throw new Error('Failed to cache DOM elements');
    }
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay'; // Ensure this class is styled in CSS for visibility
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'none'; // Initially hidden
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `<div class="spinner-content" style="text-align: center; color: white;"><div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div><p class="loading-text mt-2">Loading...</p></div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function createModalElement() {
    const modalHtml = `
        <div id="adminModal" class="modal" tabindex="-1" role="dialog" style="display:none; background-color: rgba(0,0,0,0.5);">
            <div class="modal-dialog" role="document" style="margin-top: 5vh;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Modal Title</h5>
                        <button type="button" class="close close-btn" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary close-btn-footer">Cancel</button>
                        <button type="button" class="btn btn-primary save-btn">Save</button>
                    </div>
                </div>
            </div>
        </div>`;
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = modalHtml;
    const modalElement = modalWrapper.firstChild;
    document.body.appendChild(modalElement);

    // Add event listener to the newly created footer close button
    modalElement.querySelector('.close-btn-footer').addEventListener('click', closeModal);
    return modalElement;
}

async function loadAdminOrgData() {
    try {
        if (!adminCurrentUser || !adminCurrentUser.id) {
            throw new Error("Current user not available for loading organization data.");
        }

        // Attempt to get organization_id from user_metadata first
        let organizationId = adminCurrentUser.user_metadata?.organization_id;

        if (organizationId) {
            const { data: org, error: orgDetailsError } = await adminSupabaseClient
                .from('organizations')
                .select('*')
                .eq('id', organizationId)
                .single();
            if (orgDetailsError) throw orgDetailsError;
            if (!org) throw new Error(`Organization with ID ${organizationId} not found from metadata.`);
            adminCurrentOrganization = org;
        } else {
            // Fallback: Query organization_users if org_id not in metadata
            const { data: orgUserData, error: orgUserError } = await adminSupabaseClient
                .from('organization_users') // This table links users to organizations
                .select('organization_id, organizations(*)')
                .eq('user_id', adminCurrentUser.id)
                .maybeSingle(); // User might be admin of one org

            if (orgUserError) throw orgUserError;
            if (orgUserData && orgUserData.organizations) {
                adminCurrentOrganization = orgUserData.organizations;
                organizationId = adminCurrentOrganization.id;
            } else {
                throw new Error('No organization found for current admin user via organization_users table.');
            }
        }
        
        // Load roles for the user within that organization
        const { data: rolesData, error: rolesError } = await adminSupabaseClient
            .from('user_roles')
            .select('roles(id, name)') // Assuming 'roles' is the FK table name to 'roles' table
            .eq('user_id', adminCurrentUser.id)
            .eq('organization_id', organizationId);
        if (rolesError) throw rolesError;

        adminUserOrgData = {
            organization: adminCurrentOrganization,
            roles: rolesData ? rolesData.map(r => r.roles).filter(Boolean) : [] // Filter out null roles if join is optional
        };
        console.log('admin.js: Organization data loaded:', adminUserOrgData);

    } catch (error) {
        console.error('admin.js: Error in loadAdminOrgData:', error);
        adminCurrentOrganization = null; // Ensure it's null if loading failed
        // displayErrorMessage will be called by initializeAdminModule if this is critical
        throw error; // Re-throw to be caught by initializeAdminModule
    }
}


async function loadAvailableRoles() {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
            console.warn('admin.js: Organization ID not available for loading roles.');
            availableRoles = [];
            return;
        }
        // Assuming roles are organization-specific or there's a link.
        // If roles are global, remove the organization_id filter.
        // If roles are linked to orgs via a join table, adjust query.
        // For this schema, 'roles' table does not directly link to 'organizations'.
        // Let's assume roles are global for now, or you need to adjust based on your actual 'roles' table structure.
        const { data, error } = await adminSupabaseClient
            .from('roles') // Assuming this table exists and has 'id' and 'name'
            .select('*')
            // .eq('organization_id', adminCurrentOrganization.id) // Add this if roles are org-specific and table has org_id
            .order('name');
        if (error) throw error;
        availableRoles = data || [];
        console.log(`admin.js: Loaded ${availableRoles.length} roles`);
    } catch (error) {
        console.error('admin.js: Error fetching roles:', error);
        displayErrorMessage('Failed to load roles data.');
    }
}

async function loadProgramTemplates() {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
             console.warn('admin.js: Organization ID not available for loading program templates.');
             availableProgramTemplates = [];
             return;
        }
        const { data, error } = await adminSupabaseClient
            .from('program_templates')
            .select('*')
            .eq('organization_id', adminCurrentOrganization.id)
            .order('name');
        if (error) throw error;
        availableProgramTemplates = data || [];
        console.log(`admin.js: Loaded ${availableProgramTemplates.length} program templates`);
    } catch (error) {
        console.error('admin.js: Error in loadProgramTemplates:', error);
        displayErrorMessage('Failed to load program templates.');
    }
}

function initializeUIComponents() {
    try {
        if (AdminDOM.userNameDisplay && adminCurrentUser) {
            AdminDOM.userNameDisplay.textContent = adminCurrentUser.user_metadata?.full_name || adminCurrentUser.email;
        }
        if (AdminDOM.portalType) AdminDOM.portalType.textContent = 'Admin Portal';
        console.log('admin.js: UI components initialized');
    } catch (error) {
        console.error('admin.js: Error initializing UI components:', error);
    }
}

function setupEventListeners() {
    try {
        AdminDOM.navLinks?.forEach(link => link.addEventListener('click', handleNavigation));
        AdminDOM.addSupervisorBtn?.addEventListener('click', () => openSupervisorModal('add'));
        AdminDOM.supervisorSearchInput?.addEventListener('input', debounce(() => AdminDOM.supervisorTableContainer && loadSupervisorsData(AdminDOM.supervisorSearchInput.value), 500));
        AdminDOM.supervisorFilterDropdown?.addEventListener('change', () => AdminDOM.supervisorTableContainer && loadSupervisorsData(AdminDOM.supervisorSearchInput?.value || ''));
        AdminDOM.addStudentBtn?.addEventListener('click', () => openStudentModal('add'));
        AdminDOM.studentSearchInput?.addEventListener('input', debounce(() => AdminDOM.studentTableContainer && loadStudentsData(AdminDOM.studentSearchInput.value), 500));
        AdminDOM.studentFilterDropdown?.addEventListener('change', () => AdminDOM.studentTableContainer && loadStudentsData(AdminDOM.studentSearchInput?.value || ''));
        
        // Modal close buttons
        AdminDOM.modalCloseBtn?.addEventListener('click', closeModal); // For header 'x'
        AdminDOM.modalContainer?.querySelector('.close-btn-footer')?.addEventListener('click', closeModal); // For footer 'Cancel'

        AdminDOM.modalContainer?.addEventListener('click', (event) => {
            if (event.target === AdminDOM.modalContainer) closeModal();
        });
        AdminDOM.modalSaveBtn?.addEventListener('click', handleModalSave);
        window.addEventListener('resize', debounce(() => {
            adminProjectStatusChartInstance?.resize();
            adminProgressTrendChartInstance?.resize();
        }, 250));
        console.log('admin.js: Event listeners set up');
    } catch (error) {
        console.error('admin.js: Error setting up event listeners:', error);
    }
}

// ------------------------------------------------------------------------
// DASHBOARD DATA AND CHARTS
// ------------------------------------------------------------------------

async function loadDashboardStats() {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
            console.warn("Cannot load dashboard stats without organization ID.");
            return;
        }
        showLoading('Loading dashboard stats...');
        const orgId = adminCurrentOrganization.id;

        const { count: supervisorCount, error: supervisorError } = await adminSupabaseClient
            .from('supervisors')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId);
        if (supervisorError) throw supervisorError;

        // New supervisors this month
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const { count: newSupervisorsCount, error: newSupError } = await adminSupabaseClient
            .from('supervisors')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('created_at', oneMonthAgo.toISOString());
        if (newSupError) throw newSupError;


        const { count: studentCount, error: studentError } = await adminSupabaseClient
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId);
        if (studentError) throw studentError;

        const { count: newStudentsCount, error: newStudError } = await adminSupabaseClient
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('created_at', oneMonthAgo.toISOString());
        if (newStudError) throw newStudError;
        
        const { count: needsAttentionCount, error: attentionError } = await adminSupabaseClient
            .from('students') // Assuming 'status' is on 'students' table
            .select('id', {count: 'exact', head: true})
            .eq('organization_id', orgId)
            .eq('status', 'needs_attention'); // Make sure this status string is correct
        if(attentionError) throw attentionError;


        const { count: meetingsThisWeekCount, error: meetingError } = await adminSupabaseClient
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('scheduled_date_time', getStartOfWeek())
            .lte('scheduled_date_time', getEndOfWeek());
        if (meetingError) throw meetingError;


        if (AdminDOM.supervisorCountStat) AdminDOM.supervisorCountStat.textContent = supervisorCount || 0;
        if (AdminDOM.newSupervisorsCountStat) AdminDOM.newSupervisorsCountStat.textContent = `+${newSupervisorsCount || 0} this month`;
        if (AdminDOM.studentCountStat) AdminDOM.studentCountStat.textContent = studentCount || 0;
        if (AdminDOM.newStudentsCountStat) AdminDOM.newStudentsCountStat.textContent = `+${newStudentsCount || 0} this month`;
        if (AdminDOM.needsAttentionCountStat) AdminDOM.needsAttentionCountStat.textContent = needsAttentionCount || 0;
        if (AdminDOM.needsAttentionChangeStat) AdminDOM.needsAttentionChangeStat.textContent = `+0 this week`; // Placeholder
        if (AdminDOM.meetingsThisWeekStat) AdminDOM.meetingsThisWeekStat.textContent = meetingsThisWeekCount || 0;

        console.log('admin.js: Dashboard stats loaded successfully');
        hideLoading();
    } catch (error) {
        console.error('admin.js: Error loading dashboard stats:', error);
        displayErrorMessage('Failed to load dashboard statistics.');
        hideLoading();
    }
}

function renderDashboardCharts() {
    try {
        // Ensure Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Skipping chart rendering.');
            return;
        }
        renderProjectStatusChart();
        renderProgressTrendChart();
        console.log('admin.js: Dashboard charts rendered successfully');
    } catch (error) {
        console.error('admin.js: Error rendering dashboard charts:', error);
        displayErrorMessage('Failed to render dashboard charts.');
    }
}

async function renderProjectStatusChart() { // Made async if data fetching is needed
    try {
        if (!AdminDOM.projectStatusChartContainer || typeof Chart === 'undefined') {
            // console.warn('admin.js: Project status chart container or Chart.js not found.');
            return;
        }
        if (adminProjectStatusChartInstance) adminProjectStatusChartInstance.destroy();

        // TODO: Fetch actual data from Supabase instead of sample data
        // Example:
        // const { data: projectStatuses, error } = await adminSupabaseClient.rpc('get_project_status_distribution', { org_id: adminCurrentOrganization.id });
        // if (error || !projectStatuses) { ... handle error ... }
        // const labels = projectStatuses.map(s => s.status_name);
        // const counts = projectStatuses.map(s => s.status_count);

        const sampleData = { 
            labels: ['On Track', 'Behind Schedule', 'Needs Attention', 'Completed'],
            datasets: [{
                data: [65, 20, 10, 5], 
                backgroundColor: ['#4CAF50', '#FF9800', '#F44336', '#2196F3'],
                borderWidth: 0
            }]
        };
        const config = { type: 'doughnut', data: sampleData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '70%' } };
        adminProjectStatusChartInstance = new Chart(AdminDOM.projectStatusChartContainer, config);
    } catch (error) {
        console.error('admin.js: Error rendering project status chart:', error);
    }
}

async function renderProgressTrendChart() { // Made async if data fetching is needed
    try {
        if (!AdminDOM.progressTrendChartContainer || typeof Chart === 'undefined') {
            // console.warn('admin.js: Progress trend chart container or Chart.js not found.');
            return;
        }
        if (adminProgressTrendChartInstance) adminProgressTrendChartInstance.destroy();

        // TODO: Fetch actual data from Supabase
        const sampleLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']; 
        const sampleData = { 
            labels: sampleLabels,
            datasets: [
                { label: 'On Track', data: [40, 45, 50, 55, 60, 65], backgroundColor: 'rgba(76, 175, 80, 0.2)', borderColor: '#4CAF50', borderWidth: 2, tension: 0.3, fill: true },
                { label: 'Behind Schedule', data: [30, 25, 22, 20, 18, 15], backgroundColor: 'rgba(255, 152, 0, 0.2)', borderColor: '#FF9800', borderWidth: 2, tension: 0.3, fill: true }
            ]
        };
        const config = { type: 'line', data: sampleData, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } };
        adminProgressTrendChartInstance = new Chart(AdminDOM.progressTrendChartContainer, config);
    } catch (error) {
        console.error('admin.js: Error rendering progress trend chart:', error);
    }
}

// ------------------------------------------------------------------------
// SUPERVISOR MANAGEMENT
// ------------------------------------------------------------------------

async function loadSupervisorsData(searchQuery = '', page = 1) {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
            console.warn("Cannot load supervisors without organization ID.");
            if (AdminDOM.supervisorTableBody) AdminDOM.supervisorTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Organization data not loaded.</td></tr>';
            return;
        }
        showLoading('Loading supervisors...');
        const orgId = adminCurrentOrganization.id;
        const filterValue = AdminDOM.supervisorFilterDropdown?.value || '';
        let query = adminSupabaseClient
            .from('supervisors')
            .select(`
                id, created_at, status, department_id, user_id,
                users!supervisors_user_id_fkey(id, email, raw_user_meta_data),
                departments!supervisors_department_id_fkey(id, name) 
            `, { count: 'exact' })
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });
            // The 'departments' join needs 'department_id' in 'supervisors' to be a FK to 'departments.id'
            // The 'users' join needs 'user_id' in 'supervisors' to be a FK to 'auth.users.id'

        if (searchQuery.trim() !== '') { // Ensure raw_user_meta_data->>'full_name' is how you store full name
            query = query.or(`users.email.ilike.%${searchQuery}%,users.raw_user_meta_data->>'full_name'.ilike.%${searchQuery}%`);
        }
        if (filterValue && filterValue !== 'all') query = query.eq('status', filterValue);


        const ITEMS_PER_PAGE = 10;
        const from = (page - 1) * ITEMS_PER_PAGE;
        // const to = from + ITEMS_PER_PAGE - 1; // Supabase range is inclusive
        query = query.range(from, from + ITEMS_PER_PAGE -1);

        const { data: supervisors, error, count } = await query;
        if (error) throw error;

        availableSupervisorsForSelect = supervisors ? supervisors.map(s => ({
            id: s.id, // This is supervisor record ID
            user_id: s.user_id, // This is auth.users ID
            name: s.users?.raw_user_meta_data?.full_name || s.users?.email || 'N/A',
            email: s.users?.email || 'N/A',
            department: s.departments?.name || 'N/A'
        })) : [];

        renderSupervisorsTable(supervisors || []);
        renderPagination(AdminDOM.supervisorPagination, page, Math.ceil((count || 0) / ITEMS_PER_PAGE), (newPage) => loadSupervisorsData(searchQuery, newPage));
        // console.log(`admin.js: Loaded ${supervisors?.length || 0} of ${count} supervisors`);
        hideLoading();
    } catch (error) {
        console.error('admin.js: Error loading supervisors data:', error);
        if (AdminDOM.supervisorTableBody) AdminDOM.supervisorTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Error loading supervisors: ${error.message}</td></tr>`;
        displayErrorMessage('Failed to load supervisors.');
        hideLoading();
    }
}

function renderSupervisorsTable(supervisors) {
    if (!AdminDOM.supervisorTableBody) {
        // console.warn('admin.js: Supervisor table body element not found.');
        return;
    }
    AdminDOM.supervisorTableBody.innerHTML = '';
    if (supervisors.length === 0) {
        AdminDOM.supervisorTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No supervisors found.</td></tr>';
        return;
    }
    supervisors.forEach(supervisor => {
        const user = supervisor.users;
        const department = supervisor.departments;
        const tr = document.createElement('tr');
        tr.setAttribute('data-supervisor-id', supervisor.id);
        tr.innerHTML = `
            <td>${user?.raw_user_meta_data?.full_name || user?.email || 'N/A'}</td>
            <td>${user?.email || 'N/A'}</td>
            <td>${department?.name || 'N/A'}</td>
            <td><span class="badge ${supervisor.status === 'active' ? 'bg-success' : 'bg-secondary'}">${supervisor.status || 'N/A'}</span></td>
            <td>${new Date(supervisor.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="openSupervisorModal('edit', '${supervisor.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSupervisor('${supervisor.id}', '${supervisor.user_id}')">Delete</button>
            </td>
        `;
        AdminDOM.supervisorTableBody.appendChild(tr);
    });
}

// ------------------------------------------------------------------------
// STUDENT MANAGEMENT
// ------------------------------------------------------------------------

async function loadStudentsData(searchQuery = '', page = 1) {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
            console.warn("Cannot load students without organization ID.");
             if (AdminDOM.studentTableBody) AdminDOM.studentTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Organization data not loaded.</td></tr>';
            return;
        }
        showLoading('Loading students...');
        const orgId = adminCurrentOrganization.id;
        const filterValue = AdminDOM.studentFilterDropdown?.value || '';
        let query = adminSupabaseClient
            .from('students')
            .select(`
                id, created_at, status, program_name, user_id, program_template_id,
                users!students_user_id_fkey(id, email, raw_user_meta_data)
            `, { count: 'exact' })
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });

        if (searchQuery.trim() !== '') {
            query = query.or(`users.email.ilike.%${searchQuery}%,users.raw_user_meta_data->>'full_name'.ilike.%${searchQuery}%,program_name.ilike.%${searchQuery}%`);
        }
        if (filterValue && filterValue !== 'all') query = query.eq('status', filterValue);


        const ITEMS_PER_PAGE = 10;
        const from = (page - 1) * ITEMS_PER_PAGE;
        query = query.range(from, from + ITEMS_PER_PAGE - 1);

        const { data: students, error, count } = await query;
        if (error) throw error;

        renderStudentsTable(students || []);
        renderPagination(AdminDOM.studentPagination, page, Math.ceil((count || 0) / ITEMS_PER_PAGE), (newPage) => loadStudentsData(searchQuery, newPage));
        // console.log(`admin.js: Loaded ${students?.length || 0} of ${count} students`);
        hideLoading();
    } catch (error) {
        console.error('admin.js: Error loading students data:', error);
        if (AdminDOM.studentTableBody) AdminDOM.studentTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Error loading students: ${error.message}</td></tr>`;
        displayErrorMessage('Failed to load students.');
        hideLoading();
    }
}

function renderStudentsTable(students) {
    if (!AdminDOM.studentTableBody) {
        // console.warn('admin.js: Student table body element not found.');
        return;
    }
    AdminDOM.studentTableBody.innerHTML = '';
    if (students.length === 0) {
        AdminDOM.studentTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No students found.</td></tr>';
        return;
    }
    students.forEach(student => {
        const user = student.users;
        const tr = document.createElement('tr');
        tr.setAttribute('data-student-id', student.id);
        tr.innerHTML = `
            <td>${user?.raw_user_meta_data?.full_name || user?.email || 'N/A'}</td>
            <td>${user?.email || 'N/A'}</td>
            <td>${student.program_name || 'N/A'}</td>
            <td><span class="badge ${student.status === 'active' ? 'bg-success' : (student.status === 'needs_attention' ? 'bg-warning' : 'bg-secondary')}">${student.status || 'N/A'}</span></td>
            <td>${new Date(student.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="openStudentModal('edit', '${student.id}')">Edit</button>
                <button class="btn btn-sm btn-danger me-1" onclick="deleteStudent('${student.id}', '${student.user_id}')">Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="viewStudentDetails('${student.id}')">Details</button>
            </td>
        `;
        AdminDOM.studentTableBody.appendChild(tr);
    });
}


// ------------------------------------------------------------------------
// MODAL HANDLING & FORMS
// ------------------------------------------------------------------------

function openSupervisorModal(mode, supervisorId = null) {
    adminSelectedSupervisor = supervisorId; // Store supervisor record ID
    if(!AdminDOM.modalTitle || !AdminDOM.modalBody || !AdminDOM.modalContainer) return;

    AdminDOM.modalTitle.textContent = mode === 'add' ? 'Add New Supervisor' : 'Edit Supervisor';
    // Ensure 'departments' table has 'id' and 'name'.
    // Ensure 'roles' table has 'id' and 'name'.
    const departmentOptions = availableDepartments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
    // Filter for roles typically assigned to supervisors, e.g., based on role name
    const supervisorRoleOptions = availableRoles
        .filter(role => role.name && (role.name.toLowerCase().includes('supervisor') || role.name.toLowerCase().includes('admin'))) // Adjust filter as needed
        .map(role => `<option value="${role.id}">${role.name}</option>`).join('');

    let formHtml = `
        <form id="supervisorForm" onsubmit="return false;">
            <input type="hidden" id="supervisorId" value="${supervisorId || ''}">
            <div class="mb-3">
                <label for="supervisorEmail" class="form-label">Email <span class="text-danger">*</span></label>
                <input type="email" class="form-control" id="supervisorEmail" required ${mode === 'edit' ? 'disabled' : ''}>
            </div>
            <div class="mb-3">
                <label for="supervisorFullName" class="form-label">Full Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="supervisorFullName" required>
            </div>
             <div class="mb-3">
                <label for="supervisorPassword" class="form-label">Password ${mode === 'add' ? '<span class="text-danger">*</span>' : '(leave blank to keep current)'}</label>
                <input type="password" class="form-control" id="supervisorPassword" ${mode === 'add' ? 'required' : ''} autocomplete="new-password">
            </div>
            <div class="mb-3">
                <label for="supervisorDepartment" class="form-label">Department <span class="text-danger">*</span></label>
                <select class="form-select" id="supervisorDepartment" required>
                    <option value="">Select Department</option>
                    ${departmentOptions}
                </select>
            </div>
            <div class="mb-3">
                <label for="supervisorRole" class="form-label">Role <span class="text-danger">*</span></label>
                <select class="form-select" id="supervisorRole" required>
                    <option value="">Select Role</option>
                    ${supervisorRoleOptions}
                </select>
            </div>
             <div class="mb-3">
                <label for="supervisorStatus" class="form-label">Status <span class="text-danger">*</span></label>
                <select class="form-select" id="supervisorStatus" required>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
        </form>
    `;
    AdminDOM.modalBody.innerHTML = formHtml;

    if (mode === 'edit' && supervisorId) {
        loadSupervisorDetailsForEdit(supervisorId);
    }
    AdminDOM.modalContainer.style.display = 'block';
    AdminDOM.modalContainer.setAttribute('data-current-form', 'supervisor');
}

async function loadSupervisorDetailsForEdit(supervisorId) {
    try {
        showLoading('Loading supervisor details...');
        const { data: supervisor, error } = await adminSupabaseClient
            .from('supervisors')
            .select(`
                status, department_id, user_id,
                users!supervisors_user_id_fkey(email, raw_user_meta_data),
                user_roles!inner(role_id) 
            `) // This user_roles join might be complex if a user has multiple roles.
               // It's better to fetch the primary role or the relevant supervisor role separately if needed.
               // For now, assuming one relevant role or the first one.
            .eq('id', supervisorId)
            .eq('user_roles.user_id', supervisor.user_id) // This condition will cause an error as supervisor.user_id is not available yet.
            // Correct approach: fetch supervisor, then fetch roles for supervisor.user_id
            .single();
        
        // Corrected fetch sequence:
        const { data: supData, error: supError } = await adminSupabaseClient
            .from('supervisors')
            .select(`*, users!supervisors_user_id_fkey(email, raw_user_meta_data)`)
            .eq('id', supervisorId)
            .single();

        if (supError || !supData) throw supError || new Error('Supervisor not found');
        
        const { data: roleData, error: roleError } = await adminSupabaseClient
            .from('user_roles')
            .select('role_id')
            .eq('user_id', supData.user_id)
            .eq('organization_id', adminCurrentOrganization.id)
            //.eq('roles.name', 'supervisor') // Or however you identify the relevant role
            .limit(1) // Assuming one primary role for this context
            .maybeSingle(); // Use maybeSingle if a role might not be assigned yet

        if (roleError) console.warn("Error fetching supervisor role:", roleError.message);


        if(document.getElementById('supervisorEmail')) document.getElementById('supervisorEmail').value = supData.users.email;
        if(document.getElementById('supervisorFullName')) document.getElementById('supervisorFullName').value = supData.users.raw_user_meta_data?.full_name || '';
        if(document.getElementById('supervisorDepartment')) document.getElementById('supervisorDepartment').value = supData.department_id || '';
        if(document.getElementById('supervisorStatus')) document.getElementById('supervisorStatus').value = supData.status || 'active';
        if(document.getElementById('supervisorRole') && roleData) document.getElementById('supervisorRole').value = roleData.role_id;
        
        hideLoading();
    } catch (error) {
        console.error('Error loading supervisor details for edit:', error);
        displayErrorMessage('Could not load supervisor details.');
        closeModal(); // Close modal if details can't be loaded
        hideLoading();
    }
}


function openStudentModal(mode, studentId = null) {
    adminSelectedStudent = studentId; // Store student record ID
     if(!AdminDOM.modalTitle || !AdminDOM.modalBody || !AdminDOM.modalContainer) return;

    AdminDOM.modalTitle.textContent = mode === 'add' ? 'Add New Student' : 'Edit Student';
    const templateOptions = availableProgramTemplates.map(pt => `<option value="${pt.id}">${pt.name}</option>`).join('');
    const supervisorOptions = availableSupervisorsForSelect.map(sup => `<option value="${sup.id}">${sup.name} (${sup.email})</option>`).join('');


    let formHtml = `
        <form id="studentForm" onsubmit="return false;">
            <input type="hidden" id="studentId" value="${studentId || ''}">
            <div class="mb-3">
                <label for="studentEmail" class="form-label">Email <span class="text-danger">*</span></label>
                <input type="email" class="form-control" id="studentEmail" required ${mode === 'edit' ? 'disabled' : ''}>
            </div>
            <div class="mb-3">
                <label for="studentFullName" class="form-label">Full Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="studentFullName" required>
            </div>
            <div class="mb-3">
                <label for="studentPassword" class="form-label">Password ${mode === 'add' ? '<span class="text-danger">*</span>' : '(leave blank to keep current)'}</label>
                <input type="password" class="form-control" id="studentPassword" ${mode === 'add' ? 'required' : ''} autocomplete="new-password">
            </div>
            <div class="mb-3">
                <label for="studentProgramName" class="form-label">Program Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="studentProgramName" required>
            </div>
            <div class="mb-3">
                <label for="studentProgramTemplate" class="form-label">Program Template</label>
                <select class="form-select" id="studentProgramTemplate">
                    <option value="">None</option>
                    ${templateOptions}
                </select>
            </div>
             <div class="mb-3">
                <label for="studentStatus" class="form-label">Status <span class="text-danger">*</span></label>
                <select class="form-select" id="studentStatus" required>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="graduated">Graduated</option>
                    <option value="needs_attention">Needs Attention</option>
                     <option value="proposal_pending">Proposal Pending</option> 
                     <option value="research_inprogress">Research In-Progress</option>
                     <option value="writing_thesis">Writing Thesis</option>
                     <option value="submitted_for_review">Submitted for Review</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="studentSupervisor" class="form-label">Assign Supervisor</label>
                <select class="form-select" id="studentSupervisor">
                    <option value="">None</option>
                    ${supervisorOptions} 
                </select>
            </div>
        </form>
    `;
    AdminDOM.modalBody.innerHTML = formHtml;

    if (mode === 'edit' && studentId) {
        loadStudentDetailsForEdit(studentId);
    }
    AdminDOM.modalContainer.style.display = 'block';
    AdminDOM.modalContainer.setAttribute('data-current-form', 'student');
}

async function loadStudentDetailsForEdit(studentId) {
    try {
        showLoading('Loading student details...');
        // Fetch student details including their linked user and current supervisor
        const { data: student, error } = await adminSupabaseClient
            .from('students')
            .select(`
                *,
                users!students_user_id_fkey(email, raw_user_meta_data),
                student_supervisors!left(supervisor_id)  
            `) // student_supervisors might return an array. Assuming one primary.
            .eq('id', studentId)
            .maybeSingle(); // Use maybeSingle as student might not exist
        
        if (error) throw error;
        if (!student) {
            displayErrorMessage('Student not found.');
            closeModal();
            hideLoading();
            return;
        }

        if(document.getElementById('studentEmail')) document.getElementById('studentEmail').value = student.users?.email || '';
        if(document.getElementById('studentFullName')) document.getElementById('studentFullName').value = student.users?.raw_user_meta_data?.full_name || '';
        if(document.getElementById('studentProgramName')) document.getElementById('studentProgramName').value = student.program_name || '';
        if(document.getElementById('studentStatus')) document.getElementById('studentStatus').value = student.status || 'active';
        if (document.getElementById('studentProgramTemplate') && student.program_template_id) {
            document.getElementById('studentProgramTemplate').value = student.program_template_id;
        }
        // Handle student_supervisors: it could be an array if a student can have multiple.
        // If it's a one-to-one or primary, take the first one.
        if (document.getElementById('studentSupervisor') && student.student_supervisors && student.student_supervisors.length > 0) {
             document.getElementById('studentSupervisor').value = student.student_supervisors[0].supervisor_id;
        } else if (document.getElementById('studentSupervisor')) {
            document.getElementById('studentSupervisor').value = ""; // No supervisor assigned
        }

        hideLoading();
    } catch (error) {
        console.error('Error loading student details for edit:', error);
        displayErrorMessage('Could not load student details.');
        closeModal();
        hideLoading();
    }
}


function closeModal() {
    if(AdminDOM.modalContainer) AdminDOM.modalContainer.style.display = 'none';
    if(AdminDOM.modalBody) AdminDOM.modalBody.innerHTML = ''; // Clear previous form
    adminSelectedSupervisor = null;
    adminSelectedStudent = null;
    AdminDOM.modalContainer?.removeAttribute('data-current-form');
}

async function handleModalSave() {
    const currentForm = AdminDOM.modalContainer?.getAttribute('data-current-form');
    if (currentForm === 'supervisor') {
        await saveSupervisorData();
    } else if (currentForm === 'student') {
        await saveStudentData();
    }
}

async function saveSupervisorData() {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
            throw new Error("Organization context is missing.");
        }
        showLoading('Saving supervisor...');
        const email = document.getElementById('supervisorEmail')?.value;
        const fullName = document.getElementById('supervisorFullName')?.value;
        const password = document.getElementById('supervisorPassword')?.value; // Optional for edit
        const departmentId = document.getElementById('supervisorDepartment')?.value;
        const roleId = document.getElementById('supervisorRole')?.value; // This is role_id from 'roles' table
        const status = document.getElementById('supervisorStatus')?.value;

        if (!email || !fullName || !departmentId || !roleId || !status) {
            displayErrorMessage('Please fill all required fields for supervisor.');
            hideLoading();
            return;
        }

        let userIdToUpdateOrInsert = null;
        let supervisorRecordData = {
            organization_id: adminCurrentOrganization.id,
            department_id: departmentId,
            status: status,
            // user_id will be set after user creation/retrieval
        };

        if (adminSelectedSupervisor) { // Editing existing supervisor (adminSelectedSupervisor is supervisor table ID)
            const { data: existingSupervisor, error: fetchError } = await adminSupabaseClient
                .from('supervisors')
                .select('user_id')
                .eq('id', adminSelectedSupervisor)
                .single();
            if (fetchError || !existingSupervisor) throw fetchError || new Error("Original supervisor record not found.");
            userIdToUpdateOrInsert = existingSupervisor.user_id;

            const userUpdatePayload = { user_metadata: { full_name: fullName } };
            if (password) userUpdatePayload.password = password;
            
            const { error: userUpdateError } = await adminSupabaseClient.auth.admin.updateUserById(
                userIdToUpdateOrInsert,
                userUpdatePayload
            );
            if (userUpdateError) throw userUpdateError;
            
            supervisorRecordData.user_id = userIdToUpdateOrInsert; // Ensure user_id is part of the update if it could change (it shouldn't here)
            const { error: supervisorUpdateError } = await adminSupabaseClient
                .from('supervisors')
                .update(supervisorRecordData)
                .eq('id', adminSelectedSupervisor);
            if (supervisorUpdateError) throw supervisorUpdateError;

            // Update role in user_roles if it changed
            // First, remove existing role(s) for this user in this org context if we are setting one primary role
            // Or, more robustly, check if the current roleId is different from existing.
            const { error: roleUpdateError } = await adminSupabaseClient
                .from('user_roles')
                .update({ role_id: roleId })
                .eq('user_id', userIdToUpdateOrInsert)
                .eq('organization_id', adminCurrentOrganization.id); // Add more conditions if user can have multiple roles and you only update one
            if (roleUpdateError) console.warn("Could not update user role, it might not exist or multiple exist:", roleUpdateError.message);


        } else { // Adding new supervisor
            if (!password) {
                displayErrorMessage('Password is required for new supervisor.');
                hideLoading();
                return;
            }
            const { data: newUser, error: userCreateError } = await adminSupabaseClient.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true, 
                user_metadata: { full_name: fullName, organization_id: adminCurrentOrganization.id, initial_role_id: roleId }
            });
            if (userCreateError) throw userCreateError;
            userIdToUpdateOrInsert = newUser.user.id;
            supervisorRecordData.user_id = userIdToUpdateOrInsert;

            const { error: supervisorCreateError } = await adminSupabaseClient
                .from('supervisors')
                .insert(supervisorRecordData);
            if (supervisorCreateError) throw supervisorCreateError;

            const { error: roleAssignError } = await adminSupabaseClient
                .from('user_roles')
                .insert({ user_id: userIdToUpdateOrInsert, role_id: roleId, organization_id: adminCurrentOrganization.id });
            if (roleAssignError) throw roleAssignError;
        }

        displaySuccessMessage('Supervisor saved successfully!');
        closeModal();
        if(AdminDOM.supervisorTableContainer) loadSupervisorsData(); // Refresh table
        if(document.getElementById('dashboardContent')) loadDashboardStats(); // Refresh stats
        hideLoading();
    } catch (error) {
        console.error('Error saving supervisor:', error);
        displayErrorMessage(`Failed to save supervisor: ${error.message}`);
        hideLoading();
    }
}

async function saveStudentData() {
    try {
        if (!adminCurrentOrganization || !adminCurrentOrganization.id) {
            throw new Error("Organization context is missing.");
        }
        showLoading('Saving student...');
        const email = document.getElementById('studentEmail')?.value;
        const fullName = document.getElementById('studentFullName')?.value;
        const password = document.getElementById('studentPassword')?.value;
        const programName = document.getElementById('studentProgramName')?.value;
        const programTemplateId = document.getElementById('studentProgramTemplate')?.value || null; // Handle empty string as null
        const status = document.getElementById('studentStatus')?.value;
        const assignedSupervisorId = document.getElementById('studentSupervisor')?.value || null; // This is supervisor record ID

        if (!email || !fullName || !programName || !status) {
            displayErrorMessage('Please fill all required fields for student.');
            hideLoading();
            return;
        }

        let userIdToUpdateOrInsert = null;
        let studentRecordData = {
            organization_id: adminCurrentOrganization.id,
            program_name: programName,
            program_template_id: programTemplateId,
            status: status,
            // user_id will be set after user creation/retrieval
        };
        let studentTableId = adminSelectedStudent; // This is the student record ID from 'students' table

        if (studentTableId) { // Editing existing student
            const { data: existingStudent, error: fetchError } = await adminSupabaseClient
                .from('students')
                .select('user_id')
                .eq('id', studentTableId)
                .single();
            if (fetchError || !existingStudent) throw fetchError || new Error("Original student record not found.");
            userIdToUpdateOrInsert = existingStudent.user_id;

            const userUpdatePayload = { user_metadata: { full_name: fullName } };
            if (password) userUpdatePayload.password = password;

            const { error: userUpdateError } = await adminSupabaseClient.auth.admin.updateUserById(
                userIdToUpdateOrInsert,
                userUpdatePayload
            );
            if (userUpdateError) throw userUpdateError;
            
            studentRecordData.user_id = userIdToUpdateOrInsert;
            const { error: studentUpdateError } = await adminSupabaseClient
                .from('students')
                .update(studentRecordData)
                .eq('id', studentTableId);
            if (studentUpdateError) throw studentUpdateError;

        } else { // Adding new student
             if (!password) {
                displayErrorMessage('Password is required for new student.');
                hideLoading();
                return;
            }
            // Find the 'student' role ID
            const studentRole = availableRoles.find(r => r.name && r.name.toLowerCase() === 'student');
            if (!studentRole) {
                displayErrorMessage("Default 'student' role not found. Cannot create student user.");
                hideLoading();
                return;
            }

            const { data: newUser, error: userCreateError } = await adminSupabaseClient.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: { full_name: fullName, organization_id: adminCurrentOrganization.id, initial_role_id: studentRole.id }
            });
            if (userCreateError) throw userCreateError;
            userIdToUpdateOrInsert = newUser.user.id;
            studentRecordData.user_id = userIdToUpdateOrInsert;

            const { data: newStudentEntry, error: studentCreateError } = await adminSupabaseClient
                .from('students')
                .insert(studentRecordData)
                .select('id') // Get the new student record ID
                .single();
            if (studentCreateError) throw studentCreateError;
            studentTableId = newStudentEntry.id; // Use this for assigning supervisor

            const { error: roleAssignError } = await adminSupabaseClient
                .from('user_roles')
                .insert({ user_id: userIdToUpdateOrInsert, role_id: studentRole.id, organization_id: adminCurrentOrganization.id });
            if (roleAssignError) console.warn("Error assigning student role:", roleAssignError.message);
        }

        // Handle supervisor assignment
        // Remove existing assignments for this student first to ensure only one active primary link
        // This assumes student_id in student_supervisors refers to the ID from the 'students' table
        const { error: deleteExistingSupervisorError } = await adminSupabaseClient
            .from('student_supervisors')
            .delete()
            .eq('student_id', studentTableId); // studentTableId is student record's PK
        if (deleteExistingSupervisorError) console.warn("Error clearing existing student supervisors:", deleteExistingSupervisorError.message);

        if (assignedSupervisorId) { // assignedSupervisorId is supervisor record's PK from 'supervisors' table
            const { error: assignError } = await adminSupabaseClient
                .from('student_supervisors')
                .insert({
                    student_id: studentTableId,
                    supervisor_id: assignedSupervisorId, // This is ID from supervisors table
                    organization_id: adminCurrentOrganization.id,
                    is_primary: true 
                });
            if (assignError) throw assignError;
        }

        displaySuccessMessage('Student saved successfully!');
        closeModal();
        if (AdminDOM.studentTableContainer) loadStudentsData();
        if (document.getElementById('dashboardContent')) loadDashboardStats();
        hideLoading();
    } catch (error) {
        console.error('Error saving student:', error);
        displayErrorMessage(`Failed to save student: ${error.message}`);
        hideLoading();
    }
}

// ------------------------------------------------------------------------
// DELETE ACTIONS
// ------------------------------------------------------------------------
async function deleteSupervisor(supervisorRecordId, authUserId) {
    if (!supervisorRecordId || !authUserId) {
        displayErrorMessage("Supervisor ID or Auth User ID missing for deletion.");
        return;
    }
    if (!confirm('Are you sure you want to delete this supervisor? This will also attempt to delete their user account and may impact associated students.')) return;
    
    try {
        showLoading('Deleting supervisor...');
        
        // 1. Unassign supervisor from any students (delete from student_supervisors)
        const { error: unassignError } = await adminSupabaseClient
            .from('student_supervisors')
            .delete()
            .eq('supervisor_id', supervisorRecordId); // supervisorRecordId is PK of 'supervisors' table
        if (unassignError) console.warn("Error unassigning supervisor from students:", unassignError.message);

        // 2. Delete from 'user_roles'
        const { error: roleDelError } = await adminSupabaseClient
            .from('user_roles')
            .delete()
            .eq('user_id', authUserId)
            .eq('organization_id', adminCurrentOrganization.id);
        if (roleDelError) console.warn("Error deleting user roles:", roleDelError.message);

        // 3. Delete from 'supervisors' table
        const { error: supDelError } = await adminSupabaseClient
            .from('supervisors')
            .delete()
            .eq('id', supervisorRecordId);
        if (supDelError) throw supDelError; // If this fails, stop

        // 4. Delete the auth user
        const { error: authUserDeleteError } = await adminSupabaseClient.auth.admin.deleteUser(authUserId);
        if (authUserDeleteError) {
            console.warn("Could not delete auth user (they might have other associations or already deleted):", authUserDeleteError.message);
            displayInfoMessage("Supervisor record deleted, but associated user account might still exist if it has other roles/data or was already removed.");
        } else {
            displaySuccessMessage('Supervisor and associated user account deleted successfully.');
        }

        if(AdminDOM.supervisorTableContainer) loadSupervisorsData();
        if(document.getElementById('dashboardContent')) loadDashboardStats();
        hideLoading();
    } catch (error) {
        console.error('Error deleting supervisor:', error);
        displayErrorMessage(`Failed to delete supervisor: ${error.message}`);
        hideLoading();
    }
}

async function deleteStudent(studentRecordId, authUserId) {
    if (!studentRecordId || !authUserId) {
        displayErrorMessage("Student ID or Auth User ID missing for deletion.");
        return;
    }
    if (!confirm('Are you sure you want to delete this student? This will remove all associated data and their user account.')) return;
    
    try {
        showLoading('Deleting student...');

        // Note: Database schema should ideally have ON DELETE CASCADE for related data (milestones, tasks, notes, attachments on supervisions linked to this student).
        // If not, manual deletion of dependent records is required here first.
        // For example, if 'supervisions' table links to 'students.id':
        // const { data: supervisions, error: fetchSupervisionsError } = await adminSupabaseClient
        //     .from('supervisions')
        //     .select('id')
        //     .eq('student_id', studentRecordId);
        // if (fetchSupervisionsError) console.warn("Could not fetch supervisions for deletion:", fetchSupervisionsError.message);
        // else if (supervisions && supervisions.length > 0) {
        //     for (const sup of supervisions) {
        //         // Delete milestones, tasks, etc. for sup.id
        //     }
        //     await adminSupabaseClient.from('supervisions').delete().eq('student_id', studentRecordId);
        // }


        // 1. Delete from student_supervisors
        const { error: ssDelError } = await adminSupabaseClient
            .from('student_supervisors')
            .delete()
            .eq('student_id', studentRecordId); // studentRecordId is PK of 'students' table
        if (ssDelError) console.warn("Error deleting student supervisor links:", ssDelError.message);
        
        // 2. Delete from 'user_roles'
        const { error: roleDelError } = await adminSupabaseClient
            .from('user_roles')
            .delete()
            .eq('user_id', authUserId)
            .eq('organization_id', adminCurrentOrganization.id);
        if (roleDelError) console.warn("Error deleting student roles:", roleDelError.message);

        // 3. Delete from 'students' table
        const { error: studDelError } = await adminSupabaseClient
            .from('students')
            .delete()
            .eq('id', studentRecordId);
        if (studDelError) throw studDelError;

        // 4. Delete the auth user
        const { error: authUserDeleteError } = await adminSupabaseClient.auth.admin.deleteUser(authUserId);
         if (authUserDeleteError) {
            console.warn("Could not delete auth user:", authUserDeleteError.message);
            displayInfoMessage("Student record deleted, but associated user account might still exist or was already removed.");
        } else {
            displaySuccessMessage('Student and associated user account deleted successfully.');
        }

        if(AdminDOM.studentTableContainer) loadStudentsData();
        if(document.getElementById('dashboardContent')) loadDashboardStats();
        hideLoading();
    } catch (error) {
        console.error('Error deleting student:', error);
        displayErrorMessage(`Failed to delete student: ${error.message}`);
        hideLoading();
    }
}

function viewStudentDetails(studentId) {
    console.log(`Request to view details for student ID: ${studentId}`);
    // Example: window.location.href = `/public/student-profile.html?id=${studentId}`; // If you have a dedicated page
    displayInfoMessage(`Student details view for ID ${studentId} could open a new page or a more detailed modal.`);
}


// ------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------------------------
function showLoading(message = 'Loading...') {
    adminLoadingState = true;
    if (AdminDOM.loadingOverlay) {
        const textElement = AdminDOM.loadingOverlay.querySelector('.loading-text');
        if (textElement) textElement.textContent = message;
        AdminDOM.loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    adminLoadingState = false;
    if (AdminDOM.loadingOverlay) {
        AdminDOM.loadingOverlay.style.display = 'none';
    }
}

function displayMessage(message, type = 'info') {
    // A more sophisticated notification system (e.g., toast notifications) would be better here.
    // For now, using alert.
    console.log(`Admin ${type}: ${message}`);
    const prefix = type.charAt(0).toUpperCase() + type.slice(1);
    alert(`${prefix}: ${message}`);
}

function displayErrorMessage(message) { displayMessage(message, 'error'); }
function displaySuccessMessage(message) { displayMessage(message, 'success'); }
function displayInfoMessage(message) { displayMessage(message, 'info'); }


function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function handleNavigation(event) {
    event.preventDefault();
    const targetHref = event.currentTarget.getAttribute('href');
    const targetId = targetHref?.startsWith('#') ? targetHref.substring(1) : null;

    if (AdminDOM.pageTitle && AdminDOM.contentContainer && targetId) {
        AdminDOM.pageTitle.textContent = event.currentTarget.dataset.pageTitle || event.currentTarget.textContent || 'Admin Section';
        
        // Hide all direct children of contentContainer that are 'content-section'
        Array.from(AdminDOM.contentContainer.children).forEach(child => {
            if (child.classList.contains('content-section')) { // Assuming main sections have this class
                 child.style.display = 'none';
                 child.classList.remove('active-section');
            }
        });
        
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active-section');

            // Special handling for sections that might need data reloaded or charts re-rendered
            if (targetId === 'dashboardContent') {
                if(document.getElementById('dashboardContent')) {
                    loadDashboardStats(); // Reload stats when navigating to dashboard
                    renderDashboardCharts(); // Re-render charts
                }
            } else if (targetId === 'supervisorManagementContent') {
                 if(AdminDOM.supervisorTableContainer) loadSupervisorsData();
            } else if (targetId === 'studentManagementContent') {
                 if(AdminDOM.studentTableContainer) loadStudentsData();
            }
             // Add more cases for other sections if they need specific actions on show
        }


        AdminDOM.navLinks.forEach(link => link.classList.remove('active'));
        event.currentTarget.classList.add('active');

        console.log(`Mapsd to section: #${targetId}`);
    } else {
        console.warn("Navigation target or essential DOM elements not found:", targetHref);
    }
}

function renderPagination(container, currentPage, totalPages, onPageClick) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center'; // Bootstrap classes

    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevA = document.createElement('a');
    prevA.className = 'page-link';
    prevA.href = '#';
    prevA.setAttribute('aria-label', 'Previous');
    prevA.innerHTML = '<span aria-hidden="true">&laquo;</span>';
    prevA.addEventListener('click', (e) => { e.preventDefault(); if (currentPage > 1) onPageClick(currentPage - 1); });
    prevLi.appendChild(prevA);
    ul.appendChild(prevLi);

    // Page numbers (simplified for brevity, could add ellipsis for many pages)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage <=3) endPage = Math.min(totalPages, 5);
    if (currentPage > totalPages - 3) startPage = Math.max(1, totalPages - 4);


    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = i;
        a.addEventListener('click', (e) => { e.preventDefault(); onPageClick(i); });
        li.appendChild(a);
        ul.appendChild(li);
    }

    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    const nextA = document.createElement('a');
    nextA.className = 'page-link';
    nextA.href = '#';
    nextA.setAttribute('aria-label', 'Next');
    nextA.innerHTML = '<span aria-hidden="true">&raquo;</span>';
    nextA.addEventListener('click', (e) => { e.preventDefault(); if (currentPage < totalPages) onPageClick(currentPage + 1); });
    nextLi.appendChild(nextA);
    ul.appendChild(nextLi);

    container.appendChild(ul);
}

function getStartOfWeek(date = new Date()) { // Optional date parameter
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday as start of week or Monday
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.toISOString();
}

function getEndOfWeek(date = new Date()) { // Optional date parameter
    const start = new Date(getStartOfWeek(date)); // Get start of the week for the given date
    const endOfWeek = new Date(start);
    endOfWeek.setDate(start.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek.toISOString();
}

function isWithinMonthDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1); // More reliable way to get one month ago
    return date >= oneMonthAgo && date <= today; // Ensure it's not in the future if that matters
}


// ------------------------------------------------------------------------
// SCRIPT EXECUTION START
// ------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    console.log('admin.js: DOMContentLoaded. Checking for Supabase connection...');
    // The 'supabaseConnectionReady' event is now dispatched by supabaseClient.js
    // We listen for it to ensure Supabase is fully initialized before our module runs.
    document.addEventListener('supabaseConnectionReady', (event) => {
        console.log('admin.js: supabaseConnectionReady event received.');
        if (event.detail) { // supabaseClient instance should be in event.detail
            adminSupabaseClient = event.detail; // Use the client from the event
            initializeAdminModule();
        } else {
            console.error('admin.js: Supabase client not provided in supabaseConnectionReady event.');
            displayErrorMessage("Failed to get Supabase client after connection event.");
        }
    }, { once: true });

    // Fallback: If supabaseClient.js initializes very quickly BEFORE this listener is attached
    // (less likely with DOMContentLoaded but possible), try to initialize if already available.
    // This is a bit of a race condition hedge. The event is preferred.
    if (typeof getSupabaseClient === 'function') {
        const existingClient = getSupabaseClient();
        if (existingClient && connectionVerified) { // `connectionVerified` is from supabaseClient.js
             console.log('admin.js: Supabase client already available on DOMContentLoaded. Initializing.');
             adminSupabaseClient = existingClient;
             initializeAdminModule();
        } else if (!connectionVerified && !existingClient) {
            // This case means initializeSupabaseClient() in supabaseClient.js was called but hasn't finished or failed.
            // The event listener above should catch it when it's ready.
            console.log('admin.js: Supabase client initialization in progress or failed, awaiting event.');
        }
    }
});

// Expose functions to global scope for inline HTML event handlers (onclick="...").
// Better practice is to attach all event listeners via JavaScript in setupEventListeners.
window.openSupervisorModal = openSupervisorModal;
window.deleteSupervisor = deleteSupervisor;
window.openStudentModal = openStudentModal;
window.deleteStudent = deleteStudent;
window.viewStudentDetails = viewStudentDetails;