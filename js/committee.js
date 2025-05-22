// committee.js - Logic for the Ethics Committee Dashboard

// --- Module State --- 
let comSupabaseClient = null;
let comCurrentUser = null;
let comUserOrgData = null; // { organization: {id, name}, roles: [{id, name}] }
let comCommitteeProfile = null; // Data from public.committee_members table
let comModuleInitialized = false;

// --- DOM Element Cache --- 
const CommitteeDOM = {
    userNameDisplay: null,
    userAvatar: null,
    portalType: null, // "Ethics Committee Portal"
    notificationCountBadge: null,

    // Overview Stats
    pendingReviewsStat: null,
    approvedThisMonthStat: null,
    rejectedThisMonthStat: null,
    avgReviewTimeStat: null,

    // Recent Activity
    recentActivityContainer: null,

    // Reviews
    pendingReviewsContainer: null,
    completedReviewsContainer: null,

    // Reports
    reportsContainer: null
};

// --- Committee Dashboard Initialization --- 
async function initializeCommitteeDashboard() {
    try {
        console.log('committee.js: Initializing committee dashboard...');
        
        // Get Supabase client
        comSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error } = await comSupabaseClient.auth.getUser();
        
        if (error || !user) {
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        comCurrentUser = user;
        
        // Cache DOM Elements
        cacheCommitteeDOMElements();
        
        // Get user's organization and roles
        const orgData = await getUserOrganizationData();
        if (!orgData) {
            console.error('committee.js: Failed to get user organization data');
            return;
        }
        
        comUserOrgData = orgData;
        
        // Display user info
        displayUserInfo();
        
        // Get committee member profile
        await getCommitteeMemberProfile();
        
        // Load dashboard data
        await loadDashboardData();
        
        // Setup event listeners
        setupEventListeners();
        
        comModuleInitialized = true;
        console.log('committee.js: Committee dashboard initialized');
        
    } catch (err) {
        console.error('committee.js: Error initializing committee dashboard:', err);
    }
}

// --- Helper Functions ---

function cacheCommitteeDOMElements() {
    CommitteeDOM.userNameDisplay = document.getElementById('user-name');
    CommitteeDOM.userAvatar = document.getElementById('user-avatar');
    CommitteeDOM.portalType = document.getElementById('portal-type');
    CommitteeDOM.notificationCountBadge = document.getElementById('notification-count');
    
    CommitteeDOM.pendingReviewsStat = document.querySelector('.pending-reviews-count');
    CommitteeDOM.approvedThisMonthStat = document.querySelector('.approved-month-count');
    CommitteeDOM.rejectedThisMonthStat = document.querySelector('.rejected-month-count');
    CommitteeDOM.avgReviewTimeStat = document.querySelector('.avg-review-time');
    
    CommitteeDOM.recentActivityContainer = document.getElementById('recent-activity-list');
    CommitteeDOM.pendingReviewsContainer = document.getElementById('pending-reviews-table');
    CommitteeDOM.completedReviewsContainer = document.getElementById('completed-reviews-table');
    CommitteeDOM.reportsContainer = document.getElementById('reports-section');
}

function displayUserInfo() {
    if (comCurrentUser && CommitteeDOM.userNameDisplay) {
        CommitteeDOM.userNameDisplay.textContent = comCurrentUser.user_metadata.full_name || comCurrentUser.email;
    }
    
    if (CommitteeDOM.portalType) {
        CommitteeDOM.portalType.textContent = "Ethics Committee Portal";
    }
    
    // Set notification count (placeholder)
    if (CommitteeDOM.notificationCountBadge) {
        CommitteeDOM.notificationCountBadge.textContent = "0";
    }
}

async function getCommitteeMemberProfile() {
    try {
        const { data, error } = await comSupabaseClient
            .from('committee_members')
            .select('*')
            .eq('user_id', comCurrentUser.id)
            .single();
            
        if (error) throw error;
        
        comCommitteeProfile = data;
        return data;
    } catch (err) {
        console.error('committee.js: Error fetching committee member profile:', err);
        return null;
    }
}

async function loadDashboardData() {
    await Promise.all([
        loadDashboardStats(),
        loadRecentActivity(),
        loadPendingReviews(),
        loadCompletedReviews()
    ]);
}

