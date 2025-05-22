// script.js - Main application logic, routing, and page initialization

// --- Global Application State ---
const appState = {
    user: null,                 // Stores the Supabase user object from auth.js
    userOrgData: null,          // Stores organization and roles from auth.js {organization, roles}
    currentPagePath: null,      // Current window.location.pathname
    isInitializing: true,       // True until all core modules (DOM, Supabase, Auth) are ready
    domReady: false,
    supabaseReady: false,
    authModuleReady: false,
    currentRouteProcessed: false // Flag to avoid re-processing the same route due to event timing
};

// --- Constants for Page Paths (must match how Live Server serves them) ---
const PathConfig = {
    LOGIN: '/public/login.html',
    ADMIN_DASHBOARD: '/public/admin.html',
    SUPERVISOR_DASHBOARD: '/public/index.html', // index.html is the supervisor page
    // Add other paths like:
    // RESET_PASSWORD_CONFIRM: '/public/update-password.html'
};

// --- Custom Event Names (ensure consistency if used across modules) ---
const AppEvents = {
    // Using events dispatched by supabaseClient.js and auth.js
    SUPABASE_CLIENT_READY: 'supabaseClientReady',
    AUTH_MODULE_READY: 'authModuleReady'
};

/**
 * Checks if all core dependencies are ready and then initializes the main app logic.
 */
function checkCoreServicesAndInitializeApp() {
    if (appState.domReady && appState.supabaseReady && appState.authModuleReady) {
        if (!appState.isInitializing) return; // Already initialized
        console.log('script.js: All core services ready (DOM, Supabase, Auth). Initializing main application logic.');
        appState.isInitializing = false; // Mark core initialization as complete
        initializeAppLogic();
    } else {
        console.log(`script.js: Waiting for core services. DOM: ${appState.domReady}, Supabase: ${appState.supabaseReady}, Auth: ${appState.authModuleReady}`);
    }
}

// --- Event Listeners for Core Services Readiness ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('script.js: DOMContentLoaded event.');
    appState.domReady = true;
    checkCoreServicesAndInitializeApp();
});

document.addEventListener(AppEvents.SUPABASE_CLIENT_READY, (event) => {
    console.log('script.js: SupabaseClientReady event received.');
    if (event.detail && event.detail.client) {
        appState.supabaseReady = true;
    } else {
        console.error('script.js: SupabaseClientReady event received, but client detail was missing or invalid.');
        // Optionally display a user-facing error
        if (window.auth && window.auth.showAuthError) {
            window.auth.showAuthError('Critical Error: Backend connection failed to initialize.');
        }
    }
    checkCoreServicesAndInitializeApp();
});

document.addEventListener(AppEvents.AUTH_MODULE_READY, (event) => {
    console.log('script.js: AuthModuleReady event received.');
    if (event.detail && event.detail.success) {
        appState.authModuleReady = true;
    } else {
        console.error('script.js: AuthModuleReady event received, but indicated failure or missing details.');
        if (window.auth && window.auth.showAuthError) {
            window.auth.showAuthError('Critical Error: Authentication module failed to initialize.');
        }
    }
    checkCoreServicesAndInitializeApp();
});


/**
 * Main application logic initialization.
 * Sets up auth listeners and handles initial routing.
 */
function initializeAppLogic() {
    console.log('script.js: initializeAppLogic() executing.');

    if (typeof window.auth === 'undefined' || typeof window.auth.onAuthStateChange !== 'function') {
        console.error('script.js: CRITICAL - window.auth or window.auth.onAuthStateChange is not available!');
        if (window.auth && window.auth.showAuthError) { // Check if showAuthError itself is available
            window.auth.showAuthError('Application Error: Auth functions missing.');
        } else {
            alert('Critical Application Error: Authentication functions are missing. Please refresh or contact support.');
        }
        return;
    }

    // Listen to authentication state changes from auth.js
    window.auth.onAuthStateChange(handleAuthenticationStateChange);

    // Initial URL handling is triggered by the first auth state change notification.
    // Or, if auth state is already known, onAuthStateChange callback will fire immediately.
    console.log('script.js: Application logic initialized. Waiting for auth state to finalize routing.');
}

