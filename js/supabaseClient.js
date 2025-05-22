// supabaseClient.js - Updated with error handling and connection verification

// --- Configuration ---
const SUPABASE_URL = 'https://clfnsthhfrjwqbeokckl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsZm5zdGhoZnJqd3FiZW9rY2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMjM1MzYsImV4cCI6MjA2MjU5OTUzNn0.012pMCsog50ci3LZognLkugYE-cci1rPXV0ThbKXnGI';

let supabaseClient = null; // Declare the variable
let connectionVerified = false; // Declare the variable

async function initializeSupabaseClient() {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase configuration missing');
        }

        // Ensure Supabase SDK is loaded
        if (typeof supabase === 'undefined' || !supabase.createClient) {
            console.error('Supabase SDK not loaded. Please ensure it is included in your HTML before this script.');
            throw new Error('Supabase SDK not loaded.');
        }

        // Initialize the client
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Verify connection with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        let connected = false;

        while (!connected && retryCount < maxRetries) {
            try {
                // Simple query to verify connection
                const { data, error } = await supabaseClient.from('organizations').select('id').limit(1); // Ensure 'organizations' table exists or use a generic check
                if (!error) {
                    connected = true;
                    connectionVerified = true;
                    console.log('Database connection verified successfully');
                    // Dispatch an event to notify other scripts that Supabase is ready
                    document.dispatchEvent(new CustomEvent('supabaseConnectionReady', { detail: supabaseClient }));
                    return supabaseClient;
                }
                retryCount++;
                console.warn(`Connection attempt ${retryCount} failed: ${error?.message}. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } catch (innerError) {
                retryCount++;
                console.error(`Connection attempt ${retryCount} error:`, innerError);
                 await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Added retry delay here too
            }
        }

        if (!connected) {
            throw new Error('Failed to connect to database after multiple attempts');
        }
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error.message);
        // Replace displaySystemAlert with a standard alert or console log
        alert('Database connection error. Please try again later or contact support. Check console for details.');
        // Optionally, you can create a more user-friendly error display on the page
        displayConnectionError(error.message); // Ensure this function is defined or remove
        return null;
    }
}

// Helper to display connection errors to the user (ensure this is styled and placed appropriately)
function displayConnectionError(message) {
  let errorContainer = document.getElementById('supabase-connection-error');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'supabase-connection-error';
    // Basic styling, you might want to use classes from your CSS framework
    errorContainer.style.position = 'fixed';
    errorContainer.style.top = '10px';
    errorContainer.style.left = '50%';
    errorContainer.style.transform = 'translateX(-50%)';
    errorContainer.style.padding = '10px';
    errorContainer.style.backgroundColor = 'red';
    errorContainer.style.color = 'white';
    errorContainer.style.zIndex = '10000';
    errorContainer.style.borderRadius = '5px';
    document.body.prepend(errorContainer);
  }
  errorContainer.innerHTML = `<strong>Database Connection Error:</strong> ${message}. Please refresh the page or contact support.`;
}

// Public getter for the Supabase client
function getSupabaseClient() {
  if (!supabaseClient && !connectionVerified) { // Check connectionVerified to avoid re-initializing if already failed permanently
    console.warn('Supabase client accessed before successful initialization or initialization failed. Attempting to initialize...');
    // No await here, as getSupabaseClient is often called synchronously.
    // Initialization is async and will set supabaseClient when done.
    // Other modules should listen for 'supabaseConnectionReady'.
    initializeSupabaseClient();
  }
  return supabaseClient;
}

// Initialize on page load - this attempts to initialize early.
// Other scripts should ideally wait for the 'supabaseConnectionReady' event.
document.addEventListener('DOMContentLoaded', initializeSupabaseClient);

// Export functions (if not using ES modules, they are already global)
window.getSupabaseClient = getSupabaseClient;
window.initializeSupabaseClient = initializeSupabaseClient;