// public/js/student.js
// Student Dashboard and Features Implementation

console.log('student.js: Script execution started.');

// --- Module State ---
let stuSupabaseClient = null;
let stuCurrentUser = null;           // Supabase auth.user object
let stuUserOrgData = null;           // { organization: {id, name}, roles: [{id, name}] }
let stuStudentProfile = null;        // Data from public.students table
let stuSupervisorProfile = null;     // Data about assigned supervisor
let stuModuleInitialized = false;
let stuEthicsSubmission = null;      // Current ethics submission data
let stuThesisSubmission = null;      // Current thesis submission data
let stuUpcomingMeetings = [];        // List of upcoming meetings
let stuPastMeetings = [];            // List of past meetings
let stuUpcomingDeadlines = [];       // List of upcoming deadlines
let stuRecentActivity = [];          // Recent activity data

// --- DOM Element Cache ---
const StudentDOM = {
    // Header & User Info
    userNameDisplay: null,
    userAvatar: null,
    portalType: null,
    notificationCountBadge: null,
    
    // Overview Stats
    projectStatusDisplay: null,
    ethicsApprovalDisplay: null,
    thesisSubmissionDisplay: null,
    daysToNextDeadlineDisplay: null,
    currentAcademicYearDisplay: null,
    
    // Activity and Deadlines
    recentActivityContainer: null,
    upcomingDeadlinesContainer: null,
    
    // Ethics Submission
    ethicsStatusDisplay: null,
    ethicsSubmissionHistoryContainer: null,
    ethicsSubmitBtn: null,
    
    // Thesis Submission
    thesisStatusDisplay: null,
    thesisSubmissionHistoryContainer: null,
    thesisSubmitBtn: null,
    
    // Meetings
    upcomingMeetingsContainer: null,
    pastMeetingsContainer: null,
    scheduleMeetingBtn: null,
    
    // Profile Section
    fullNameDisplay: null,
    emailDisplay: null,
    departmentDisplay: null,
    programDisplay: null,
    supervisorNameDisplay: null
};

// --- Student Dashboard Initialization ---
async function initializeStudentDashboard() {
    try {
        console.log('student.js: Initializing student dashboard...');
        
        // Get Supabase client
        stuSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error } = await stuSupabaseClient.auth.getUser();
        
        if (error || !user) {
            window.location.href = '/public/login.html';
            return;
        }
        
        stuCurrentUser = user;
        
        // Cache DOM elements
        cacheDOMElements();
        
        // Get user organization data from auth module
        stuUserOrgData = getUserOrganizationData();
        
        if (!stuUserOrgData) {
            console.error('student.js: Failed to get user organization data.');
            showError('Failed to load user data. Please refresh the page.');
            return;
        }
        
        // Display user info in header
        displayUserInfo();
        
        // Load student profile data
        await loadStudentProfile();
        
        // Initialize dashboard sections
        await Promise.all([
            loadOverviewStats(),
            loadRecentActivity(),
            loadUpcomingDeadlines(),
            loadEthicsSubmissionData(),
            loadThesisSubmissionData(),
            loadMeetingsData()
        ]);
        
        // Load profile section
        populateProfileSection();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('student.js: Student dashboard initialized successfully.');
        stuModuleInitialized = true;
        
    } catch (error) {
        console.error('student.js: Error initializing student dashboard:', error);
        showError('An error occurred while loading the dashboard. Please refresh the page.');
    }
}

