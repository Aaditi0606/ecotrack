import { ACTIVITY_META } from './types.js';
// --- Application State ---
const AUTH_TOKEN_KEY = 'ecotrack_auth_token';
const AUTH_USER_KEY = 'ecotrack_auth_user';
let currentUser = null;
let authToken = null;
let isSubmitting = false;
let pendingDeleteId = null;
// --- Helper Functions ---
/**
 * Format ISO date string into a user-friendly local date (e.g., "Oct 11, 2026")
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime()))
            return dateString;
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
    catch {
        return dateString;
    }
}
/**
 * Get today's local date formatted as YYYY-MM-DD for date input
 */
function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/**
 * Returns authorization headers if user is logged in
 */
function getAuthHeaders(includeContentType = true) {
    const headers = {};
    if (includeContentType) {
        headers['Content-Type'] = 'application/json';
    }
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}
/**
 * Show accessible Toast message
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container)
        return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close notification">&times;</button>
  `;
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => {
        toast.remove();
    });
    container.appendChild(toast);
    // Auto-remove after 4.5 seconds
    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4500);
}
/**
 * Sanitize text to prevent HTML injection
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// --- DOM Elements ---
const activityForm = document.getElementById('activity-form');
const activityTypeSelect = document.getElementById('activity-type');
const activityDateInput = document.getElementById('activity-date');
const activityQuantityInput = document.getElementById('activity-quantity');
const quantityUnitLabel = document.getElementById('quantity-unit-label');
const activityDescInput = document.getElementById('activity-description');
const charCountSpan = document.getElementById('char-count');
const submitBtn = document.getElementById('submit-btn');
const formFeedback = document.getElementById('form-feedback');
// Auth Header Elements
const openAuthBtn = document.getElementById('open-auth-btn');
const userProfileBadge = document.getElementById('user-profile-badge');
const userAvatarInitials = document.getElementById('user-avatar-initials');
const userDisplayName = document.getElementById('user-display-name');
const signoutBtn = document.getElementById('signout-btn');
// Auth Gate & App View Elements
const authGateView = document.getElementById('auth-gate-view');
const appView = document.getElementById('app-view');
const guestContinueBtn = document.getElementById('guest-continue-btn');
const authGateHeading = document.getElementById('auth-gate-heading');
const authGateSubheading = document.getElementById('auth-gate-subheading');
const tabSigninBtn = document.getElementById('tab-signin-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const authFeedback = document.getElementById('auth-feedback');
const signinFormWrapper = document.getElementById('signin-form-wrapper');
const registerFormWrapper = document.getElementById('register-form-wrapper');
const signinForm = document.getElementById('signin-form');
const signinUsername = document.getElementById('signin-username');
const signinPassword = document.getElementById('signin-password');
const signinSubmitBtn = document.getElementById('signin-submit-btn');
const switchToRegisterLink = document.getElementById('switch-to-register-link');
const registerForm = document.getElementById('register-form');
const registerUsername = document.getElementById('register-username');
const registerDisplayName = document.getElementById('register-displayname');
const registerPassword = document.getElementById('register-password');
const registerConfirmPassword = document.getElementById('register-confirm-password');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const switchToSigninLink = document.getElementById('switch-to-signin-link');
// Summary Elements
const statTotalActivities = document.getElementById('stat-total-activities');
const statThisWeek = document.getElementById('stat-this-week');
const statImpactCo2 = document.getElementById('stat-impact-co2');
const statImpactSub = document.getElementById('stat-impact-sub');
const impactEngineBadge = document.getElementById('impact-engine-badge');
const emptyDashboardBanner = document.getElementById('empty-dashboard-banner');
// Recent Activities Elements
const activitiesList = document.getElementById('activities-list');
const activitiesCountBadge = document.getElementById('activities-count-badge');
// Progress Chart Container
const chartContainer = document.getElementById('chart-container');
const habitBreakdownContainer = document.getElementById('habit-breakdown');
// Confirmation Modal Elements
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
// --- API Communication ---
/**
 * Fetch and render all dashboard data
 */
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard', {
            headers: getAuthHeaders(false)
        });
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        const json = await response.json();
        if (!json.success || !json.data) {
            throw new Error(json.error || 'Failed to parse dashboard data');
        }
        renderDashboard(json.data);
    }
    catch (error) {
        console.error('Failed to load dashboard:', error);
        showToast('Failed to load dashboard statistics. Ensure backend is running.', 'error');
    }
}
/**
 * Render complete dashboard UI
 */