/**
 * Handles authentication state changes broadcast by auth.js.
 * This is the primary driver for routing decisions post-authentication.
 * @param {string} eventType - e.g., 'SIGNED_IN', 'SIGNED_OUT'.
 * @param {object|null} user - The Supabase user object.
 * @param {object|null} orgData - User's organization and role data {organization, roles}.
 */
function handleAuthenticationStateChange(eventType, user, orgData) {
    console.log(`script.js: Auth state changed - Event: ${eventType}`, user ? `User: ${user.email}` : 'No user', orgData || '(No org data)');
    appState.user = user;
    appState.userOrgData = orgData;
    appState.currentRouteProcessed = false; // Allow next route to be processed

    // Determine current path AFTER auth state is known
    const currentPath = window.location.pathname;
    console.log('script.js: Current path for routing decision:', currentPath);

    if (eventType === 'SIGNED_IN' && user) {
        // User is signed in, decide where they should go.
        // If they are on login, redirect. Otherwise, ensure they are on the correct protected page.
        if (currentPath === PathConfig.LOGIN) {
            console.log('script.js: User signed in and on login page. Redirecting to appropriate dashboard.');
            redirectToDashboardBasedOnRole(true); // true for replaceState
        } else {
            // User is signed in and on a page other than login.
            // Validate if they should be here or redirect.
            validateAndHandleRoute(currentPath);
        }
    } else if (eventType === 'SIGNED_OUT') {
        // User is signed out. If on a protected page, redirect to login.
        const publicPages = [PathConfig.LOGIN /*, add other public paths like reset password */];
        if (!publicPages.includes(currentPath)) {
            console.log('script.js: User signed out and on a protected page. Redirecting to login.');
            navigateTo(PathConfig.LOGIN, true); // true for replaceState
        } else {
            // User is signed out and on a public page (e.g., login page already). Initialize it.
            console.log('script.js: User signed out and on a public page.');
            if (currentPath === PathConfig.LOGIN) {
                initLoginPage();
            }
        }
    } else if (eventType === 'SESSION_ERROR') {
        console.error("script.js: Session error detected. Forcing navigation to login.");
        navigateTo(PathConfig.LOGIN, true);
    }
}


/**
 * Validates the current route for an authenticated user and loads page content or redirects.
 * @param {string} path - The current window.location.pathname.
 */
function validateAndHandleRoute(path) {
    if (appState.currentRouteProcessed && appState.currentPagePath === path) {
        console.log('script.js: Route already processed:', path);
        return;
    }
    console.log('script.js: Validating and handling route:', path);
    appState.currentPagePath = path;

    if (!appState.user) { // Should not happen if called from SIGNED_IN context, but good check
        navigateTo(PathConfig.LOGIN, true);
        return;
    }

    let targetPathForRole = null;
    if (window.auth.currentUserHasRole('org_admin')) {
        targetPathForRole = PathConfig.ADMIN_DASHBOARD;
    } else if (window.auth.currentUserHasRole('supervisor')) {
        targetPathForRole = PathConfig.SUPERVISOR_DASHBOARD;
    }

    if (path === PathConfig.ADMIN_DASHBOARD) {
        if (window.auth.currentUserHasRole('org_admin')) {
            initAdminPage();
        } else {
            console.warn('script.js: Access denied to Admin Dashboard. Redirecting.');
            window.auth.showAuthError('Access Denied: You do not have permission for this page.');
            navigateTo(targetPathForRole || PathConfig.LOGIN, true);
        }
    } else if (path === PathConfig.SUPERVISOR_DASHBOARD) {
        if (window.auth.currentUserHasRole('supervisor')) {
            initSupervisorPage();
        } else {
            console.warn('script.js: Access denied to Supervisor Dashboard. Redirecting.');
            window.auth.showAuthError('Access Denied: You do not have permission for this page.');
            navigateTo(targetPathForRole || PathConfig.LOGIN, true);
        }
    } else if (path === PathConfig.LOGIN) {
        // Authenticated user somehow landed on login page (e.g. browser back button)
        redirectToDashboardBasedOnRole(true);
    }
    // Add other protected routes here if necessary
    // else if (path === '/some/other/protected/page.html') { ... }
    else {
        // If on an unknown protected path, redirect to their designated dashboard or login
        console.warn('script.js: Authenticated user on unknown path:', path, '. Redirecting.');
        redirectToDashboardBasedOnRole(true);
    }
    appState.currentRouteProcessed = true;
}