// --- DOM Element Caching ---
function cacheDOMElements() {
    // Header & User Info
    StudentDOM.userNameDisplay = document.getElementById('userNameDisplay');
    StudentDOM.userAvatar = document.getElementById('userAvatar');
    StudentDOM.portalType = document.getElementById('portalType');
    StudentDOM.notificationCountBadge = document.getElementById('notificationCountBadge');
    
    // Overview Stats
    StudentDOM.projectStatusDisplay = document.getElementById('projectStatusDisplay');
    StudentDOM.ethicsApprovalDisplay = document.getElementById('ethicsApprovalDisplay');
    StudentDOM.thesisSubmissionDisplay = document.getElementById('thesisSubmissionDisplay');
    StudentDOM.daysToNextDeadlineDisplay = document.getElementById('daysToNextDeadlineDisplay');
    StudentDOM.currentAcademicYearDisplay = document.getElementById('currentAcademicYearDisplay');
    
    // Activity and Deadlines
    StudentDOM.recentActivityContainer = document.getElementById('recentActivityContainer');
    StudentDOM.upcomingDeadlinesContainer = document.getElementById('upcomingDeadlinesContainer');
    
    // Ethics Submission
    StudentDOM.ethicsStatusDisplay = document.getElementById('ethicsStatusDisplay');
    StudentDOM.ethicsSubmissionHistoryContainer = document.getElementById('ethicsSubmissionHistoryContainer');
    StudentDOM.ethicsSubmitBtn = document.getElementById('ethicsSubmitBtn');
    
    // Thesis Submission
    StudentDOM.thesisStatusDisplay = document.getElementById('thesisStatusDisplay');
    StudentDOM.thesisSubmissionHistoryContainer = document.getElementById('thesisSubmissionHistoryContainer');
    StudentDOM.thesisSubmitBtn = document.getElementById('thesisSubmitBtn');
    
    // Meetings
    StudentDOM.upcomingMeetingsContainer = document.getElementById('upcomingMeetingsContainer');
    StudentDOM.pastMeetingsContainer = document.getElementById('pastMeetingsContainer');
    StudentDOM.scheduleMeetingBtn = document.getElementById('scheduleMeetingBtn');
    
    // Profile Section
    StudentDOM.fullNameDisplay = document.getElementById('fullNameDisplay');
    StudentDOM.emailDisplay = document.getElementById('emailDisplay');
    StudentDOM.departmentDisplay = document.getElementById('departmentDisplay');
    StudentDOM.programDisplay = document.getElementById('programDisplay');
    StudentDOM.supervisorNameDisplay = document.getElementById('supervisorNameDisplay');
    
    console.log('student.js: DOM elements cached.');
}

// --- User Info Display ---
function displayUserInfo() {
    if (!stuCurrentUser || !stuUserOrgData) return;
    
    // Set user name
    if (StudentDOM.userNameDisplay) {
        StudentDOM.userNameDisplay.textContent = stuCurrentUser.user_metadata?.full_name || stuCurrentUser.email;
    }
    
    // Set user avatar (initial letter)
    if (StudentDOM.userAvatar) {
        const initials = (stuCurrentUser.user_metadata?.full_name || stuCurrentUser.email || 'U')[0].toUpperCase();
        StudentDOM.userAvatar.textContent = initials;
        
        // Assign a random background color based on the user's email
        const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#607D8B'];
        const colorIndex = stuCurrentUser.email.charCodeAt(0) % colors.length;
        StudentDOM.userAvatar.style.backgroundColor = colors[colorIndex];
    }
    
    // Set portal type
    if (StudentDOM.portalType) {
        StudentDOM.portalType.textContent = 'Student Portal';
    }
    
    // Set academic year if available
    if (StudentDOM.currentAcademicYearDisplay) {
        StudentDOM.currentAcademicYearDisplay.textContent = '2024-2025';
    }
    
    // Set notifications count (placeholder)
    if (StudentDOM.notificationCountBadge) {
        // This would come from a notifications table in a real implementation
        StudentDOM.notificationCountBadge.textContent = '0';
        StudentDOM.notificationCountBadge.style.display = 'none'; // Hide if no notifications
    }
}

// --- Load Student Profile Data ---
async function loadStudentProfile() {
    try {
        // Query the students table to get student details
        const { data: studentData, error } = await stuSupabaseClient
            .from('students')
            .select('*, departments(*), programs(*)')
            .eq('user_id', stuCurrentUser.id)
            .single();
            
        if (error) throw error;
        
        if (!studentData) {
            console.error('student.js: No student profile found for current user.');
            showError('Student profile not found. Please contact an administrator.');
            return;
        }
        
        stuStudentProfile = studentData;
        
        // Load supervisor information
        if (studentData.supervisor_id) {
            const { data: supervisorData, error: supError } = await stuSupabaseClient
                .from('supervisors')
                .select('*, profiles(*)')
                .eq('id', studentData.supervisor_id)
                .single();
                
            if (!supError && supervisorData) {
                stuSupervisorProfile = supervisorData;
            }
        }
        
        console.log('student.js: Student profile loaded successfully.');
        
    } catch (error) {
        console.error('student.js: Error loading student profile:', error);
        showError('Failed to load student profile. Please refresh the page.');
    }
}