function renderDashboard(data) {
    const { totalActivities, thisWeekActivities, impact, dailyProgress, recentActivities, isEmpty } = data;
    // 1. Summary Cards
    if (statTotalActivities)
        statTotalActivities.textContent = totalActivities.toLocaleString();
    if (statThisWeek)
        statThisWeek.textContent = thisWeekActivities.toLocaleString();
    if (statImpactCo2) {
        const co2 = impact.total_co2e_saved_kg || 0;
        statImpactCo2.textContent = `${co2.toFixed(2)} kg`;
    }
    if (statImpactSub) {
        const metrics = impact.tangible_metrics;
        if (metrics && (metrics.bottles_diverted > 0 || metrics.clean_transit_km > 0 || metrics.waste_sorting_sessions > 0 || metrics.trees_stewarded > 0)) {
            const parts = [];
            if (metrics.bottles_diverted > 0)
                parts.push(`${metrics.bottles_diverted} bottles diverted`);
            if (metrics.clean_transit_km > 0)
                parts.push(`${metrics.clean_transit_km} km clean transit`);
            if (metrics.waste_sorting_sessions > 0)
                parts.push(`${metrics.waste_sorting_sessions} waste sortings`);
            if (metrics.trees_stewarded > 0)
                parts.push(`${metrics.trees_stewarded} trees nurtured`);
            statImpactSub.textContent = parts.slice(0, 2).join(' • ');
        }
        else {
            statImpactSub.textContent = 'Estimated CO₂e emissions avoided';
        }
    }
    // Engine source badge
    if (impactEngineBadge) {
        const engineText = impact.engine || 'Flask Microservice';
        impactEngineBadge.textContent = engineText;
        if (impact.service_status === 'connected') {
            impactEngineBadge.className = 'engine-badge engine-flask';
            impactEngineBadge.title = 'Impact calculated by Python/Flask calculation microservice';
        }
        else {
            impactEngineBadge.className = 'engine-badge engine-fallback';
            impactEngineBadge.title = 'Calculated via Node.js baseline engine';
        }
    }
    // Empty dashboard banner
    if (emptyDashboardBanner) {
        emptyDashboardBanner.style.display = isEmpty ? 'flex' : 'none';
    }
    // 2. Recent Activities List
    renderActivitiesList(recentActivities);
    // 3. Progress Chart
    renderProgressChart(dailyProgress, impact);
}
/**
 * Render the Recent Activities Section
 */
