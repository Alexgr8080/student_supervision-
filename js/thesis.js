// thesis.js - For student thesis submission

// --- Module State ---
let thesisSupabaseClient = null;
let thesisCurrentUser = null;
let thesisFormData = {
  id: null,
  title: '',
  abstract: '',
  status: 'draft',
  files: []
};
let thesisFormMode = 'create'; // 'create' or 'edit'

// --- DOM Element Cache ---
const ThesisDOM = {
  formElement: null,
  titleInput: null,
  abstractTextarea: null,
  mainFileUploadInput: null,
  supportingFilesUploadInput: null,
  filesListContainer: null,
  submitBtn: null,
  saveAsDraftBtn: null,
  formStatusDisplay: null,
  formFeedbackDisplay: null
};

// --- Thesis Form Initialization ---
async function initializeThesisSubmission() {
  try {
    // Get Supabase client
    thesisSupabaseClient = getSupabaseClient();
    
    // Check authentication
    const { data: { user }, error } = await thesisSupabaseClient.auth.getUser();
    
    if (error || !user) {
      window.location.href = PathConfig.LOGIN;
      return;
    }
    
    thesisCurrentUser = user;
    
    // Cache DOM elements
    cacheThesisDOMElements();
    
    // Check if editing existing thesis
    const urlParams = new URLSearchParams(window.location.search);
    const thesisId = urlParams.get('id');
    
    if (thesisId) {
      thesisFormMode = 'edit';
      await loadExistingThesis(thesisId);
    }
    
    // Set up event listeners
    setupThesisFormEventListeners();
    
  } catch (err) {
    console.error('Thesis submission initialization failed:', err);
    displayErrorMessage('Failed to initialize form. Please try again later.');
  }
}

function cacheThesisDOMElements() {
  ThesisDOM.formElement = document.getElementById('thesis-form');
  ThesisDOM.titleInput = document.getElementById('thesis-title');
  ThesisDOM.abstractTextarea = document.getElementById('thesis-abstract');
  ThesisDOM.mainFileUploadInput = document.getElementById('main-file-upload');
  ThesisDOM.supportingFilesUploadInput = document.getElementById('supporting-files-upload');
  ThesisDOM.filesListContainer = document.getElementById('thesis-files-list');
  ThesisDOM.submitBtn = document.getElementById('submit-thesis-btn');
  ThesisDOM.saveAsDraftBtn = document.getElementById('save-draft-btn');
  ThesisDOM.formStatusDisplay = document.getElementById('thesis-status');
  ThesisDOM.formFeedbackDisplay = document.getElementById('thesis-feedback');
}

async function loadExistingThesis(thesisId) {
  try {
    // Fetch thesis data
    const { data: thesisData, error } = await thesisSupabaseClient
      .from('thesis_submissions')
      .select('*')
      .eq('id', thesisId)
      .eq('student_id', thesisCurrentUser.id)
      .single();
      
    if (error) throw error;
    
    if (!thesisData) {
      displayErrorMessage('Thesis not found or you do not have permission to edit it.');
      return;
    }
    
    // Populate form fields with existing data
    thesisFormData = thesisData;
    ThesisDOM.titleInput.value = thesisData.title;
    ThesisDOM.abstractTextarea.value = thesisData.abstract;
    
    // Update UI based on thesis status
    updateThesisStatusUI(thesisData.status);
    
    if (thesisData.supervisor_feedback) {
      ThesisDOM.formFeedbackDisplay.textContent = thesisData.supervisor_feedback;
      ThesisDOM.formFeedbackDisplay.parentElement.classList.remove('hidden');
    }
    
    // Load thesis files
    await loadThesisFiles(thesisId);
    
  } catch (err) {
    console.error('Failed to load thesis:', err);
    displayErrorMessage('Failed to load thesis data. Please try again.');
  }
}

async function loadThesisFiles(thesisId) {
  try {
    const { data: files, error } = await thesisSupabaseClient
      .from('thesis_files')
      .select('*')
      .eq('thesis_id', thesisId);
      
    if (error) throw error;
    
    thesisFormData.files = files || [];
    renderThesisFilesList();
    
  } catch (err) {
    console.error('Failed to load thesis files:', err);
  }
}