async function loadDashboardStats() {
    try {
        // Pending reviews count
        const { data: pendingData, error: pendingError } = await comSupabaseClient
            .from('ethics_submissions')
            .select('id')
            .eq('status', 'under_review')
            .eq('organization_id', comUserOrgData.organization.id);
            
        if (pendingError) throw pendingError;
        
        if (CommitteeDOM.pendingReviewsStat) {
            CommitteeDOM.pendingReviewsStat.textContent = pendingData.length || '0';
        }
        
        // Current month approvals
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const { data: approvedData, error: approvedError } = await comSupabaseClient
            .from('ethics_submissions')
            .select('id')
            .eq('status', 'approved')
            .eq('organization_id', comUserOrgData.organization.id)
            .gte('review_date', firstDayOfMonth.toISOString());
            
        if (approvedError) throw approvedError;
        
        if (CommitteeDOM.approvedThisMonthStat) {
            CommitteeDOM.approvedThisMonthStat.textContent = approvedData.length || '0';
        }
        
        // Current month rejections
        const { data: rejectedData, error: rejectedError } = await comSupabaseClient
            .from('ethics_submissions')
            .select('id')
            .eq('status', 'rejected')
            .eq('organization_id', comUserOrgData.organization.id)
            .gte('review_date', firstDayOfMonth.toISOString());
            
        if (rejectedError) throw rejectedError;
        
        if (CommitteeDOM.rejectedThisMonthStat) {
            CommitteeDOM.rejectedThisMonthStat.textContent = rejectedData.length || '0';
        }
        
        // Calculate average review time (placeholder)
        if (CommitteeDOM.avgReviewTimeStat) {
            CommitteeDOM.avgReviewTimeStat.textContent = "3.2 days";
        }
        
    } catch (err) {
        console.error('committee.js: Error loading dashboard stats:', err);
    }
}