// --- Load Overview Statistics ---
async function loadOverviewStats() {
    try {
        // Project Status
        if (StudentDOM.projectStatusDisplay) {
            // This would be determined by a combination of factors in a real implementation
            const projectStatus = getProjectStatus();
            StudentDOM.projectStatusDisplay.textContent = projectStatus;
            StudentDOM.projectStatusDisplay.className = `status-badge ${projectStatus.toLowerCase().replace(' ', '-')}`;
        }
        
        // Ethics Approval Status
        if (StudentDOM.ethicsApprovalDisplay) {
            const ethicsStatus = stuEthicsSubmission?.status || 'Not Started';
            StudentDOM.ethicsApprovalDisplay.textContent = ethicsStatus;
            StudentDOM.ethicsApprovalDisplay.className = `status-badge ${ethicsStatus.toLowerCase().replace(' ', '-')}`;
        }
        
        // Thesis Submission Status
        if (StudentDOM.thesisSubmissionDisplay) {
            const thesisStatus = stuThesisSubmission?.status || 'Not Started';
            StudentDOM.thesisSubmissionDisplay.textContent = thesisStatus;
            StudentDOM.thesisSubmissionDisplay.className = `status-badge ${thesisStatus.toLowerCase().replace(' ', '-')}`;
        }
        
        // Days to Next Deadline
        if (StudentDOM.daysToNextDeadlineDisplay) {
            const daysToDeadline = calculateDaysToNextDeadline();
            StudentDOM.daysToNextDeadlineDisplay.textContent = daysToDeadline;
            
            // Add visual indicator based on urgency
            if (daysToDeadline <= 7) {
                StudentDOM.daysToNextDeadlineDisplay.classList.add('urgent');
            } else if (daysToDeadline <= 14) {
                StudentDOM.daysToNextDeadlineDisplay.classList.add('warning');
            } else {
                StudentDOM.daysToNextDeadlineDisplay.classList.add('normal');
            }
        }
        
    } catch (error) {
        console.error('student.js: Error loading overview stats:', error);
        // Continue loading other sections
    }
}

// --- Helper: Get Project Status ---
function getProjectStatus() {
    // This would be a more complex calculation in a real system
    // Based on ethics approval, thesis progress, meetings attendance, etc.
    
    if (!stuEthicsSubmission || stuEthicsSubmission.status === 'Not Started') {
        return 'Not Started';
    } else if (stuEthicsSubmission.status === 'Rejected') {
        return 'At Risk';
    } else if (stuEthicsSubmission.status === 'Approved' && (!stuThesisSubmission || stuThesisSubmission.status === 'Not Started')) {
        return 'In Progress';
    } else if (stuThesisSubmission && stuThesisSubmission.status === 'Submitted') {
        return 'Completed';
    } else {
        return 'In Progress';
    }
}

// --- Helper: Calculate Days to Next Deadline ---
function calculateDaysToNextDeadline() {
    if (stuUpcomingDeadlines.length === 0) {
        return '--';
    }
    
    // Sort deadlines by date
    const sortedDeadlines = [...stuUpcomingDeadlines].sort((a, b) => 
        new Date(a.due_date) - new Date(b.due_date)
    );
    
    // Get the nearest deadline
    const nextDeadline = sortedDeadlines[0];
    const today = new Date();
    const deadlineDate = new Date(nextDeadline.due_date);
    
    // Calculate difference in days
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays.toString() : 'Due Today';
}

// --- Load Recent Activity ---
async function loadRecentActivity() {
    try {
        if (!StudentDOM.recentActivityContainer) return;
        
        // Query activity logs for this student
        const { data: activityData, error } = await stuSupabaseClient
            .from('activity_logs')
            .select('*')
            .eq('user_id', stuCurrentUser.id)
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        
        stuRecentActivity = activityData || [];
        
        // Render activity items
        if (stuRecentActivity.length === 0) {
            StudentDOM.recentActivityContainer.innerHTML = '<p class="no-data-message">No recent activity to display.</p>';
            return;
        }
        
        const activityHtml = stuRecentActivity.map(activity => `
            <div class="activity-item ${activity.activity_type.toLowerCase()}">
                <span class="activity-icon">${getActivityIcon(activity.activity_type)}</span>
                <div class="activity-details">
                    <p class="activity-description">${activity.description}</p>
                    <p class="activity-timestamp">${formatDateRelative(activity.created_at)}</p>
                </div>
            </div>
        `).join('');
        
        StudentDOM.recentActivityContainer.innerHTML = activityHtml;
        
    } catch (error) {
        console.error('student.js: Error loading recent activity:', error);
        StudentDOM.recentActivityContainer.innerHTML = '<p class="error-message">Failed to load recent activity.</p>';
    }
}