function renderThesisFilesList() {
  const container = ThesisDOM.filesListContainer;
  container.innerHTML = '';
  
  // Handle no files case
  if (!thesisFormData.files || thesisFormData.files.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No files uploaded yet</p>';
    return;
  }
  
  // Group files into main document and supporting documents
  const mainDocument = thesisFormData.files.find(file => file.is_main_document);
  const supportingFiles = thesisFormData.files.filter(file => !file.is_main_document);
  
  // Create main document section
  const mainSection = document.createElement('div');
  mainSection.className = 'mb-6';
  
  const mainHeader = document.createElement('h3');
  mainHeader.className = 'text-lg font-semibold mb-2';
  mainHeader.textContent = 'Main Thesis Document';
  mainSection.appendChild(mainHeader);
  
  if (mainDocument) {
    const fileItem = createFileListItem(mainDocument);
    mainSection.appendChild(fileItem);
  } else {
    const noMainDoc = document.createElement('p');
    noMainDoc.className = 'text-amber-600';
    noMainDoc.textContent = 'Main thesis document not uploaded yet';
    mainSection.appendChild(noMainDoc);
  }
  
  container.appendChild(mainSection);
  
  // Create supporting documents section
  const supportingSection = document.createElement('div');
  supportingSection.className = 'mt-4';
  
  const supportingHeader = document.createElement('h3');
  supportingHeader.className = 'text-lg font-semibold mb-2';
  supportingHeader.textContent = 'Supporting Documents';
  supportingSection.appendChild(supportingHeader);
  
  if (supportingFiles.length > 0) {
    const supportingList = document.createElement('ul');
    supportingList.className = 'divide-y divide-gray-200';
    
    supportingFiles.forEach(file => {
      const fileItem = createFileListItem(file);
      supportingList.appendChild(fileItem);
    });
    
    supportingSection.appendChild(supportingList);
  } else {
    const noSupporting = document.createElement('p');
    noSupporting.className = 'text-gray-500';
    noSupporting.textContent = 'No supporting documents uploaded';
    supportingSection.appendChild(noSupporting);
  }
  
  container.appendChild(supportingSection);
}

function createFileListItem(file) {
  const listItem = document.createElement('div');
  listItem.className = 'py-2 flex items-center justify-between';
  
  const fileInfo = document.createElement('div');
  fileInfo.className = 'flex-1';
  
  const fileName = document.createElement('div');
  fileName.className = 'font-medium';
  fileName.textContent = file.file_name;
  
  const fileDetails = document.createElement('div');
  fileDetails.className = 'text-sm text-gray-500';
  fileDetails.textContent = `${formatFileSize(file.file_size)} • Uploaded ${formatDate(file.uploaded_at)}`;
  
  fileInfo.appendChild(fileName);
  fileInfo.appendChild(fileDetails);
  
  const actionButtons = document.createElement('div');
  
  const viewBtn = document.createElement('button');
  viewBtn.className = 'text-blue-600 hover:text-blue-800 mr-3';
  viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', () => viewThesisFile(file));
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'text-red-600 hover:text-red-800';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => deleteThesisFile(file.id));
  
  // Only allow deletion if thesis is in draft or changes requested status
  if (['draft', 'supervisor_changes_requested'].includes(thesisFormData.status)) {
    actionButtons.appendChild(viewBtn);
    actionButtons.appendChild(deleteBtn);
  } else {
    actionButtons.appendChild(viewBtn);
  }
  
  listItem.appendChild(fileInfo);
  listItem.appendChild(actionButtons);
  
  return listItem;
}

function setupThesisFormEventListeners() {
  // Form submission
  ThesisDOM.formElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveThesisForm('submitted');
  });
  
  // Save as draft
  ThesisDOM.saveAsDraftBtn.addEventListener('click', async () => {
    await saveThesisForm('draft');
  });
  
  // Main file upload
  ThesisDOM.mainFileUploadInput.addEventListener('change', () => handleThesisFileUpload(true));
  
  // Supporting files upload
  ThesisDOM.supportingFilesUploadInput.addEventListener('change', () => handleThesisFileUpload(false));
}