async function loadRecentActivity() {
    try {
        const { data, error } = await comSupabaseClient
            .from('ethics_submissions')
            .select(`
                id,
                title,
                status,
                updated_at,
                students(id, user_id, users(id, user_metadata))
            `)
            .eq('organization_id', comUserOrgData.organization.id)
            .order('updated_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        
        if (CommitteeDOM.recentActivityContainer && data) {
            CommitteeDOM.recentActivityContainer.innerHTML = '';
            
            if (data.length === 0) {
                CommitteeDOM.recentActivityContainer.innerHTML = '<p>No recent activity</p>';
                return;
            }
            
            const activityList = document.createElement('ul');
            activityList.className = 'activity-list';
            
            data.forEach(item => {
                const li = document.createElement('li');
                const studentName = item.students?.users?.user_metadata?.full_name || 'Unknown Student';
                
                let statusText = '';
                switch(item.status) {
                    case 'submitted': 
                        statusText = 'submitted a new ethics form';
                        break;
                    case 'approved':
                        statusText = 'had their ethics submission approved';
                        break;
                    case 'rejected':
                        statusText = 'had their ethics submission rejected';
                        break;
                    case 'changes_requested':
                        statusText = 'received feedback requesting changes';
                        break;
                    default:
                        statusText = `updated their submission (${item.status})`;
                }
                
                const timeAgo = formatTimeAgo(new Date(item.updated_at));
                
                li.innerHTML = `
                    <strong>${studentName}</strong> ${statusText}
                    <span class="activity-time">${timeAgo}</span>
                    <a href="#" class="view-details" data-id="${item.id}">View</a>
                `;
                
                activityList.appendChild(li);
            });
            
            CommitteeDOM.recentActivityContainer.appendChild(activityList);
        }
    } catch (err) {
        console.error('committee.js: Error loading recent activity:', err);
        if (CommitteeDOM.recentActivityContainer) {
            CommitteeDOM.recentActivityContainer.innerHTML = '<p>Failed to load recent activity</p>';
        }
    }
}

async function loadPendingReviews() {
    try {
        const { data, error } = await comSupabaseClient
            .from('ethics_submissions')
            .select(`
                id,
                title,
                risk_level,
                created_at,
                students(id, user_id, department, users(id, user_metadata))
            `)
            .eq('status', 'under_review')
            .eq('organization_id', comUserOrgData.organization.id)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        if (CommitteeDOM.pendingReviewsContainer && data) {
            // Clear existing table content except header
            const tableBody = document.createElement('tbody');
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="7">No pending reviews</td>';
                tableBody.appendChild(row);
            } else {
                data.forEach(item => {
                    const row = document.createElement('tr');
                    const studentName = item.students?.users?.user_metadata?.full_name || 'Unknown Student';
                    const submissionDate = new Date(item.created_at).toLocaleDateString();
                    
                    row.innerHTML = `
                        <td>${item.id.substring(0, 8)}...</td>
                        <td>${submissionDate}</td>
                        <td>${studentName}</td>
                        <td>${item.title}</td>
                        <td>${item.students?.department || 'Unknown'}</td>
                        <td>${item.risk_level || 'Not assessed'}</td>
                        <td>
                            <a href="/ethics-review.html?id=${item.id}" class="btn btn-primary">Review</a>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            }
            
            // Replace or append the table body
            const existingTable = CommitteeDOM.pendingReviewsContainer.querySelector('table');
            if (existingTable) {
                const existingTbody = existingTable.querySelector('tbody');
                if (existingTbody) {
                    existingTable.replaceChild(tableBody, existingTbody);
                } else {
                    existingTable.appendChild(tableBody);
                }
            } else {
                const table = document.createElement('table');
                table.className = 'table table-striped';
                const thead = document.createElement('thead');
                thead.innerHTML = `
                    <tr>
                        <th>ID</th>
                        <th>Date Submitted</th>
                        <th>Student</th>
                        <th>Title</th>
                        <th>Department</th>
                        <th>Risk Level</th>
                        <th>Actions</th>
                    </tr>
                `;
                table.appendChild(thead);
                table.appendChild(tableBody);
                CommitteeDOM.pendingReviewsContainer.innerHTML = '';
                CommitteeDOM.pendingReviewsContainer.appendChild(table);
            }
        }
    } catch (err) {
        console.error('committee.js: Error loading pending reviews:', err);
        if (CommitteeDOM.pendingReviewsContainer) {
            CommitteeDOM.pendingReviewsContainer.innerHTML = '<p>Failed to load pending reviews</p>';
        }
    }
}

async function loadCompletedReviews() {
    try {
        const { data, error } = await comSupabaseClient
            .from('ethics_submissions')
            .select(`
                id,
                title,
                risk_level,
                status,
                review_date,
                students(id, user_id, department, users(id, user_metadata))
            `)
            .in('status', ['approved', 'rejected', 'changes_requested'])
            .eq('organization_id', comUserOrgData.organization.id)
            .order('review_date', { ascending: false })
            .limit(10);
            
        if (error) throw error;
        
        if (CommitteeDOM.completedReviewsContainer && data) {
            // Clear existing table content except header
            const tableBody = document.createElement('tbody');
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="8">No completed reviews</td>';
                tableBody.appendChild(row);
            } else {
                data.forEach(item => {
                    const row = document.createElement('tr');
                    const studentName = item.students?.users?.user_metadata?.full_name || 'Unknown Student';
                    const reviewDate = item.review_date ? new Date(item.review_date).toLocaleDateString() : 'N/A';
                    
                    let statusClass = '';
                    switch(item.status) {
                        case 'approved': 
                            statusClass = 'text-success';
                            break;
                        case 'rejected':
                            statusClass = 'text-danger';
                            break;
                        case 'changes_requested':
                            statusClass = 'text-warning';
                            break;
                    }
                    
                    const statusText = item.status.replace('_', ' ');
                    
                    row.innerHTML = `
                        <td>${item.id.substring(0, 8)}...</td>
                        <td>${reviewDate}</td>
                        <td>${studentName}</td>
                        <td>${item.title}</td>
                        <td>${item.students?.department || 'Unknown'}</td>
                        <td>${item.risk_level || 'Not assessed'}</td>
                        <td class="${statusClass}">${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</td>
                        <td>
                            <a href="/ethics-review.html?id=${item.id}&mode=view" class="btn btn-secondary">View</a>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            }
            
            // Replace or append the table body
            const existingTable = CommitteeDOM.completedReviewsContainer.querySelector('table');
            if (existingTable) {
                const existingTbody = existingTable.querySelector('tbody');
                if (existingTbody) {
                    existingTable.replaceChild(tableBody, existingTbody);
                } else {
                    existingTable.appendChild(tableBody);
                }
            } else {
                const table = document.createElement('table');
                table.className = 'table table-striped';
                const thead = document.createElement('thead');
                thead.innerHTML = `
                    <tr>
                        <th>ID</th>
                        <th>Date Reviewed</th>
                        <th>Student</th>
                        <th>Title</th>
                        <th>Department</th>
                        <th>Risk Level</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                `;
                table.appendChild(thead);
                table.appendChild(tableBody);
                CommitteeDOM.completedReviewsContainer.innerHTML = '';
                CommitteeDOM.completedReviewsContainer.appendChild(table);
            }
        }
    } catch (err) {
        console.error('committee.js: Error loading completed reviews:', err);
        if (CommitteeDOM.completedReviewsContainer) {
            CommitteeDOM.completedReviewsContainer.innerHTML = '<p>Failed to load completed reviews</p>';
        }
    }
}

function setupEventListeners() {
    // View details links in recent activity
    document.querySelectorAll('.view-details').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const submissionId = e.target.dataset.id;
            window.location.href = `/ethics-review.html?id=${submissionId}&mode=view`;
        });
    });
    
    // Report generation functionality
    if (CommitteeDOM.reportsContainer) {
        const reportForms = CommitteeDOM.reportsContainer.querySelectorAll('form');
        
        reportForms.forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const reportType = form.dataset.reportType;
                
                // Example implementation for monthly report
                if (reportType === 'monthly') {
                    const month = formData.get('month');
                    const year = formData.get('year');
                    
                    // Generate and show report
                    await generateMonthlyReport(month, year);
                }
                // Add other report types as needed
            });
        });
    }
}

async function generateMonthlyReport(month, year) {
    // Placeholder for report generation logic
    console.log(`Generating monthly report for ${month}/${year}`);
    // Implement report generation
}

// Helper function to format relative time
function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
        return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    }
    
    return date.toLocaleDateString();
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the committee dashboard page
    if (window.location.pathname.includes('committee-dashboard.html')) {
        initializeCommitteeDashboard();
    }
});