// --- Helper: Get Activity Icon ---
function getActivityIcon(activityType) {
    const iconMap = {
        'ethics_submission': '📝',
        'thesis_submission': '📄',
        'meeting': '🗓️',
        'feedback': '💬',
        'deadline': '⏰',
        'grade': '🎓',
        'system': '⚙️'
    };
    
    return iconMap[activityType.toLowerCase()] || '📌';
}

// --- Helper: Format Date Relative ---
function formatDateRelative(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        }
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// --- Load Upcoming Deadlines ---
async function loadUpcomingDeadlines() {
    try {
        if (!StudentDOM.upcomingDeadlinesContainer) return;
        
        // Get program deadlines based on student's program
        const { data: deadlineData, error } = await stuSupabaseClient
            .from('program_deadlines')
            .select('*')
            .eq('program_id', stuStudentProfile.program_id)
            .gt('due_date', new Date().toISOString())
            .order('due_date', { ascending: true })
            .limit(5);
            
        if (error) throw error;
        
        stuUpcomingDeadlines = deadlineData || [];
        
        // Render deadline items
        if (stuUpcomingDeadlines.length === 0) {
            StudentDOM.upcomingDeadlinesContainer.innerHTML = '<p class="no-data-message">No upcoming deadlines.</p>';
            return;
        }
        
        const deadlineHtml = stuUpcomingDeadlines.map(deadline => {
            const dueDate = new Date(deadline.due_date);
            const today = new Date();
            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let urgencyClass = '';
            if (diffDays <= 7) {
                urgencyClass = 'urgent';
            } else if (diffDays <= 14) {
                urgencyClass = 'warning';
            }
            
            return `
                <div class="deadline-item ${urgencyClass}">
                    <div class="deadline-header">
                        <h4 class="deadline-title">${deadline.title}</h4>
                        <span class="deadline-days">${diffDays} days left</span>
                    </div>
                    <p class="deadline-description">${deadline.description}</p>
                    <p class="deadline-date">Due: ${dueDate.toLocaleDateString()}</p>
                </div>
            `;
        }).join('');
        
        StudentDOM.upcomingDeadlinesContainer.innerHTML = deadlineHtml;
        
    } catch (error) {
        console.error('student.js: Error loading upcoming deadlines:', error);
        StudentDOM.upcomingDeadlinesContainer.innerHTML = '<p class="error-message">Failed to load upcoming deadlines.</p>';
    }
}