/**
 * Redirects an authenticated user to their appropriate dashboard based on role.
 * @param {boolean} replace - If true, use history.replaceState.
 */
function redirectToDashboardBasedOnRole(replace = false) {
    if (!appState.user) { // Should not happen if called for authenticated user
        navigateTo(PathConfig.LOGIN, true); // Force login if no user
        return;
    }

    if (window.auth && typeof window.auth.currentUserHasRole === 'function') {
        if (window.auth.currentUserHasRole('org_admin')) {
            console.log('script.js: Redirecting (org_admin) to Admin Dashboard.');
            navigateTo(PathConfig.ADMIN_DASHBOARD, replace);
        } else if (window.auth.currentUserHasRole('supervisor')) {
            console.log('script.js: Redirecting (supervisor) to Supervisor Dashboard.');
            navigateTo(PathConfig.SUPERVISOR_DASHBOARD, replace);
        } else {
            console.warn('script.js: User has no recognized dashboard role. Signing out and redirecting to login.');
            window.auth.showAuthError("Your account doesn't have a designated dashboard. Please contact support.");
            if (window.auth.signOut) window.auth.signOut(); // Sign out user if no role
            // SignOut will trigger onAuthStateChange -> 'SIGNED_OUT' -> navigateTo login.
        }
    } else {
        console.error('script.js: auth.currentUserHasRole is not available. Cannot determine dashboard. Redirecting to login.');
        navigateTo(PathConfig.LOGIN, replace);
    }
}

/**
 * Navigates to a new path using window.location.href (full page load).
 * This is simpler than history.pushState for distinct HTML files.
 * @param {string} path - The path to navigate to (e.g., '/public/admin.html').
 * @param {boolean} replace - If true, use location.replace (no back button history).
 */
function navigateTo(path, replace = false) {
    const currentFullHref = window.location.origin + appState.currentPagePath; // Using last known path
    const targetFullHref = window.location.origin + path;

    if (currentFullHref === targetFullHref && !replace) {
        console.log('script.js: navigateTo - Already on or navigating to same page:', path);
        // If on the same page, maybe just re-init content if needed, or do nothing.
        // For full page load navigation, this check prevents unnecessary reloads if path didn't change.
        // However, if logic demands it (e.g. after logout staying on login), it might still proceed.
        // This depends on if we want to prevent reloading login page if already on it.
        // For now, if path is same, we might just return to avoid loops.
        if (appState.currentPagePath === path) return;
    }

    console.log(`script.js: Navigating (full load) to: ${path}. Replace: ${replace}`);
    appState.currentPagePath = path; // Update before actual navigation
    appState.currentRouteProcessed = false; // New page will need processing

    if (replace) {
        window.location.replace(targetFullHref);
    } else {
        window.location.href = targetFullHref;
    }
}

// --- Page Specific Initializers ---

function initLoginPage() {
    console.log('script.js: initLoginPage() called for', PathConfig.LOGIN);
    appState.currentPagePath = PathConfig.LOGIN; // Ensure current page is set

    // Login form submission logic
    const loginForm = document.getElementById('loginForm');
    if (loginForm && !loginForm.hasAttribute('data-listener-attached')) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('script.js: Login form submitted via event listener.');
            if (window.auth && window.auth.hideAuthMessages) window.auth.hideAuthMessages();

            const emailInput = loginForm.querySelector('#email'); // Use querySelector for robustness
            const passwordInput = loginForm.querySelector('#password');
            const email = emailInput ? emailInput.value : null;
            const password = passwordInput ? passwordInput.value : null;

            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');

            if (window.auth && typeof window.auth.signIn === 'function') {
                await window.auth.signIn(email, password);
                // Auth state change will handle redirection.
            } else {
                console.error("script.js: auth.signIn function not available!");
                if (window.auth && window.auth.showAuthError) window.auth.showAuthError("Login service unavailable.");
            }

            if (loadingIndicator) loadingIndicator.classList.add('hidden');
        });
        loginForm.setAttribute('data-listener-attached', 'true');
    } else if (loginForm && loginForm.hasAttribute('data-listener-attached')) {
        console.log('script.js: Login form listener already attached.');
    } else {
        console.warn('script.js: Login form not found on login page.');
    }
    // Password reset UI (show/hide, cancel) is handled by inline script in login.html.
    // The actual `sendPasswordReset` call is made to `window.auth.sendPasswordReset`.
}

