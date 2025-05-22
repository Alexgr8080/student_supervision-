// auth.js - Updated with robust error handling and session management

// --- Module State ---
let authCurrentUser = null;
let authUserOrganizationData = null;
const authStateChangeListeners = new Set();
let authModuleFullyInitialized = false;

// --- Custom Event Names for this Module ---
const AuthModuleEvents = {
  AUTH_MODULE_READY: 'authModuleReady',
  AUTH_STATE_CHANGED: 'authStateChanged',
  AUTH_ERROR: 'authError'
};

// --- Initialize auth module ---
async function initializeAuth() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Set up auth state change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth state changed: ${event}`);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          authCurrentUser = session.user;
          await loadUserOrganizationData(authCurrentUser.id);
          notifyAuthStateListeners('SIGNED_IN', authCurrentUser, authUserOrganizationData);
        }
      } else if (event === 'SIGNED_OUT') {
        authCurrentUser = null;
        authUserOrganizationData = null;
        notifyAuthStateListeners('SIGNED_OUT', null, null);
      }
    });

    // Check for existing session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(`Session retrieval error: ${error.message}`);
    }

    if (session) {
      authCurrentUser = session.user;
      await loadUserOrganizationData(authCurrentUser.id);
    }

    authModuleFullyInitialized = true;
    document.dispatchEvent(new CustomEvent(AuthModuleEvents.AUTH_MODULE_READY));
    
    if (authCurrentUser) {
      notifyAuthStateListeners('INITIALIZED', authCurrentUser, authUserOrganizationData);
    }
    
    return { user: authCurrentUser, orgData: authUserOrganizationData };
    
  } catch (err) {
    console.error('Auth initialization error:', err);
    document.dispatchEvent(new CustomEvent(AuthModuleEvents.AUTH_ERROR, { 
      detail: { message: err.message } 
    }));
    showAuthError(err.message);
    return { user: null, orgData: null, error: err.message };
  }
}

// Load user organization data including roles
async function loadUserOrganizationData(userId) {
  try {
    if (!userId) return null;
    
    const supabase = getSupabaseClient();
    
    // First get the user's organization
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();
      
    if (userError) throw new Error(`Failed to get user organization: ${userError.message}`);
    if (!userData || !userData.organization_id) return null;
    
    // Get organization details
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', userData.organization_id)
      .single();
      
    if (orgError) throw new Error(`Failed to get organization details: ${orgError.message}`);
    
    // Get user roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('id, role_name, permissions')
      .eq('user_id', userId);
      
    if (rolesError) throw new Error(`Failed to get user roles: ${rolesError.message}`);
    
    // Combine the data
    authUserOrganizationData = {
      organization: orgData,
      roles: rolesData || []
    };
    
    return authUserOrganizationData;
    
  } catch (err) {
    console.error('Error loading user organization data:', err);
    showAuthError('Error loading user data: ' + err.message);
    return null;
  }
}

// Notify listeners of auth state changes
function notifyAuthStateListeners(eventType, user, orgData) {
  document.dispatchEvent(new CustomEvent(AuthModuleEvents.AUTH_STATE_CHANGED, {
    detail: { eventType, user, orgData }
  }));
  
  // Also notify registered listeners
  authStateChangeListeners.forEach(listener => {
    try {
      listener(eventType, user, orgData);
    } catch (err) {
      console.error('Error in auth state change listener:', err);
    }
  });
}

// Show authentication error to user
function showAuthError(message) {
  let errorContainer = document.getElementById('auth-error-container');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'auth-error-container';
    errorContainer.className = 'alert alert-danger fixed-top m-3';
    document.body.append(errorContainer);
  }
  errorContainer.innerHTML = `<strong>Authentication Error:</strong> ${message}`;
  errorContainer.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }, 5000);
}

// Public functions
function getCurrentUser() {
  return authCurrentUser;
}

function getUserOrgData() {
  return authUserOrganizationData;
}

function addAuthStateChangeListener(listener) {
  if (typeof listener === 'function') {
    authStateChangeListeners.add(listener);
    
    // Immediately call with current state if initialized
    if (authModuleFullyInitialized) {
      try {
        listener('CURRENT_STATE', authCurrentUser, authUserOrganizationData);
      } catch (err) {
        console.error('Error in new auth state listener:', err);
      }
    }
  }
}

function removeAuthStateChangeListener(listener) {
  authStateChangeListeners.delete(listener);
}

async function signOut() {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Will be handled by onAuthStateChange
    return { success: true };
  } catch (err) {
    console.error('Sign out error:', err);
    showAuthError('Sign out failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

// Initialize on page load
document.addEventListener('supabaseConnectionReady', initializeAuth);

// Export public functions
window.getCurrentUser = getCurrentUser;
window.getUserOrgData = getUserOrgData;
window.addAuthStateChangeListener = addAuthStateChangeListener;
window.removeAuthStateChangeListener = removeAuthStateChangeListener;
window.signOut = signOut;