function renderActivitiesList(activities) {
    if (!activitiesList)
        return;
    if (activitiesCountBadge) {
        activitiesCountBadge.textContent = activities.length.toString();
    }
    if (activities.length === 0) {
        activitiesList.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-icon">🍃</div>
        <h3 class="empty-title">No activities recorded yet</h3>
        <p class="empty-text">Your eco-friendly journey starts here. Use the form above to log your first action today!</p>
      </div>
    `;
        return;
    }
    activitiesList.innerHTML = activities
        .map((act) => {
        const meta = ACTIVITY_META[act.activityType] || {
            id: act.activityType,
            label: act.activityType,
            unitLabel: 'units',
            badgeClass: 'badge-default',
            icon: '🌿'
        };
        return `
        <article class="activity-card" data-id="${act._id}">
          <div class="activity-icon-col">
            <span class="activity-emoji" aria-hidden="true">${meta.icon}</span>
          </div>
          <div class="activity-details-col">
            <div class="activity-header-row">
              <span class="badge ${meta.badgeClass}">${escapeHtml(meta.label)}</span>
              ${act.username ? `<span class="badge badge-user" title="Logged by ${escapeHtml(act.username)}">👤 ${escapeHtml(act.username)}</span>` : ''}
              <time class="activity-date" datetime="${act.activityDate}">${formatDate(act.activityDate)}</time>
            </div>
            <div class="activity-metric-row">
              <span class="activity-qty-value">${act.quantity}</span>
              <span class="activity-unit-text">${escapeHtml(meta.unitLabel)}</span>
            </div>
            ${act.description ? `<p class="activity-desc">${escapeHtml(act.description)}</p>` : ''}
          </div>
          <div class="activity-action-col">
            <button 
              type="button" 
              class="btn-delete" 
              data-delete-id="${act._id}" 
              data-activity-name="${meta.label}"
              title="Delete activity"
              aria-label="Delete activity: ${escapeHtml(meta.label)}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </article>
      `;
    })
        .join('');
    // Attach delete handlers
    const deleteButtons = activitiesList.querySelectorAll('[data-delete-id]');
    deleteButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-delete-id');
            const name = btn.getAttribute('data-activity-name') || 'Activity';
            if (id) {
                promptDeleteConfirmation(id, name);
            }
        });
    });
}
/**
 * Render Progress Chart (SVG bar chart + habit breakdown pills)
 */
function renderProgressChart(dailyProgress, impact) {
    if (!chartContainer)
        return;
    const maxCount = Math.max(...dailyProgress.map((d) => d.count), 4);
    const chartHeight = 160;
    const chartWidth = 560;
    const barWidth = 36;
    const totalBars = dailyProgress.length;
    const gap = (chartWidth - totalBars * barWidth) / (totalBars + 1);
    // SVG representation for sharpness and zero external dependencies
    const barsSvg = dailyProgress
        .map((item, index) => {
        const x = gap + index * (barWidth + gap);
        const barH = (item.count / maxCount) * (chartHeight - 40);
        const y = chartHeight - 24 - barH;
        const countY = Math.max(y - 6, 12);
        const isZero = item.count === 0;
        return `
        <g class="chart-bar-group" tabindex="0" role="graphics-symbol" aria-label="${item.shortLabel}: ${item.count} activities">
          <!-- Count label above bar -->
          <text 
            x="${x + barWidth / 2}" 
            y="${countY}" 
            text-anchor="middle" 
            class="chart-count-label ${isZero ? 'zero' : ''}"
          >${item.count}</text>
          <!-- The Bar -->
          <rect 
            x="${x}" 
            y="${y}" 
            width="${barWidth}" 
            height="${Math.max(barH, 4)}" 
            rx="6" 
            ry="6" 
            class="chart-bar ${isZero ? 'chart-bar-zero' : 'chart-bar-filled'}"
          />
          <!-- Day label below bar -->
          <text 
            x="${x + barWidth / 2}" 
            y="${chartHeight - 4}" 
            text-anchor="middle" 
            class="chart-day-label"
          >${escapeHtml(item.dayName)}</text>
        </g>
      `;
    })
        .join('');
    chartContainer.innerHTML = `
    <div class="chart-wrapper">
      <div class="chart-header-row">
        <span class="chart-label">Activities logged per day (Last 7 Days)</span>
        <span class="chart-legend"><span class="legend-dot"></span> Recorded count</span>
      </div>
      <div class="svg-container">
        <svg 
          viewBox="0 0 ${chartWidth} ${chartHeight}" 
          class="progress-svg" 
          role="img" 
          aria-label="Bar chart showing weekly activity consistency"
        >
          <!-- Subtle baseline -->
          <line x1="0" y1="${chartHeight - 24}" x2="${chartWidth}" y2="${chartHeight - 24}" class="chart-axis-line" />
          ${barsSvg}
        </svg>
      </div>
    </div>
  `;
    // Render habit breakdown category strip
    if (habitBreakdownContainer && impact.category_totals) {
        const categories = Object.values(impact.category_totals).filter((c) => c.quantity > 0);
        if (categories.length === 0) {
            habitBreakdownContainer.innerHTML = `
        <div class="breakdown-empty">No activity breakdown available yet. Complete your first action to see habit distributions.</div>
      `;
        }
        else {
            habitBreakdownContainer.innerHTML = categories
                .map((c) => `
          <div class="breakdown-pill">
            <span class="pill-title">${escapeHtml(c.label)}</span>
            <span class="pill-qty">${c.quantity} ${escapeHtml(c.unit)}</span>
            <span class="pill-co2">${c.co2e_saved_kg} kg CO₂e</span>
          </div>
        `)
                .join('');
        }
    }
}
// --- Activity Form Interactions & Validation ---
/**
 * Update the dynamic quantity unit label and placeholders when activity type changes
 */
function updateActivityTypeUI() {
    const selectedType = activityTypeSelect.value;
    const meta = ACTIVITY_META[selectedType];
    if (meta) {
        quantityUnitLabel.textContent = meta.unitLabel;
        activityQuantityInput.placeholder = meta.quantityPlaceholder;
        activityQuantityInput.min = meta.min.toString();
        activityQuantityInput.step = meta.step.toString();
        if (!activityQuantityInput.value) {
            activityQuantityInput.value = meta.min.toString();
        }
    }
}
/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    if (isSubmitting)
        return;
    // Clear previous errors
    formFeedback.className = 'form-feedback';
    formFeedback.innerHTML = '';
    formFeedback.style.display = 'none';
    const type = activityTypeSelect.value.trim();
    const dateVal = activityDateInput.value.trim();
    const qtyVal = parseFloat(activityQuantityInput.value);
    const descVal = activityDescInput.value.trim();
    // 1. Validation: Activity Type
    if (!type || !ACTIVITY_META[type]) {
        displayFormError('Please select a valid activity type from the list.');
        activityTypeSelect.focus();
        return;
    }
    // 2. Validation: Date
    if (!dateVal) {
        displayFormError('Please select the date of your activity.');
        activityDateInput.focus();
        return;
    }
    const selectedDate = new Date(dateVal);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (isNaN(selectedDate.getTime())) {
        displayFormError('The selected date is invalid.');
        activityDateInput.focus();
        return;
    }
    if (selectedDate > today) {
        displayFormError('Activity date cannot be in the future.');
        activityDateInput.focus();
        return;
    }
    // 3. Validation: Quantity
    if (isNaN(qtyVal) || qtyVal <= 0) {
        displayFormError('Please enter a positive quantity greater than 0.');
        activityQuantityInput.focus();
        return;
    }
    // 4. Validation: Description length
    if (descVal.length > 200) {
        displayFormError('Description cannot exceed 200 characters.');
        activityDescInput.focus();
        return;
    }
    // Prevent duplicate submissions and show loading state
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.innerHTML = `
    <span class="spinner" aria-hidden="true"></span>
    <span>Saving Activity...</span>
  `;
    try {
        const payload = {
            activityType: type,
            activityDate: dateVal,
            quantity: qtyVal,
            description: descVal
        };
        const response = await fetch('/api/activities', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to save activity record');
        }
        // Success: Reset form inputs to defaults
        activityForm.reset();
        activityDateInput.value = getTodayDateString();
        updateActivityTypeUI();
        if (charCountSpan)
            charCountSpan.textContent = '0/200';
        showToast('Activity logged successfully! Great job taking sustainable action.', 'success');
        // Smoothly refresh the dashboard
        await loadDashboard();
        // Scroll slightly to dashboard if on mobile
        if (window.innerWidth < 768) {
            document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
        }
    }
    catch (error) {
        console.error('Submission error:', error);
        displayFormError(error.message || 'Network error occurred while saving.');
        showToast(error.message || 'Failed to save activity', 'error');
    }
    finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      <span>Save Activity</span>
    `;
    }
}
function displayFormError(msg) {
    if (!formFeedback)
        return;
    formFeedback.className = 'form-feedback error';
    formFeedback.innerHTML = `
    <span class="feedback-icon">⚠️</span>
    <span>${escapeHtml(msg)}</span>
  `;
    formFeedback.style.display = 'flex';
}
// --- Delete Modal Management ---
function promptDeleteConfirmation(id, name) {
    pendingDeleteId = id;
    const modalText = document.getElementById('delete-modal-text');
    if (modalText) {
        modalText.textContent = `Are you sure you want to remove this ${name} activity record? This action cannot be undone.`;
    }
    if (deleteModal) {
        deleteModal.classList.add('active');
        deleteModal.setAttribute('aria-hidden', 'false');
        confirmDeleteBtn?.focus();
    }
}
function closeDeleteModal() {
    pendingDeleteId = null;
    if (deleteModal) {
        deleteModal.classList.remove('active');
        deleteModal.setAttribute('aria-hidden', 'true');
    }
}
async function executeDeleteActivity() {
    if (!pendingDeleteId)
        return;
    const id = pendingDeleteId;
    closeDeleteModal();
    try {
        const res = await fetch(`/api/activities/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(false)
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            throw new Error(result.error || 'Failed to delete activity.');
        }
        showToast('Activity record removed successfully.', 'info');
        await loadDashboard();
    }
    catch (err) {
        console.error('Delete error:', err);
        showToast(err.message || 'Failed to delete activity', 'error');
    }
}
// --- Mobile Navigation & Smooth Scroll ---
function initNavigation() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const navMenu = document.getElementById('main-nav');
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', String(!isExpanded));
            navMenu.classList.toggle('nav-open');
        });
        // Close menu when a link is clicked
        navMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                menuToggle.setAttribute('aria-expanded', 'false');
                navMenu.classList.remove('nav-open');
            });
        });
    }
}
// --- Authentication & View State Management ---
function showAuthView(tab = 'signin') {
    if (authGateView) {
        authGateView.style.display = 'flex';
    }
    if (appView) {
        appView.style.display = 'none';
    }
    switchAuthTab(tab);
    clearAuthFeedback();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showAppView() {
    if (authGateView) {
        authGateView.style.display = 'none';
    }
    if (appView) {
        appView.style.display = 'block';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function switchAuthTab(tab) {
    clearAuthFeedback();
    if (tab === 'signin') {
        tabSigninBtn?.classList.add('active');
        tabSigninBtn?.setAttribute('aria-selected', 'true');
        tabRegisterBtn?.classList.remove('active');
        tabRegisterBtn?.setAttribute('aria-selected', 'false');
        if (signinFormWrapper)
            signinFormWrapper.style.display = 'block';
        if (registerFormWrapper)
            registerFormWrapper.style.display = 'none';
        if (authGateHeading)
            authGateHeading.textContent = 'Welcome Back';
        if (authGateSubheading)
            authGateSubheading.textContent = 'Sign in to access your personal dashboard & saved activities';
        signinUsername?.focus();
    }
    else {
        tabRegisterBtn?.classList.add('active');
        tabRegisterBtn?.setAttribute('aria-selected', 'true');
        tabSigninBtn?.classList.remove('active');
        tabSigninBtn?.setAttribute('aria-selected', 'false');
        if (signinFormWrapper)
            signinFormWrapper.style.display = 'none';
        if (registerFormWrapper)
            registerFormWrapper.style.display = 'block';
        if (authGateHeading)
            authGateHeading.textContent = 'Create an Account';
        if (authGateSubheading)
            authGateSubheading.textContent = 'Join EcoTrack and track your personal sustainability journey';
        registerUsername?.focus();
    }
}
function displayAuthFeedback(msg, type = 'error') {
    if (!authFeedback)
        return;
    authFeedback.className = `auth-feedback ${type}`;
    authFeedback.innerHTML = `
    <span>${type === 'error' ? '⚠️' : '✓'}</span>
    <span>${escapeHtml(msg)}</span>
  `;
    authFeedback.style.display = 'flex';
}
function clearAuthFeedback() {
    if (!authFeedback)
        return;
    authFeedback.style.display = 'none';
    authFeedback.innerHTML = '';
}
async function handleSignIn(e) {
    e.preventDefault();
    const username = signinUsername?.value.trim() || '';
    const password = signinPassword?.value || '';
    if (!username) {
        displayAuthFeedback('Please enter your username.', 'error');
        signinUsername?.focus();
        return;
    }
    if (!password) {
        displayAuthFeedback('Please enter your password.', 'error');
        signinPassword?.focus();
        return;
    }
    if (signinSubmitBtn) {
        signinSubmitBtn.disabled = true;
        signinSubmitBtn.innerHTML = '<span>Signing In...</span>';
    }
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.token || !data.user) {
            throw new Error(data.error || 'Failed to sign in.');
        }
        setSession(data.token, data.user);
        showAppView();
        if (signinForm)
            signinForm.reset();
        showToast(`Welcome back, ${data.user.displayName || data.user.username}!`, 'success');
        await loadDashboard();
    }
    catch (err) {
        displayAuthFeedback(err.message || 'Invalid username or password.', 'error');
    }
    finally {
        if (signinSubmitBtn) {
            signinSubmitBtn.disabled = false;
            signinSubmitBtn.innerHTML = '<span>Sign In</span>';
        }
    }
}
async function handleRegister(e) {
    e.preventDefault();
    const username = registerUsername?.value.trim() || '';
    const displayName = registerDisplayName?.value.trim() || '';
    const password = registerPassword?.value || '';
    const confirmPassword = registerConfirmPassword?.value || '';
    if (!username || username.length < 3) {
        displayAuthFeedback('Username must be at least 3 characters.', 'error');
        registerUsername?.focus();
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        displayAuthFeedback('Username can only contain letters, numbers, and underscores.', 'error');
        registerUsername?.focus();
        return;
    }
    if (!password || password.length < 6) {
        displayAuthFeedback('Password must be at least 6 characters.', 'error');
        registerPassword?.focus();
        return;
    }
    if (password !== confirmPassword) {
        displayAuthFeedback('Passwords do not match. Please re-enter.', 'error');
        registerConfirmPassword?.focus();
        return;
    }
    if (registerSubmitBtn) {
        registerSubmitBtn.disabled = true;
        registerSubmitBtn.innerHTML = '<span>Creating Account...</span>';
    }
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, displayName })
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.token || !data.user) {
            throw new Error(data.error || 'Failed to create account.');
        }
        setSession(data.token, data.user);
        showAppView();
        if (registerForm)
            registerForm.reset();
        showToast(`Account created! Welcome to EcoTrack, ${data.user.displayName || data.user.username}!`, 'success');
        await loadDashboard();
    }
    catch (err) {
        displayAuthFeedback(err.message || 'Failed to create account.', 'error');
    }
    finally {
        if (registerSubmitBtn) {
            registerSubmitBtn.disabled = false;
            registerSubmitBtn.innerHTML = '<span>Create Account</span>';
        }
    }
}
function setSession(token, user) {
    authToken = token;
    currentUser = user;
    try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    catch (e) {
        console.warn('LocalStorage save error:', e);
    }
    updateAuthUI();
}
function handleSignOut() {
    authToken = null;
    currentUser = null;
    try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    }
    catch { }
    updateAuthUI();
    showAuthView('signin');
    showToast('You have been signed out.', 'info');
    loadDashboard();
}
function updateAuthUI() {
    if (currentUser) {
        if (openAuthBtn)
            openAuthBtn.style.display = 'none';
        if (userProfileBadge) {
            userProfileBadge.style.display = 'inline-flex';
            const name = currentUser.displayName || currentUser.username;
            if (userDisplayName)
                userDisplayName.textContent = name;
            if (userAvatarInitials)
                userAvatarInitials.textContent = name.charAt(0).toUpperCase();
        }
    }
    else {
        if (openAuthBtn)
            openAuthBtn.style.display = 'inline-flex';
        if (userProfileBadge)
            userProfileBadge.style.display = 'none';
    }
}
function initSession() {
    try {
        const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        const savedUser = localStorage.getItem(AUTH_USER_KEY);
        if (savedToken && savedUser) {
            authToken = savedToken;
            currentUser = JSON.parse(savedUser);
            updateAuthUI();
            showAppView();
            // Verify token in background
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            }).then((res) => {
                if (!res.ok) {
                    // Token expired or invalid
                    authToken = null;
                    currentUser = null;
                    localStorage.removeItem(AUTH_TOKEN_KEY);
                    localStorage.removeItem(AUTH_USER_KEY);
                    updateAuthUI();
                    showAuthView('signin');
                    showToast('Session expired. Please sign in again.', 'info');
                }
            }).catch(() => { });
        }
        else {
            updateAuthUI();
            showAuthView('signin');
        }
    }
    catch {
        updateAuthUI();
        showAuthView('signin');
    }
}
// --- Application Initialization ---
function init() {
    // 1. Initialize user authentication state
    initSession();
    // 2. Initialize Date Input to Today and set max date constraint
    if (activityDateInput) {
        const todayStr = getTodayDateString();
        activityDateInput.value = todayStr;
        activityDateInput.max = todayStr;
    }
    // 3. Initialize Activity Type dropdown listener
    if (activityTypeSelect) {
        activityTypeSelect.addEventListener('change', updateActivityTypeUI);
        updateActivityTypeUI();
    }
    // 4. Description Character Counter
    if (activityDescInput && charCountSpan) {
        activityDescInput.addEventListener('input', () => {
            const len = activityDescInput.value.length;
            charCountSpan.textContent = `${len}/200`;
            if (len > 200) {
                charCountSpan.classList.add('char-limit-exceeded');
            }
            else {
                charCountSpan.classList.remove('char-limit-exceeded');
            }
        });
    }
    // 5. Activity Form Submission Listener
    if (activityForm) {
        activityForm.addEventListener('submit', handleFormSubmit);
    }
    // 6. Delete Modal Listeners
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDeleteActivity);
    }
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal)
                closeDeleteModal();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && deleteModal.classList.contains('active')) {
                closeDeleteModal();
            }
        });
    }
    // 7. Auth Gate & Form Listeners
    if (openAuthBtn) {
        openAuthBtn.addEventListener('click', () => showAuthView('signin'));
    }
    if (guestContinueBtn) {
        guestContinueBtn.addEventListener('click', () => {
            showAppView();
            showToast('Browsing as guest. You can sign in anytime to link your activities.', 'info');
        });
    }
    tabSigninBtn?.addEventListener('click', () => switchAuthTab('signin'));
    tabRegisterBtn?.addEventListener('click', () => switchAuthTab('register'));
    switchToRegisterLink?.addEventListener('click', () => switchAuthTab('register'));
    switchToSigninLink?.addEventListener('click', () => switchAuthTab('signin'));
    signinForm?.addEventListener('submit', handleSignIn);
    registerForm?.addEventListener('submit', handleRegister);
    signoutBtn?.addEventListener('click', handleSignOut);
    // Password visibility toggle buttons
    document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if (!targetId)
                return;
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = '🙈';
                    btn.setAttribute('aria-label', 'Hide password');
                }
                else {
                    input.type = 'password';
                    btn.textContent = '👁️';
                    btn.setAttribute('aria-label', 'Show password');
                }
            }
        });
    });
    // 8. Navigation
    initNavigation();
    // 9. Initial Data Fetch
    loadDashboard();
}
// Start app once DOM is parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
//# sourceMappingURL=main.js.map