function initAdminPage() {
    console.log('script.js: initAdminPage() called for', PathConfig.ADMIN_DASHBOARD);
    appState.currentPagePath = PathConfig.ADMIN_DASHBOARD;

    // The admin.html page has its own inline script for UI (tabs, modals) and admin.js for data.
    // We just need to ensure admin.js's main function is called if it exists.
    if (typeof initializeAdminLogic === 'function') {
        console.log('script.js: Calling initializeAdminLogic() from admin.js');
        initializeAdminLogic();
    } else {
        console.warn('script.js: initializeAdminLogic function (from admin.js) not found. Admin page may not be fully functional.');
    }
    // The inline script in admin.html will handle its own DOMContentLoaded setup for UI components.
}

function initSupervisorPage() {
    console.log('script.js: initSupervisorPage() called for', PathConfig.SUPERVISOR_DASHBOARD);
    appState.currentPagePath = PathConfig.SUPERVISOR_DASHBOARD;

    // index.html (Supervisor Dashboard) has an extensive inline script for its UI.
    // This function ensures it's acknowledged. If supervisor-specific data loading beyond
    // what auth.js provides is needed from script.js, it would go here.
    // For now, we assume the inline script in index.html and its own logic will handle display.

    // Example of how you might ensure its inline script's UI setup is triggered if needed,
    // though DOMContentLoaded on that page should handle it naturally.
    // You might dispatch a custom event that the inline script listens for, e.g., 'renderSupervisorDashboard'
    // document.dispatchEvent(new CustomEvent('renderSupervisorDashboard'));

    // Minimal DOM manipulation from script.js for Supervisor page; let its own scripts manage it.
    const pageTitle = document.querySelector('title');
    if (pageTitle) pageTitle.textContent = "Supervisor Dashboard | Supervision System";

    const headerTitle = document.querySelector('nav h1'); // Example, use more specific selector
    if (headerTitle) headerTitle.textContent = "Supervisor Portal";
}

// --- Client-Side Routing Setup (Less critical if using full page reloads for navigation) ---
// The navigateTo with window.location.href makes this less about SPA content swapping
// and more about ensuring the correct page's init function is called upon full load.
// However, popstate is still useful for browser back/forward after initial full loads.
function setupClientSideRouting() {
    window.addEventListener('popstate', (event) => {
        const newPath = window.location.pathname;
        console.log('script.js: popstate event - new path:', newPath);
        // When using full page loads, popstate will reflect the new page already loaded.
        // Re-evaluate auth and current page context.
        // This might re-trigger the auth flow check if auth.js re-initializes.
        // For now, let's ensure our appState reflects the new path and re-validates.
        appState.currentPagePath = newPath;
        appState.currentRouteProcessed = false; // Allow re-processing
        // Re-check auth state and then handle route, as the user might have logged out in another tab.
        if (window.auth && window.auth.getCurrentUser) { // Await auth module readiness
             const user = window.auth.getCurrentUser();
             const orgData = window.auth.getCurrentUserOrgData();
             handleAuthenticationStateChange(user ? 'SIGNED_IN' : 'SIGNED_OUT', user, orgData);
        } else {
            console.warn("script.js: popstate - auth module not fully ready to re-evaluate state.");
        }
    });
    console.log('script.js: popstate listener set up.');
    // Link click interception is less critical if every navigation is a full page load.
    // If you want to *attempt* SPA-like navigation for some links and only full reload for others,
    // the click listener would need to be more nuanced.
    // For now, with window.location.href in navigateTo, most <a> clicks will naturally work.
}

// --- Initial call to ensure modules try to initialize based on their readiness ---
// This calls checkCoreServicesAndInitializeApp which starts the chain if all deps are met.
// Individual event listeners for DOMContentLoaded, supabaseClientReady, authModuleReady will also call it.
checkCoreServicesAndInitializeApp();