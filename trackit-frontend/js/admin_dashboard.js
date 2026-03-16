document.addEventListener('DOMContentLoaded', () => {
    // #region agent log
    fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9cc7bf'},body:JSON.stringify({sessionId:'9cc7bf',runId:'run1',hypothesisId:'H5',location:'js/admin_dashboard.js:2',message:'admin dashboard script loaded',data:{href:window.location.href},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const API_BASE = 'https://trackit-system.onrender.com/api';

    const topBarTitle = document.querySelector('.top-bar-title');
    const sidebarLinks = document.querySelectorAll('.sidebar-nav li');
    const usersSection = document.querySelector('.users-section');
    const officesSection = document.querySelector('.offices-section');
    const resetRequestsSection = document.querySelector('.reset-requests-section');
    const settingsSection = document.querySelector('.settings-section');

    const logoutLink = document.getElementById('logoutLink');
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogout = document.getElementById('cancelLogout');
    const confirmLogout = document.getElementById('confirmLogout');

    const settingsAdminUsername = document.getElementById('settingsAdminUsername');
    const settingsAdminRole = document.getElementById('settingsAdminRole');
    const settingsApiBase = document.getElementById('settingsApiBase');
    const settingsBackendStatus = document.getElementById('settingsBackendStatus');
    const adminSelfPasswordForm = document.getElementById('adminSelfPasswordForm');
    const adminCurrentPassword = document.getElementById('adminCurrentPassword');
    const adminNewPassword = document.getElementById('adminNewPassword');
    const adminSelfPasswordMessage = document.getElementById('adminSelfPasswordMessage');
    const resetRequestsStatusFilter = document.getElementById('resetRequestsStatusFilter');
    const refreshResetRequestsBtn = document.getElementById('refreshResetRequestsBtn');
    const addUserModal = document.getElementById('addUserModal');
    const addUserForm = document.getElementById('addUserForm');
    const addUserUsername = document.getElementById('addUserUsername');
    const addUserPassword = document.getElementById('addUserPassword');
    const addUserRole = document.getElementById('addUserRole');
    const addUserOfficeSelect = document.getElementById('addUserOfficeSelect');
    const closeAddUserModalBtn = document.getElementById('closeAddUserModalBtn');
    const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');

    let users = [];
    let offices = [];
    let resetRequests = [];
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    function getLoggedInUser() {
        try {
            return JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        } catch (e) {
            return null;
        }
    }

    function getToken() {
        const user = getLoggedInUser();
        return user && user.token ? user.token : null;
    }

    function handleUnauthorized() {
        localStorage.removeItem('loggedInUser');
        window.location.href = 'index.html';
    }

    function showError(message) {
        let banner = document.getElementById('adminErrorBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'adminErrorBanner';
            banner.style.background = '#fee2e2';
            banner.style.color = '#991b1b';
            banner.style.padding = '8px 12px';
            banner.style.margin = '12px 36px';
            banner.style.borderRadius = '6px';
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.insertBefore(banner, mainContent.firstChild.nextSibling);
            }
        }
        banner.style.display = 'block';
        banner.textContent = message;
    }

    function clearError() {
        const banner = document.getElementById('adminErrorBanner');
        if (banner) {
            banner.style.display = 'none';
            banner.textContent = '';
        }
    }

    function toDisplayRole(roleValue) {
        const text = String(roleValue || '').trim();
        if (!text) return 'Administrator';
        return text
            .toLowerCase()
            .split(/[\s_-]+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function setSectionVisibility(section) {
        if (usersSection) usersSection.style.display = section === 'users' ? 'block' : 'none';
        if (officesSection) officesSection.style.display = section === 'offices' ? 'block' : 'none';
        if (resetRequestsSection) resetRequestsSection.style.display = section === 'reset-requests' ? 'block' : 'none';
        if (settingsSection) settingsSection.style.display = section === 'settings' ? 'block' : 'none';
    }

    function initSidebarNav() {
        const navItems = Array.from(sidebarLinks).filter(link => !link.querySelector('#logoutLink'));
        const sectionTitles = ['Manage Users', 'Offices', 'Password Reset Requests', 'Settings'];

        navItems.forEach((link, idx) => {
            link.addEventListener('click', () => {
                navItems.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                if (topBarTitle) topBarTitle.textContent = sectionTitles[idx] || 'Manage Users';
                if (idx === 0) setSectionVisibility('users');
                if (idx === 1) setSectionVisibility('offices');
                if (idx === 2) {
                    setSectionVisibility('reset-requests');
                    fetchResetRequests();
                }
                if (idx === 3) setSectionVisibility('settings');
            });
        });

        navItems.forEach(l => l.classList.remove('active'));
        if (navItems[0]) navItems[0].classList.add('active');
        setSectionVisibility('users');
    }

    function formatTimestamp(value) {
        if (!value) return '-';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '-';
        return dt.toLocaleString();
    }

    function initLogout() {
        if (!logoutLink || !logoutModal || !cancelLogout || !confirmLogout) return;
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logoutModal.style.display = 'flex';
        });
        cancelLogout.addEventListener('click', () => {
            logoutModal.style.display = 'none';
        });
        confirmLogout.addEventListener('click', () => {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        });
        logoutModal.addEventListener('click', (e) => {
            if (e.target === logoutModal) {
                logoutModal.style.display = 'none';
            }
        });
    }

    function initSettingsOverview() {
        const currentUser = getLoggedInUser();
        const username = currentUser && currentUser.username ? String(currentUser.username).trim() : '';
        const role = currentUser && currentUser.role ? currentUser.role : '';

        if (settingsAdminUsername) settingsAdminUsername.textContent = username || 'Admin';
        if (settingsAdminRole) settingsAdminRole.textContent = toDisplayRole(role);
        if (settingsApiBase) settingsApiBase.textContent = API_BASE || 'Not available';
        if (settingsBackendStatus) settingsBackendStatus.textContent = 'Status: Connected';
    }

    function setPasswordMessage(message, isError = false) {
        if (!adminSelfPasswordMessage) return;
        adminSelfPasswordMessage.textContent = message || '';
        adminSelfPasswordMessage.classList.toggle('error', !!isError);
    }

    async function secureFetch(url, options = {}) {
        const token = getToken();
        if (!token) {
            handleUnauthorized();
            return null;
        }
        const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return null;
        }
        return response;
    }

    function populateAddUserOfficeOptions() {
        if (!addUserOfficeSelect) return;
        const activeOffices = Array.isArray(offices) ? offices.filter((office) => office && office.is_active !== false) : [];
        addUserOfficeSelect.innerHTML = '';
        if (!activeOffices.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No active offices available';
            addUserOfficeSelect.appendChild(option);
            addUserOfficeSelect.disabled = true;
            return;
        }
        addUserOfficeSelect.disabled = false;
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select an office';
        placeholder.disabled = true;
        placeholder.selected = true;
        addUserOfficeSelect.appendChild(placeholder);

        activeOffices.forEach((office) => {
            const officeId = office._id || office.id || '';
            if (!UUID_REGEX.test(String(officeId))) return;
            const option = document.createElement('option');
            option.value = String(officeId);
            option.textContent = `${office.office_name || 'Office'} (${office.office_code || '-'})`;
            addUserOfficeSelect.appendChild(option);
        });
    }

    function openAddUserModal() {
        if (!addUserModal || !addUserForm) return;
        populateAddUserOfficeOptions();
        addUserForm.reset();
        if (addUserRole) addUserRole.value = 'USER';
        addUserModal.style.display = 'flex';
        if (addUserUsername) addUserUsername.focus();
    }

    function closeAddUserModal() {
        if (!addUserModal || !addUserForm) return;
        addUserModal.style.display = 'none';
        addUserForm.reset();
    }

    function initAddUserModal() {
        if (!addUserModal || !addUserForm) return;
        if (!addUserForm.dataset.bound) {
            addUserForm.dataset.bound = 'true';
            addUserForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const username = String(addUserUsername?.value || '').trim();
                const password = String(addUserPassword?.value || '');
                const role = String(addUserRole?.value || 'USER').trim().toUpperCase();
                const officeId = String(addUserOfficeSelect?.value || '').trim();

                // #region agent log
                fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'605efb'},body:JSON.stringify({sessionId:'605efb',runId:'pre-fix',hypothesisId:'H1',location:'js/admin_dashboard.js:248',message:'admin add user values captured (modal flow)',data:{usernameProvided:Boolean(username),roleProvided:Boolean(role),officeIdRaw:officeId,looksLikeUuid:UUID_REGEX.test(officeId),officesLoadedCount:Array.isArray(offices)?offices.length:0},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                // #region agent log
                fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'605efb'},body:JSON.stringify({sessionId:'605efb',runId:'pre-fix',hypothesisId:'H2',location:'js/admin_dashboard.js:251',message:'admin user create request payload preview (modal flow)',data:{endpoint:`${API_BASE}/users`,username,office_id:officeId,role},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                // #region agent log
                fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'605efb'},body:JSON.stringify({sessionId:'605efb',runId:'post-fix',hypothesisId:'H6',location:'js/admin_dashboard.js:241',message:'add user modal submit payload',data:{usernameProvided:Boolean(username),role,office_id:officeId,looksLikeUuid:UUID_REGEX.test(officeId),availableOfficeCount:Array.isArray(offices)?offices.length:0},timestamp:Date.now()})}).catch(()=>{});
                // #endregion

                if (!username || !password || !role || !officeId) {
                    showError('Username, password, role, and office are required.');
                    return;
                }
                if (password.length < 8) {
                    showError('Password must be at least 8 characters.');
                    return;
                }
                if (!UUID_REGEX.test(officeId)) {
                    showError('Please select a valid office from the dropdown.');
                    return;
                }

                try {
                    const response = await secureFetch(`${API_BASE}/users`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username,
                            password,
                            office_id: officeId,
                            role,
                            is_active: true
                        })
                    });
                    if (!response) return;
                    const created = await response.json();
                    if (!response.ok) throw new Error(created.message || created.error || 'Failed to create user.');
                    closeAddUserModal();
                    clearError();
                    await fetchBaseData();
                } catch (err) {
                    showError(err.message || 'Failed to create user.');
                }
            });
        }

        if (closeAddUserModalBtn && !closeAddUserModalBtn.dataset.bound) {
            closeAddUserModalBtn.dataset.bound = 'true';
            closeAddUserModalBtn.addEventListener('click', closeAddUserModal);
        }
        if (cancelAddUserBtn && !cancelAddUserBtn.dataset.bound) {
            cancelAddUserBtn.dataset.bound = 'true';
            cancelAddUserBtn.addEventListener('click', closeAddUserModal);
        }
        if (!addUserModal.dataset.bound) {
            addUserModal.dataset.bound = 'true';
            addUserModal.addEventListener('click', (event) => {
                if (event.target === addUserModal) {
                    closeAddUserModal();
                }
            });
        }
    }

    function renderUsersTable() {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(users) || users.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" style="text-align:center;color:#888;">No users found.</td>';
            tbody.appendChild(tr);
            return;
        }

        users.forEach((user) => {
            const officeObj = user.office_id && typeof user.office_id === 'object' ? user.office_id : null;
            const officeName = officeObj ? officeObj.office_name : (user.office_id || '');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username || '-'}</td>
                <td>${officeName || '-'}</td>
                <td>${user.role || '-'}</td>
                <td>${user.is_active ? 'Yes' : 'No'}</td>
                <td>
                    <button class="admin-btn-delete-user" data-id="${user._id || user.id}" data-active="${user.is_active ? 'true' : 'false'}">
                        ${user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="admin-btn-password-user" data-id="${user._id || user.id}" data-username="${user.username || ''}">
                        Change Password
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.admin-btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const isActive = btn.getAttribute('data-active') === 'true';
                if (!id) return;

                if (isActive && prompt('Type DEACTIVATE to confirm deactivating this user.') !== 'DEACTIVATE') return;
                if (!isActive && !confirm('Activate this user?')) return;

                try {
                    const response = await secureFetch(`${API_BASE}/admin/users/${id}/active`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: !isActive })
                    });
                    if (!response) return;
                    const updated = await response.json();
                    if (!response.ok) throw new Error(updated.message || 'Failed to update user.');
                    users = users.map(u => ((u._id || u.id) === id ? updated : u));
                    clearError();
                    renderUsersTable();
                } catch (err) {
                    showError(err.message || 'Failed to update user.');
                }
            });
        });

        tbody.querySelectorAll('.admin-btn-password-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const username = btn.getAttribute('data-username') || 'this user';
                const newPassword = prompt(`Enter a new password for ${username}:`);
                if (!newPassword) return;
                const confirmPassword = prompt('Re-enter new password:');
                if (newPassword !== confirmPassword) {
                    showError('Passwords do not match.');
                    return;
                }
                if (newPassword.length < 8) {
                    showError('Password must be at least 8 characters.');
                    return;
                }
                try {
                    const response = await secureFetch(`${API_BASE}/admin/users/${id}/password`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ new_password: newPassword })
                    });
                    if (!response) return;
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.message || 'Failed to update password.');
                    clearError();
                    alert('Password updated successfully.');
                } catch (err) {
                    showError(err.message || 'Failed to update password.');
                }
            });
        });

        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn && !addUserBtn.dataset.bound) {
            addUserBtn.dataset.bound = 'true';
            addUserBtn.addEventListener('click', () => {
                openAddUserModal();
            });
        }
    }

    function renderOfficesTable() {
        const tbody = document.querySelector('#officesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(offices) || offices.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" style="text-align:center;color:#888;">No offices found.</td>';
            tbody.appendChild(tr);
            return;
        }

        offices.forEach((office) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${office.office_name || '-'}</td>
                <td>${office.office_code || '-'}</td>
                <td>${office.description || '-'}</td>
                <td>${office.is_active ? 'Yes' : 'No'}</td>
                <td>
                    <button class="admin-btn-delete-office" data-id="${office._id || office.id}" data-active="${office.is_active ? 'true' : 'false'}">
                        ${office.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.admin-btn-delete-office').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const isActive = btn.getAttribute('data-active') === 'true';
                if (!id) return;

                if (isActive && prompt('Type DEACTIVATE to confirm deactivating this office.') !== 'DEACTIVATE') return;
                if (!isActive && !confirm('Activate this office?')) return;

                try {
                    const response = await secureFetch(`${API_BASE}/admin/offices/${id}/active`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: !isActive })
                    });
                    if (!response) return;
                    const updated = await response.json();
                    if (!response.ok) throw new Error(updated.message || 'Failed to update office.');
                    offices = offices.map(o => ((o._id || o.id) === id ? updated : o));
                    clearError();
                    renderOfficesTable();
                } catch (err) {
                    showError(err.message || 'Failed to update office.');
                }
            });
        });

        const addOfficeBtn = document.getElementById('addOfficeBtn');
        if (addOfficeBtn && !addOfficeBtn.dataset.bound) {
            addOfficeBtn.dataset.bound = 'true';
            addOfficeBtn.addEventListener('click', async () => {
                const office_name = prompt('Office Name?');
                const office_code = prompt('Office Code?');
                const description = prompt('Description?');
                if (!office_name || !office_code) return;
                try {
                    const response = await secureFetch(`${API_BASE}/offices`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            office_name,
                            office_code,
                            description,
                            is_active: true
                        })
                    });
                    if (!response) return;
                    const created = await response.json();
                    if (!response.ok) throw new Error(created.error || 'Failed to create office.');
                    offices.push(created);
                    clearError();
                    renderOfficesTable();
                } catch (err) {
                    showError(err.message || 'Failed to create office.');
                }
            });
        }
    }

    function renderResetRequestsTable() {
        const tbody = document.querySelector('#resetRequestsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(resetRequests) || resetRequests.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="7" style="text-align:center;color:#888;">No password reset requests found.</td>';
            tbody.appendChild(tr);
            return;
        }

        resetRequests.forEach((request) => {
            const account = request.office_account && typeof request.office_account === 'object' ? request.office_account : null;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${request.requested_identifier || '-'}</td>
                <td>${account && account.username ? account.username : '-'}</td>
                <td>${request.message || '-'}</td>
                <td>${request.status || '-'}</td>
                <td>${formatTimestamp(request.created_at)}</td>
                <td>${formatTimestamp(request.resolved_at)}</td>
                <td>
                    ${request.status === 'PENDING' ? `<button class="admin-btn-resolve-reset" data-id="${request._id || request.id}">Resolve</button>` : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.admin-btn-resolve-reset').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!id) return;

                const tempPassword = prompt('Enter temporary password (at least 8 characters):');
                if (!tempPassword) return;
                if (tempPassword.length < 8) {
                    showError('Temporary password must be at least 8 characters.');
                    return;
                }
                const confirmPassword = prompt('Re-enter temporary password:');
                if (tempPassword !== confirmPassword) {
                    showError('Temporary passwords do not match.');
                    return;
                }

                try {
                    const response = await secureFetch(`${API_BASE}/admin/password-reset-requests/${id}/resolve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ temp_password: tempPassword })
                    });
                    if (!response) return;
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.message || 'Failed to resolve password reset request.');
                    clearError();
                    await fetchResetRequests();
                    alert('Password reset request resolved.');
                } catch (err) {
                    showError(err.message || 'Failed to resolve password reset request.');
                }
            });
        });
    }

    async function fetchResetRequests() {
        const selected = String(resetRequestsStatusFilter?.value || 'pending').toLowerCase();
        const query = selected && selected !== 'all' ? `?status=${encodeURIComponent(selected)}` : '';
        try {
            const response = await secureFetch(`${API_BASE}/admin/password-reset-requests${query}`);
            if (!response) return;
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Failed to load password reset requests.');
            resetRequests = Array.isArray(payload) ? payload : [];
            clearError();
            renderResetRequestsTable();
        } catch (err) {
            showError(err.message || 'Failed to load password reset requests.');
        }
    }

    async function fetchBaseData() {
        try {
            const [usersRes, officesRes] = await Promise.all([
                secureFetch(`${API_BASE}/admin/users`),
                secureFetch(`${API_BASE}/admin/offices`)
            ]);
            if (!usersRes || !officesRes) return;
            // #region agent log
            fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9cc7bf'},body:JSON.stringify({sessionId:'9cc7bf',runId:'run1',hypothesisId:'H5',location:'js/admin_dashboard.js:352',message:'admin base data fetch responses',data:{usersStatus:usersRes.status,officesStatus:officesRes.status},timestamp:Date.now()})}).catch(()=>{});
            // #endregion

            const usersPayload = await usersRes.json();
            const officesPayload = await officesRes.json();
            if (!usersRes.ok) throw new Error(usersPayload.message || 'Failed to load users.');
            if (!officesRes.ok) throw new Error(officesPayload.message || 'Failed to load offices.');

            users = Array.isArray(usersPayload) ? usersPayload : [];
            offices = Array.isArray(officesPayload) ? officesPayload : [];
            populateAddUserOfficeOptions();
            clearError();
            renderUsersTable();
            renderOfficesTable();
        } catch (err) {
            showError(err.message || 'Unable to load users and offices.');
        }
    }

    function initResetRequestsControls() {
        if (resetRequestsStatusFilter) {
            resetRequestsStatusFilter.addEventListener('change', () => {
                fetchResetRequests();
            });
        }
        if (refreshResetRequestsBtn) {
            refreshResetRequestsBtn.addEventListener('click', () => {
                fetchResetRequests();
            });
        }
    }

    function initSelfPasswordForm() {
        if (!adminSelfPasswordForm) return;
        adminSelfPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            setPasswordMessage('');
            const currentPassword = adminCurrentPassword ? adminCurrentPassword.value.trim() : '';
            const newPassword = adminNewPassword ? adminNewPassword.value.trim() : '';

            if (!currentPassword || !newPassword) {
                setPasswordMessage('Current and new password are required.', true);
                return;
            }
            if (newPassword.length < 8) {
                setPasswordMessage('New password must be at least 8 characters.', true);
                return;
            }

            try {
                const response = await secureFetch(`${API_BASE}/admin/me/password`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                if (!response) return;
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Failed to update password.');
                adminSelfPasswordForm.reset();
                setPasswordMessage('Password updated successfully.');
            } catch (err) {
                setPasswordMessage(err.message || 'Failed to update password.', true);
            }
        });
    }

    const user = getLoggedInUser();
    if (!user) {
        handleUnauthorized();
        return;
    }
    const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
    const isAdmin = role === 'admin' || role === 'superadmin' || user.username === 'admin';
    if (!isAdmin) {
        handleUnauthorized();
        return;
    }

    initSidebarNav();
    initLogout();
    initSettingsOverview();
    initSelfPasswordForm();
    initResetRequestsControls();
    initAddUserModal();
    fetchBaseData();
});