// --- Load Ethics Submission Data ---
async function loadEthicsSubmissionData() {
    try {
        // Get the latest ethics submission
        const { data: ethicsData, error } = await stuSupabaseClient
            .from('ethics_submissions')
            .select('*')
            .eq('student_id', stuStudentProfile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        if (error) throw error;
        
        stuEthicsSubmission = ethicsData;
        
        // Update ethics status display
        if (StudentDOM.ethicsStatusDisplay) {
            const statusText = ethicsData?.status || 'Not Started';
            StudentDOM.ethicsStatusDisplay.textContent = statusText;
            
            // Add appropriate styling based on status
            StudentDOM.ethicsStatusDisplay.className = 'status-badge';
            StudentDOM.ethicsStatusDisplay.classList.add(statusText.toLowerCase().replace(' ', '-'));
        }
        
        // Load submission history
        await loadEthicsSubmissionHistory();
        
        // Update the submit button state based on current status
        if (StudentDOM.ethicsSubmitBtn) {
            if (!ethicsData || ['Not Started', 'Changes Requested', 'Rejected'].includes(ethicsData?.status)) {
                StudentDOM.ethicsSubmitBtn.disabled = false;
                StudentDOM.ethicsSubmitBtn.textContent = ethicsData ? 'Continue Ethics Form' : 'Start Ethics Form';
            } else {
                StudentDOM.ethicsSubmitBtn.disabled = true;
                StudentDOM.ethicsSubmitBtn.textContent = 'Form Submitted';
            }
        }
        
    } catch (error) {
        console.error('student.js: Error loading ethics submission data:', error);
        // Continue loading other sections
    }
}

// --- Load Ethics Submission History ---
async function loadEthicsSubmissionHistory() {
    try {
        if (!StudentDOM.ethicsSubmissionHistoryContainer) return;
        
        // Query ethics submission history
        const { data: historyData, error } = await stuSupabaseClient
            .from('ethics_submissions')
            .select('*')
            .eq('student_id', stuStudentProfile.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        // Render submission history
        if (!historyData || historyData.length === 0) {
            StudentDOM.ethicsSubmissionHistoryContainer.innerHTML = '<p class="no-data-message">No submission history to display.</p>';
            return;
        }
        
        const historyHtml = historyData.map(submission => {
            const submissionDate = new Date(submission.created_at).toLocaleDateString();
            let statusClass = submission.status.toLowerCase().replace(' ', '-');
            
            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-date">${submissionDate}</span>
                        <span class="status-badge ${statusClass}">${submission.status}</span>
                    </div>
                    ${submission.feedback ? `<p class="history-feedback">${submission.feedback}</p>` : ''}
                </div>
            `;
        }).join('');
        
        StudentDOM.ethicsSubmissionHistoryContainer.innerHTML = historyHtml;
        
    } catch (error) {
        console.error('student.js: Error loading ethics submission history:', error);
        StudentDOM.ethicsSubmissionHistoryContainer.innerHTML = '<p class="error-message">Failed to load submission history.</p>';
    }
}

// --- Load Thesis Submission Data ---
async function loadThesisSubmissionData() {
    try {
        // Get the latest thesis submission
        const { data: thesisData, error } = await stuSupabaseClient
            .from('thesis_submissions')
            .select('*')
            .eq('student_id', stuStudentProfile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        if (error) throw error;
        
        stuThesisSubmission = thesisData;
        
        // Update thesis status display
        if (StudentDOM.thesisStatusDisplay) {
            const statusText = thesisData?.status || 'Not Started';
            StudentDOM.thesisStatusDisplay.textContent = statusText;
            
            // Add appropriate styling based on status
            StudentDOM.thesisStatusDisplay.className = 'status-badge';
            StudentDOM.thesisStatusDisplay.classList.add(statusText.toLowerCase().replace(' ', '-'));
        }
        
        // Load submission history
        await loadThesisSubmissionHistory();
        
        // Update the submit button state based on current status
        if (StudentDOM.thesisSubmitBtn) {
            if (!thesisData || ['Not Started', 'Draft', 'Changes Requested'].includes(thesisData?.status)) {
                StudentDOM.thesisSubmitBtn.disabled = false;
                StudentDOM.thesisSubmitBtn.textContent = thesisData ? 'Continue Thesis Submission' : 'Start Thesis Submission';
            } else {
                StudentDOM.thesisSubmitBtn.disabled = true;
                StudentDOM.thesisSubmitBtn.textContent = 'Thesis Submitted';
            }
        }
        
    } catch (error) {
        console.error('student.js: Error loading thesis submission data:', error);
        // Continue loading other sections
    }
}

// --- Load Thesis Submission History ---
async function loadThesisSubmissionHistory() {
    try {
        if (!StudentDOM.thesisSubmissionHistoryContainer) return;
        
        // Query thesis submission history
        const { data: historyData, error } = await stuSupabaseClient
            .from('thesis_submissions')
            .select('*')
            .eq('student_id', stuStudentProfile.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        // Render submission history
        if (!historyData || historyData.length === 0) {
            StudentDOM.thesisSubmissionHistoryContainer.innerHTML = '<p class="no-data-message">No submission history to display.</p>';
            return;
        }
        
        const historyHtml = historyData.map(submission => {
            const submissionDate = new Date(submission.created_at).toLocaleDateString();
            let statusClass = submission.status.toLowerCase().replace(' ', '-');
            
            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-date">${submissionDate}</span>
                        <span class="status-badge ${statusClass}">${submission.status}</span>
                    </div>
                    <p class="history-title">${submission.title}</p>
                    ${submission.feedback ? `<p class="history-feedback">${submission.feedback}</p>` : ''}
                </div>
            `;
        }).join('');
        
        StudentDOM.thesisSubmissionHistoryContainer.innerHTML = historyHtml;
        
    } catch (error) {
        console.error('student.js: Error loading thesis submission history:', error);
        StudentDOM.thesisSubmissionHistoryContainer.innerHTML = '<p class="error-message">Failed to load submission history.</p>';
    }
}

// --- Load Meetings Data ---
async function loadMeetingsData() {
    try {
        // Get upcoming meetings
        const today = new Date().toISOString();
        const { data: upcomingData, error: upcomingError } = await stuSupabaseClient
            .from('meetings')
            .select('*, supervisors(*)')
            .eq('student_id', stuStudentProfile.id)
            .gte('scheduled_date', today)
            .order('scheduled_date', { ascending: true });
            
        if (upcomingError) throw upcomingError;
        
        stuUpcomingMeetings = upcomingData || [];
        
        // Get past meetings
        const { data: pastData, error: pastError } = await stuSupabaseClient
            .from('meetings')
            .select('*, supervisors(*)')
            .eq('student_id', stuStudentProfile.id)
            .lt('scheduled_date', today)
            .order('scheduled_date', { ascending: false })
            .limit(5);
            
        if (pastError) throw pastError;
        
        stuPastMeetings = pastData || [];
        
        // Render upcoming meetings
        if (StudentDOM.upcomingMeetingsContainer) {
            if (stuUpcomingMeetings.length === 0) {
                StudentDOM.upcomingMeetingsContainer.innerHTML = '<p class="no-data-message">No upcoming meetings scheduled.</p>';
            } else {
                const upcomingHtml = stuUpcomingMeetings.map(meeting => {
                    const meetingDate = new Date(meeting.scheduled_date).toLocaleDateString();
                    const meetingTime = new Date(meeting.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return `
                        <div class="meeting-item">
                            <div class="meeting-header">
                                <h4 class="meeting-title">${meeting.title}</h4>
                                <span class="meeting-type ${meeting.meeting_type.toLowerCase()}">${meeting.meeting_type}</span>
                            </div>
                            <p class="meeting-datetime">
                                <i class="calendar-icon">📅</i> ${meetingDate} at ${meetingTime}
                            </p>
                            <p class="meeting-location">
                                <i class="location-icon">📍</i> ${meeting.location || 'Online'}
                            </p>
                            ${meeting.agenda ? `<p class="meeting-agenda">${meeting.agenda}</p>` : ''}
                            <div class="meeting-actions">
                                <button class="btn-primary join-meeting-btn" data-meeting-id="${meeting.id}" data-meeting-link="${meeting.meeting_link}">
                                    Join Meeting
                                </button>
                                <button class="btn-secondary reschedule-btn" data-meeting-id="${meeting.id}">
                                    Reschedule
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
                
                StudentDOM.upcomingMeetingsContainer.innerHTML = upcomingHtml;
                
                // Add event listeners to buttons
                document.querySelectorAll('.join-meeting-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const meetingLink = e.target.dataset.meetingLink;
                        if (meetingLink) {
                            window.open(meetingLink, '_blank');
                        } else {
                            showError('Meeting link not available.');
                        }
                    });
                });
                
                document.querySelectorAll('.reschedule-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const meetingId = e.target.dataset.meetingId;
                        openRescheduleMeetingModal(meetingId);
                    });
                });
            }
        }
        
        // Render past meetings
        if (StudentDOM.pastMeetingsContainer) {
            if (stuPastMeetings.length === 0) {
                StudentDOM.pastMeetingsContainer.innerHTML = '<p class="no-data-message">No past meetings to display.</p>';
            } else {
                const pastHtml = stuPastMeetings.map(meeting => {
                    const meetingDate = new Date(meeting.scheduled_date).toLocaleDateString();
                    
                    return `
                        <div class="meeting-item past">
                            <div class="meeting-header">
                                <h4 class="meeting-title">${meeting.title}</h4>
                                <span class="meeting-date">${meetingDate}</span>
                            </div>
                            <p class="meeting-status">
                                Status: <span class="status-badge ${meeting.status.toLowerCase()}">${meeting.status}</span>
                            </p>
                            ${meeting.notes ? `<p class="meeting-notes">${meeting.notes}</p>` : ''}
                            <button class="btn-tertiary view-details-btn" data-meeting-id="${meeting.id}">
                                View Details
                            </button>
                        </div>
                    `;
                }).join('');
                
                StudentDOM.pastMeetingsContainer.innerHTML = pastHtml;
                
                // Add event listeners to view details buttons
                document.querySelectorAll('.view-details-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const meetingId = e.target.dataset.meetingId;
                        openMeetingDetailsModal(meetingId);
                    });
                });