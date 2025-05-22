// ethics-review.js - Logic for supervisors and committee members to review ethics submissions

// --- Module State ---
let reviewSupabaseClient = null;
let reviewCurrentUser = null;
let reviewUserRoles = [];
let reviewCurrentForm = null;
let reviewCurrentStudent = null;
let reviewMode = 'review'; // 'review' or 'view' (read-only)

// --- DOM Element Cache ---
const ReviewDOM = {
    formTitleDisplay: null,
    studentNameDisplay: null,
    formStatusDisplay: null,
    formSubmittedDateDisplay: null,
    formContentContainer: null,
    attachmentsContainer: null,
    feedbackTextarea: null,
    commentFileUploadInput: null,
    approveBtn: null,
    requestChangesBtn: null,
    rejectBtn: null,
    backToListBtn: null,
    historyContainer: null
};

// --- Form Review Initialization ---
async function initializeEthicsFormReview() {
    try {
        console.log('ethics-review.js: Initializing ethics form review...');
        
        // Get Supabase client
        reviewSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error: authError } = await reviewSupabaseClient.auth.getUser();
        
        if (authError || !user) {
            console.error('ethics-review.js: Authentication error:', authError);
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        reviewCurrentUser = user;
        
        // Get user roles
        const userOrgData = await getUserOrganizationAndRoles();
        if (!userOrgData || !userOrgData.roles) {
            console.error('ethics-review.js: Unable to get user roles');
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        reviewUserRoles = userOrgData.roles.map(role => role.name);
        
        // Check if user has necessary role
        const canReview = reviewUserRoles.some(role => 
            role === 'supervisor' || role === 'admin' || role === 'ethics_committee');
            
        if (!canReview) {
            console.error('ethics-review.js: User does not have permission to review ethics submissions');
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        // Get submission ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const submissionId = urlParams.get('id');
        const mode = urlParams.get('mode');
        
        if (!submissionId) {
            console.error('ethics-review.js: No submission ID provided');
            window.location.href = getAppropriateRedirectPath();
            return;
        }
        
        // Set review mode
        if (mode === 'view') {
            reviewMode = 'view';
        }
        
        // Cache DOM elements
        cacheReviewDOMElements();
        
        // Load submission data
        await loadSubmissionData(submissionId);
        
        console.log('ethics-review.js: Form review initialization complete');
        
    } catch (error) {
        console.error('ethics-review.js: Error initializing ethics form review:', error);
    }
}

// --- Cache DOM Elements ---
function cacheReviewDOMElements() {
    try {
        ReviewDOM.formTitleDisplay = document.getElementById('formTitleDisplay');
        ReviewDOM.studentNameDisplay = document.getElementById('studentNameDisplay');
        ReviewDOM.formStatusDisplay = document.getElementById('formStatusDisplay');
        ReviewDOM.formSubmittedDateDisplay = document.getElementById('formSubmittedDateDisplay');
        ReviewDOM.formContentContainer = document.getElementById('formContentContainer');
        ReviewDOM.attachmentsContainer = document.getElementById('attachmentsContainer');
        ReviewDOM.feedbackTextarea = document.getElementById('feedbackTextarea');
        ReviewDOM.commentFileUploadInput = document.getElementById('commentFileUpload');
        ReviewDOM.approveBtn = document.getElementById('approveBtn');
        ReviewDOM.requestChangesBtn = document.getElementById('requestChangesBtn');
        ReviewDOM.rejectBtn = document.getElementById('rejectBtn');
        ReviewDOM.backToListBtn = document.getElementById('backToListBtn');
        ReviewDOM.historyContainer = document.getElementById('historyContainer');
    } catch (error) {
        console.error('ethics-review.js: Error caching DOM elements:', error);
    }
}

// --- Load Submission Data ---
async function loadSubmissionData(submissionId) {
    try {
        // Fetch submission with related data
        const { data: submission, error: submissionError } = await reviewSupabaseClient
            .from('ethics_submissions')
            .select(`
                id, 
                title,
                description,
                risk_level,
                status,
                created_at,
                submitted_at,
                updated_at,
                student:student_id (id, name, email),
                supervisor:supervisor_id (id, name, email),
                department:department_id (name)
            `)
            .eq('id', submissionId)
            .single();
            
        if (submissionError || !submission) {
            console.error('ethics-review.js: Error loading submission:', submissionError);
            alert('Error loading submission. You may not have permission to review this submission.');
            window.location.href = getAppropriateRedirectPath();
            return;
        }
        
        reviewCurrentForm = submission;
        reviewCurrentStudent = submission.student;
        
        // Update UI with submission data
        updateReviewUIWithSubmission();
        
        // Load submission documents
        await loadSubmissionDocuments(submissionId);
        
        // Load review history
        await loadReviewHistory(submissionId);
        
        // Configure UI based on user role and submission status
        configureReviewUI();
        
    } catch (error) {
        console.error('ethics-review.js: Error in loadSubmissionData:', error);
    }
}

// --- Update Review UI With Submission ---
function updateReviewUIWithSubmission() {
    try {
        if (!reviewCurrentForm) return;
        
        // Set basic submission info
        if (ReviewDOM.formTitleDisplay) {
            ReviewDOM.formTitleDisplay.textContent = reviewCurrentForm.title;
        }
        
        if (ReviewDOM.studentNameDisplay && reviewCurrentStudent) {
            ReviewDOM.studentNameDisplay.textContent = reviewCurrentStudent.name;
        }
        
        if (ReviewDOM.formStatusDisplay) {
            const status = reviewCurrentForm.status.charAt(0).toUpperCase() + reviewCurrentForm.status.slice(1);
            ReviewDOM.formStatusDisplay.textContent = status;
            ReviewDOM.formStatusDisplay.className = `status-${reviewCurrentForm.status}`;
        }
        
        if (ReviewDOM.formSubmittedDateDisplay && reviewCurrentForm.submitted_at) {
            const submittedDate = new Date(reviewCurrentForm.submitted_at);
            ReviewDOM.formSubmittedDateDisplay.textContent = submittedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // Populate form content container with submission details
        if (ReviewDOM.formContentContainer) {
            ReviewDOM.formContentContainer.innerHTML = `
                <div class="form-section">
                    <h3>Project Details</h3>
                    <div class="form-field">
                        <label>Title</label>
                        <div class="field-value">${reviewCurrentForm.title || 'Not provided'}</div>
                    </div>
                    <div class="form-field">
                        <label>Description</label>