async function handleThesisFileUpload(isMainDocument) {
  const fileInput = isMainDocument ? 
    ThesisDOM.mainFileUploadInput : 
    ThesisDOM.supportingFilesUploadInput;
    
  const files = fileInput.files;
  
  if (!files || files.length === 0) return;
  
  // First save the form if it's new
  if (thesisFormMode === 'create' && !thesisFormData.id) {
    const thesisId = await saveThesisForm('draft', true);
    if (!thesisId) return;
  }
  
  // If uploading a main document and one already exists, confirm replacement
  if (isMainDocument) {
    const existingMainDoc = thesisFormData.files.find(file => file.is_main_document);
    if (existingMainDoc && !confirm('A main thesis document already exists. Do you want to replace it?')) {
      fileInput.value = '';
      return;
    }
  }
  
  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Validate file type for main document (allow only PDFs)
    if (isMainDocument && file.type !== 'application/pdf') {
      displayErrorMessage('Main thesis document must be a PDF file.');
      fileInput.value = '';
      return;
    }
    
    // Upload file to Supabase Storage
    const filePath = `thesis_submissions/${thesisFormData.id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await thesisSupabaseClient.storage
      .from('thesis_files')
      .upload(filePath, file);
      
    if (uploadError) {
      console.error('File upload failed:', uploadError);
      continue;
    }
    
    // If this is a main document and one already exists, delete the old one
    if (isMainDocument) {
      const existingMainDoc = thesisFormData.files.find(file => file.is_main_document);
      if (existingMainDoc) {
        await deleteThesisFile(existingMainDoc.id, true);
      }
    }
    
    // Save file reference in database
    const { data: fileData, error: fileError } = await thesisSupabaseClient
      .from('thesis_files')
      .insert({
        thesis_id: thesisFormData.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        is_main_document: isMainDocument
      })
      .select()
      .single();
      
    if (fileError) {
      console.error('Failed to save file reference:', fileError);
      continue;
    }
    
    // Update local data
    thesisFormData.files = [...thesisFormData.files.filter(f => !(isMainDocument && f.is_main_document)), fileData];
  }
  
  // Clear file input and update UI
  fileInput.value = '';
  renderThesisFilesList();
}

async function viewThesisFile(file) {
  try {
    const { data, error } = await thesisSupabaseClient.storage
      .from('thesis_files')
      .createSignedUrl(file.file_path, 60); // 60 seconds expiry
      
    if (error) throw error;
    
    window.open(data.signedUrl, '_blank');
  } catch (err) {
    console.error('Failed to generate signed URL:', err);
    displayErrorMessage('Failed to access file. Please try again.');
  }
}

async function deleteThesisFile(fileId, skipConfirmation = false) {
  if (!skipConfirmation && !confirm('Are you sure you want to delete this file?')) return;
  
  try {
    // Find file to get file path
    const file = thesisFormData.files.find(f => f.id === fileId);
    if (!file) return;
    
    // Delete from storage
    const { error: storageError } = await thesisSupabaseClient.storage
      .from('thesis_files')
      .remove([file.file_path]);
      
    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
    }
    
    // Delete from database
    const { error: dbError } = await thesisSupabaseClient
      .from('thesis_files')
      .delete()
      .eq('id', fileId);
      
    if (dbError) throw dbError;
    
    // Update local array
    thesisFormData.files = thesisFormData.files.filter(f => f.id !== fileId);
    renderThesisFilesList();
    
  } catch (err) {
    console.error('Failed to delete file:', err);
    if (!skipConfirmation) {
      displayErrorMessage('Failed to delete file. Please try again.');
    }
  }
}

async function saveThesisForm(status, silentSave = false) {
  try {
    // Gather form data
    const formData = {
      title: ThesisDOM.titleInput.value.trim(),
      abstract: ThesisDOM.abstractTextarea.value.trim(),
      status: status
    };
    
    // Validation for submission
    if (status === 'submitted') {
      if (!formData.title) {
        displayErrorMessage('Please enter a title for your thesis.');
        return null;
      }
      
      if (!formData.abstract) {
        displayErrorMessage('Please provide an abstract for your thesis.');
        return null;
      }
      
      // Check if main document is uploaded
      const hasMainDocument = thesisFormData.id && 
        thesisFormData.files && 
        thesisFormData.files.some(file => file.is_main_document);
        
      if (!hasMainDocument) {
        displayErrorMessage('Please upload your main thesis document before submitting.');
        return null;
      }
    }
    
    let result;
    
    // For new thesis
    if (thesisFormMode === 'create' && !thesisFormData.id) {
      formData.student_id = thesisCurrentUser.id;
      
      // Set submission timestamp if submitting
      if (status === 'submitted') {
        formData.submitted_at = new Date().toISOString();
      }
      
      const { data, error } = await thesisSupabaseClient
        .from('thesis_submissions')
        .insert(formData)
        .select()
        .single();
        
      if (error) throw error;
      
      thesisFormData = { ...data, files: [] };
      thesisFormMode = 'edit';
      result = data.id;
      
    } else {
      // For existing thesis
      const updateData = { ...formData };
      
      // Set submission timestamp if submitting for the first time
      if (status === 'submitted' && !thesisFormData.submitted_at) {
        updateData.submitted_at = new Date().toISOString();
      }
      
      const { data, error } = await thesisSupabaseClient
        .from('thesis_submissions')
        .update(updateData)
        .eq('id', thesisFormData.id)
        .select()
        .single();
        
      if (error) throw error;
      
      thesisFormData = { ...data, files: thesisFormData.files };
      result = data.id;
    }
    
    // Update UI
    updateThesisStatusUI(status);
    
    if (!silentSave) {
      if (status === 'submitted') {
        displaySuccessMessage('Your thesis has been submitted for supervisor review.');
      } else {
        displaySuccessMessage('Your thesis has been saved as a draft.');
      }
    }
    
    return result;