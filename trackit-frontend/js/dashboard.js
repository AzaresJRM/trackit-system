console.log('DASHBOARD JS LOADED');

window.loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');

document.addEventListener('DOMContentLoaded', async () => {
    const logoutLink = document.getElementById('logoutLink');
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogout = document.getElementById('cancelLogout');
    const confirmLogout = document.getElementById('confirmLogout');

    if (logoutLink && logoutModal && cancelLogout && confirmLogout) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logoutModal.style.display = 'block';
        });

        cancelLogout.addEventListener('click', () => {
            logoutModal.style.display = 'none';
        });

        confirmLogout.addEventListener('click', () => {
            localStorage.removeItem('loggedInUser');
            window.location.href = 'index.html'; // Redirect to login page
        });

        // Close the modal if the user clicks outside of it
        window.addEventListener('click', (e) => {
            if (e.target === logoutModal) {
                logoutModal.style.display = 'none';
            }
        });
    }

    function initForcedPasswordChangeGate() {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        if (!user || !user.must_change_password) return false;

        const forceModal = document.getElementById('forcePasswordChangeModal');
        const forceForm = document.getElementById('forcePasswordChangeForm');
        const currentPasswordInput = document.getElementById('forceCurrentPassword');
        const newPasswordInput = document.getElementById('forceNewPassword');
        const confirmPasswordInput = document.getElementById('forceConfirmPassword');
        const forceMessage = document.getElementById('forcePasswordChangeMessage');
        if (!forceModal || !forceForm || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !forceMessage) {
            return false;
        }

        const apiBase = getApiBase();

        function setForcePasswordMessage(message, isError = false) {
            forceMessage.textContent = message || '';
            forceMessage.classList.toggle('error', !!isError);
        }

        forceModal.style.display = 'flex';
        setForcePasswordMessage('');

        forceForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const currentPassword = currentPasswordInput.value.trim();
            const newPassword = newPasswordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            if (!currentPassword || !newPassword || !confirmPassword) {
                setForcePasswordMessage('All fields are required.', true);
                return;
            }
            if (newPassword.length < 8) {
                setForcePasswordMessage('New password must be at least 8 characters.', true);
                return;
            }
            if (newPassword !== confirmPassword) {
                setForcePasswordMessage('New password and confirmation do not match.', true);
                return;
            }

            try {
                const response = await fetch(`${apiBase}/auth/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${String(user.token || '')}`
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    setForcePasswordMessage(payload.message || 'Failed to update password.', true);
                    return;
                }

                user.must_change_password = false;
                localStorage.setItem('loggedInUser', JSON.stringify(user));
                setForcePasswordMessage('Password updated successfully. Loading dashboard...');
                setTimeout(() => {
                    window.location.reload();
                }, 700);
            } catch (error) {
                setForcePasswordMessage('Failed to update password.', true);
            }
        });

        return true;
    }

    if (initForcedPasswordChangeGate()) {
        return;
    }

    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            location.reload(); // Reload the entire page
        });
    }

    // Modal logic for Update Documents
    const updateDocumentModal = document.getElementById('updateDocumentModal');
    const cancelUpdateDoc = document.getElementById('cancelUpdateDoc');
    const updateDocumentForm = document.getElementById('updateDocumentForm');

    if (updateDocumentModal && cancelUpdateDoc && updateDocumentForm) {
        cancelUpdateDoc.addEventListener('click', () => {
            updateDocumentModal.style.display = 'none';
        });

        updateDocumentModal.addEventListener('click', (e) => {
            if (e.target === updateDocumentModal) {
                updateDocumentModal.style.display = 'none';
            }
        });

        updateDocumentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Add your logic to handle document update here
            alert('Document updated! (Demo)');
            updateDocumentModal.style.display = 'none';
        });
    }

    // Event listeners for action buttons to open update modal
    const actionButtons = document.querySelectorAll('.action-btn');

    if (actionButtons.length > 0 && updateDocumentModal && cancelUpdateDoc && updateDocumentForm) {
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();

                const card = button.closest('.document-card');
                if (card) {
                    const requisitioner = card.querySelector('.card-row:nth-child(1) .value').textContent.trim();
                    const title = card.querySelector('.card-row:nth-child(2) .value').textContent.trim();
                    const content = card.querySelector('.card-row:nth-child(3) .value').textContent.trim();
                    const type = card.querySelector('.card-row:nth-child(4) .value').textContent.trim();

                    document.getElementById('updateRequisitioner').value = requisitioner;
                    document.getElementById('updateTitle').value = title;
                    document.getElementById('updateContent').value = content;
                    document.getElementById('updateType').value = type;

                    updateDocumentModal.style.display = 'flex';
                } else {
                    alert('No documents found to update.');
                }
            });
        });
    }

    // Section management and navigation
    const contentHeaderTitle = document.querySelector('.main-content .content-header h2');
    const incomingSection = document.getElementById('incoming-section');
    const receivedSection = document.getElementById('received-section');
    const outgoingSection = document.getElementById('outgoing-section');
    const completeSection = document.getElementById('complete-section');
    const logsSection = document.getElementById('logs-section');
    const trackSection = document.getElementById('track-section');

    // Map sidebar navigation links to their corresponding content sections
    const sectionsMap = [
        { link: document.querySelector('.nav-link[data-section="incoming"]'), section: incomingSection },  // Incoming
        { link: document.querySelector('.nav-link[data-section="received"]'), section: receivedSection },  // Received
        { link: document.querySelector('.nav-link[data-section="outgoing"]'), section: outgoingSection },  // Outgoing
        { link: document.querySelector('.nav-link[data-section="complete"]'), section: completeSection },  // Complete
        { link: document.querySelector('.nav-link[data-section="logs"]'), section: trackSection },      // Logs (audit trail)
        { link: document.querySelector('.nav-link[data-section="track"]'), section: logsSection }       // Reports (printable)
    ];
    const notificationsBellBtn = document.getElementById('notificationsBellBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const notificationsList = document.getElementById('notificationsList');
    const notificationsUnreadBadge = document.getElementById('notificationsUnreadBadge');
    const markNotificationsSeenBtn = document.getElementById('markNotificationsSeenBtn');
    let notificationsCache = [];
    let notificationsPollHandle = null;
    const ATTACHMENT_LIMITS = {
        MIN_FILES: 1,
        MAX_FILES: 5,
        MAX_SIZE_BYTES: 10 * 1024 * 1024
    };
    const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xlsx', 'png', 'jpg', 'jpeg'];
    const ALLOWED_ATTACHMENT_MIME_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
        'image/jpeg',
        'image/jpg'
    ];

    function showSection(sectionToShow, sidebarLinkToActivate, headerTitle) {
        const switchingToTrack = sectionToShow && sectionToShow.id === 'track-section';
        if (!switchingToTrack && typeof stopTrackRealtimePolling === 'function') {
            stopTrackRealtimePolling();
        }

        // Hide all managed main content sections
        sectionsMap.forEach(item => {
            if (item.section) {
                item.section.style.display = 'none';
            }
        });

        // Show the requested section
        if (sectionToShow) {
            sectionToShow.style.display = 'block';
        }

        // Update sidebar active class
        const currentlyActive = document.querySelector('.nav-link.active');
        if (currentlyActive) {
            currentlyActive.classList.remove('active');
        }
        if (sidebarLinkToActivate) {
            sidebarLinkToActivate.classList.add('active');
        }

        // Update main content header title (if present)
        if (contentHeaderTitle && headerTitle) {
            contentHeaderTitle.textContent = headerTitle;
        }

        if (switchingToTrack && typeof startTrackRealtimePolling === 'function') {
            startTrackRealtimePolling();
        }
    }

    function setNotificationsBadge(unreadCount) {
        if (!notificationsUnreadBadge) return;
        const safeCount = Number.isFinite(Number(unreadCount)) ? Number(unreadCount) : 0;
        notificationsUnreadBadge.textContent = String(safeCount);
        notificationsUnreadBadge.style.display = safeCount > 0 ? 'inline-flex' : 'none';
    }

    function notificationTypeLabel(type) {
        if (type === 'returned') return 'Returned';
        if (type === 'received') return 'Received';
        if (type === 'forwarded') return 'Forwarded';
        if (type === 'completed') return 'Completed';
        return 'Update';
    }

    function openNotificationContext(item) {
        if (!item) return;
        if (item.type === 'returned') {
            showSection(incomingSection, sectionsMap[0].link, 'Incoming Documents');
            fetchAndRenderIncomingDocs().then(() => {
                const row = document.querySelector(`#incoming-table-body tr[data-doc-id="${String(item.document_id || '')}"]`);
                if (!row) return;
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('notification-target-row');
                setTimeout(() => row.classList.remove('notification-target-row'), 1800);
            }).catch(() => {});
            return;
        }

        showSection(trackSection, sectionsMap[4].link, 'Logs');
        const docCodeInput = document.getElementById('track-doc-code');
        const trackSearchBtn = document.getElementById('track-search-btn');
        if (docCodeInput && item.document_code) {
            docCodeInput.value = item.document_code;
            if (trackSearchBtn) trackSearchBtn.click();
        }
    }

    function renderNotifications(items) {
        if (!notificationsList) return;
        const safeItems = Array.isArray(items) ? items : [];
        if (!safeItems.length) {
            notificationsList.innerHTML = '<div class="notifications-empty">No notifications yet.</div>';
            return;
        }
        notificationsList.innerHTML = safeItems.map((item) => {
            const docCode = item.document_code || 'Document';
            const title = item.title || item.status || 'Update';
            const dt = item.date ? new Date(item.date).toLocaleString() : '-';
            return `
                <button type="button" class="notification-item ${item.is_read ? '' : 'is-unread'}" data-notification-id="${escapeHtml(String(item.id || ''))}">
                    <div class="notification-title">${escapeHtml(notificationTypeLabel(item.type))}: ${escapeHtml(docCode)}</div>
                    <div>${escapeHtml(title)}</div>
                    <div class="notification-meta">${escapeHtml(dt)}</div>
                </button>
            `;
        }).join('');

        notificationsList.querySelectorAll('.notification-item').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const notifId = btn.getAttribute('data-notification-id');
                const selected = notificationsCache.find((it) => String(it.id || '') === String(notifId || ''));
                if (notificationsDropdown) notificationsDropdown.style.display = 'none';
                openNotificationContext(selected);
            });
        });
    }

    async function markNotificationsSeen() {
        const latest = notificationsCache[0];
        await fetch(`${getApiBase()}/notifications/mark-seen`, {
            method: 'PATCH',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                last_seen_at: latest?.date || new Date().toISOString(),
                last_seen_log_id: latest?.id || null
            })
        });
    }

    async function fetchNotifications() {
        try {
            const res = await fetch(`${getApiBase()}/notifications?limit=20`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch notifications');
            const payload = await res.json();
            notificationsCache = Array.isArray(payload.items) ? payload.items : [];
            renderNotifications(notificationsCache);
            setNotificationsBadge(payload.unread_count || 0);
        } catch (err) {
            console.error('Notification fetch failed:', err);
        }
    }

    function startNotificationsPolling() {
        if (notificationsPollHandle) return;
        notificationsPollHandle = setInterval(() => {
            if (document.hidden) return;
            fetchNotifications();
        }, 7000);
    }

    // Initial setup: ensure Incoming section is visible and active on load
    showSection(incomingSection, sectionsMap[0].link, 'Incoming Documents'); // Incoming is the first one

    if (notificationsBellBtn && notificationsDropdown) {
        notificationsBellBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const isOpen = notificationsDropdown.style.display === 'block';
            notificationsDropdown.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                await fetchNotifications();
            }
        });
    }
    if (markNotificationsSeenBtn) {
        markNotificationsSeenBtn.addEventListener('click', async () => {
            try {
                await markNotificationsSeen();
                await fetchNotifications();
            } catch (err) {
                console.error('Failed to mark notifications seen:', err);
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (!notificationsDropdown || !notificationsBellBtn) return;
        const clickInside = notificationsDropdown.contains(e.target) || notificationsBellBtn.contains(e.target);
        if (!clickInside) notificationsDropdown.style.display = 'none';
    });
    fetchNotifications();
    startNotificationsPolling();

    // Add event listeners for all sidebar links
    sectionsMap.forEach((item, index) => {
        if (item.link) {
            item.link.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default link behavior
                let headerTitle = '';
                switch (index) {
                    case 0: // Incoming
                        headerTitle = 'Incoming Documents';
                        fetchAndRenderIncomingDocs();
                        break;
                    case 1: // Received
                        headerTitle = 'Received Documents';
                        fetchAndRenderReceivedDocs();
                        break;
                    case 2: // Outgoing
                        headerTitle = 'Outgoing Documents';
                        fetchAndRenderOutgoingDocs();
                        break;
                    case 3: // Complete
                        headerTitle = 'Complete Documents';
                        fetchAndRenderCompleteDocs();
                        break;
                    case 4: // Logs (audit trail)
                        headerTitle = 'Logs';
                        break;
                    case 5: // Reports
                        headerTitle = 'Reports';
                        fetchAndRenderLogCards();
                        break;
                }
                showSection(item.section, item.link, headerTitle);
            });
        }
    });

    // Handle incoming action dropdown
    const incomingActionButtons = document.querySelectorAll('.incoming-action-btn');
    incomingActionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = button.nextElementSibling;
            if (dropdown) {
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            }
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.incoming-action-btn')) {
            const dropdowns = document.querySelectorAll('.action-dropdown');
            dropdowns.forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
    });

    // Handle dropdown actions
    const acceptActions = document.querySelectorAll('.accept-action');
    acceptActions.forEach(action => {
        action.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Document accepted! (Demo)');
            const dropdown = action.closest('.action-dropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    });

    const detailsActions = document.querySelectorAll('.details-action');
    detailsActions.forEach(action => {
        action.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Showing document details... (Demo)');
            const dropdown = action.closest('.action-dropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    });

    function applySectionFilters(section) {
        if (!section) return;
        if (section.id === 'outgoing-section') {
            if (typeof window.renderOutgoingCards === 'function') window.renderOutgoingCards();
            return;
        }

        const searchInput = section.querySelector('input[id$="-search-input"]');
        const searchTerm = String(searchInput?.value || '').toLowerCase();
        const showEntriesSelect = section.querySelector('select[id$="-show-entries"]');
        const entriesToShow = Number.parseInt(showEntriesSelect?.value, 10) || 10;

        const rowSelector = '.section-table tbody tr[data-row-type]';
        const rows = Array.from(section.querySelectorAll(rowSelector));
        if (!rows.length) {
            const cardsContainer = section.querySelector('.cards-container');
            if (cardsContainer) {
                const cards = cardsContainer.querySelectorAll('.document-card, .log-card');
                let shownCount = 0;
                cards.forEach((card) => {
                    const text = String(card.textContent || '').toLowerCase();
                    const matches = !searchTerm || text.includes(searchTerm);
                    if (matches && shownCount < entriesToShow) {
                        card.style.display = 'block';
                        shownCount += 1;
                    } else {
                        card.style.display = 'none';
                    }
                });
            }
            return;
        }
        let shownCount = 0;
        rows.forEach((row) => {
            const text = String(row.textContent || '').toLowerCase();
            const matches = !searchTerm || text.includes(searchTerm);
            if (matches && shownCount < entriesToShow) {
                row.style.display = 'table-row';
                shownCount += 1;
            } else {
                row.style.display = 'none';
            }
        });

        const paginationInfo = section.querySelector('.pagination-info');
        if (paginationInfo) {
            const totalMatches = rows.filter(row => {
                const text = String(row.textContent || '').toLowerCase();
                return !searchTerm || text.includes(searchTerm);
            }).length;
            const start = totalMatches > 0 ? 1 : 0;
            paginationInfo.textContent = `Showing ${start} to ${shownCount} of ${totalMatches} entries`;
        }
    }

    // Search functionality for all sections
    const searchInputs = document.querySelectorAll('#search-input, #incoming-search-input, #received-search-input, #outgoing-search-input, #hold-search-input, #complete-search-input');
    searchInputs.forEach(input => {
        input.addEventListener('input', function () {
            const section = this.closest('.content-section');
            applySectionFilters(section);
        });
    });

    // Show entries functionality
    const showEntriesSelects = document.querySelectorAll('#show-entries, #incoming-show-entries, #received-show-entries, #outgoing-show-entries, #hold-show-entries, #complete-show-entries');
    showEntriesSelects.forEach(select => {
        select.addEventListener('change', function () {
            const section = this.closest('.content-section');
            applySectionFilters(section);
        });
    });

    // Track functionality
    const trackSearchBtn = document.getElementById('track-search-btn');
    const trackClearBtn = document.getElementById('track-clear-btn');
    const trackDocCode = document.getElementById('track-doc-code');
    const trackKeyword = document.getElementById('track-keyword');
    const trackStatus = document.getElementById('track-status');
    const trackDatePreset = document.getElementById('track-date-preset');
    const trackResults = document.getElementById('track-results');
    const trackResultsTableContainer = document.getElementById('track-results-table-container');
    const trackMockToggle = document.getElementById('track-mock-toggle');
    const trackFeedback = document.getElementById('track-feedback');
    const trackRecentList = document.getElementById('track-recent-list');
    const trackRecentCreatedTab = document.getElementById('track-recent-created-tab');
    const trackRecentHandledTab = document.getElementById('track-recent-handled-tab');
    var lastTrackedDocs = [];
    var lastRecentDocs = [];
    var lastTrackQuery = null;
    var trackRealtimeInterval = null;
    var lastTrackSnapshot = '';
    var activeRecentMode = 'created';

    // Mock data for testing
    const mockDocs = [
        {
            document_code: 'VPAA-2025-06-0001',
            title: 'REQUEST OF SPECIAL CLASS FORM',
            type_id: { type_name: 'SPECIAL CLASS FORM' },
            current_office_id: { office_name: 'VPAA' },
            status: 'RECEIVED',
            status_history: [
                { status: 'RECEIVED', office_name: 'VPAA', user_name: 'Admin', date: new Date().toISOString() },
                { status: 'RELEASED', office_name: 'Registrar', user_name: 'Registrar', date: new Date().toISOString() }
            ]
        },
        {
            document_code: 'CSIT-2025-06-0002',
            title: 'REQUEST TO JOIN IN SPECIAL CLASS',
            type_id: { type_name: 'FORM' },
            current_office_id: { office_name: 'CSIT OFFICE' },
            status: 'RELEASED',
            status_history: [
                { status: 'RELEASED', office_name: 'CSIT OFFICE', user_name: 'CSIT Admin', date: new Date().toISOString() }
            ]
        },
        {
            document_code: 'COMM-CSIT-2025-07-0003',
            title: 'Request to Join the Special Class',
            type_id: { type_name: 'COMMUNICATION' },
            current_office_id: { office_name: 'VPAA' },
            status: 'COMPLETED',
            status_history: [
                { status: 'FORWARDED', office_name: 'CSIT Office', user_name: 'CSIT Admin', date: '2025-07-09T09:00:00' },
                { status: 'FORWARDED', office_name: "CLASE Dean's Office", user_name: "Dean's Secretary", date: '2025-07-09T10:00:00' },
                { status: 'COMPLETED', office_name: 'VPAA', user_name: 'VPAA Admin', date: '2025-07-09T11:00:00' }
            ]
        }
    ];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getApiBase() {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:4000/api';
        }
        return 'https://trackit-system.onrender.com/api';
    }

    function getOfficesApiBase() {
        return getApiBase();
    }

    function getAuthHeaders() {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        const headers = {};
        if (user && user.token) headers.Authorization = `Bearer ${user.token}`;
        return headers;
    }

    function getMyOfficeId() {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        return String(user?.office_id?._id || user?.office_id || '');
    }

    function getAttachmentToken() {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        return user?.token ? String(user.token) : '';
    }

    function withAttachmentToken(url) {
        const token = getAttachmentToken();
        if (!token || !url) return url;
        if (!/^https?:\/\//i.test(String(url))) return url;
        const separator = String(url).includes('?') ? '&' : '?';
        return `${url}${separator}access_token=${encodeURIComponent(token)}`;
    }

    function getServerBase() {
        return getApiBase().replace(/\/api$/, '');
    }

    function resolveAttachmentUrl(rawUrl) {
        const url = String(rawUrl || '').trim();
        if (!url) return '';
        const serverBase = getServerBase();
        if (/^https?:\/\//i.test(url)) {
            try {
                const parsed = new URL(url);
                if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                    const rewritten = new URL(serverBase);
                    rewritten.pathname = parsed.pathname;
                    rewritten.search = parsed.search;
                    rewritten.hash = parsed.hash;
                    return rewritten.toString();
                }
                let apiHostname = '';
                try {
                    apiHostname = new URL(getApiBase()).hostname;
                } catch (_) {
                    apiHostname = '';
                }
                if (
                    parsed.protocol === 'http:' &&
                    (parsed.hostname === 'trackit-system.onrender.com' ||
                        (apiHostname &&
                            parsed.hostname === apiHostname &&
                            apiHostname !== 'localhost' &&
                            apiHostname !== '127.0.0.1'))
                ) {
                    parsed.protocol = 'https:';
                    return parsed.toString();
                }
                return url;
            } catch (_) {
                return url;
            }
        }
        if (/^(data:|blob:)/i.test(url)) return url;
        if (url.startsWith('/')) return `${serverBase}${url}`;
        return `${serverBase}/${url.replace(/^\/+/, '')}`;
    }

    function normalizeAttachmentUrls(att) {
        const previewUrl = resolveAttachmentUrl(att.previewUrl || att.url || '');
        const downloadUrl = resolveAttachmentUrl(att.downloadUrl || att.url || '');
        const fallbackUrl = resolveAttachmentUrl(att.url || downloadUrl || previewUrl || '');
        return {
            ...att,
            previewUrl: withAttachmentToken(previewUrl),
            downloadUrl: withAttachmentToken(downloadUrl),
            url: withAttachmentToken(fallbackUrl)
        };
    }

    function formatAttachmentSize(sizeBytes) {
        const size = Number(sizeBytes || 0);
        if (!Number.isFinite(size) || size <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const idx = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
        const value = size / Math.pow(1024, idx);
        return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    function getExtension(filename) {
        const name = String(filename || '').toLowerCase();
        const idx = name.lastIndexOf('.');
        return idx === -1 ? '' : name.slice(idx + 1);
    }

    function validateAttachmentSelection(files, { required = false } = {}) {
        const selectedFiles = Array.isArray(files) ? files : [];
        if (required && selectedFiles.length < ATTACHMENT_LIMITS.MIN_FILES) {
            return `Please attach at least ${ATTACHMENT_LIMITS.MIN_FILES} file before sending.`;
        }
        if (selectedFiles.length > ATTACHMENT_LIMITS.MAX_FILES) {
            return `You can attach up to ${ATTACHMENT_LIMITS.MAX_FILES} files only.`;
        }
        for (const file of selectedFiles) {
            const ext = getExtension(file?.name || '');
            const hasAllowedType = ALLOWED_ATTACHMENT_MIME_TYPES.includes(String(file?.type || '').toLowerCase());
            const hasAllowedExtension = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext);
            if (!hasAllowedType && !hasAllowedExtension) {
                return `Invalid file type: ${file.name}. Allowed types are pdf, doc, docx, xlsx, png, jpg.`;
            }
            if (Number(file?.size || 0) > ATTACHMENT_LIMITS.MAX_SIZE_BYTES) {
                return `File too large: ${file.name}. Maximum size is 10MB.`;
            }
        }
        return '';
    }

    function getPreviewKind(att) {
        const mime = String(att?.mimeType || att?.mime_type || '').toLowerCase();
        const ext = getExtension(att?.name || att?.filename || '');
        if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
        if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
        if (
            mime === 'application/msword' ||
            mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            ext === 'doc' ||
            ext === 'docx'
        ) return 'word';
        return 'unsupported';
    }

    const attachmentMetaCacheByDocId = new Map();
    const attachmentMetaInFlightByDocId = new Map();
    const debouncedAttachmentPrefetchTimers = new Map();

    async function fetchDocumentAttachments(docId) {
        if (!docId) return [];
        if (attachmentMetaCacheByDocId.has(docId)) return attachmentMetaCacheByDocId.get(docId);
        if (attachmentMetaInFlightByDocId.has(docId)) return attachmentMetaInFlightByDocId.get(docId);
        const request = (async () => {
            const res = await fetch(`${getApiBase()}/documents/${docId}/attachments`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch attachments');
            const data = await res.json();
            const list = (Array.isArray(data.attachments) ? data.attachments : []).map(normalizeAttachmentUrls);
            attachmentMetaCacheByDocId.set(docId, list);
            return list;
        })();
        attachmentMetaInFlightByDocId.set(docId, request);
        try {
            return await request;
        } finally {
            attachmentMetaInFlightByDocId.delete(docId);
        }
    }

    function prefetchAttachmentsDebounced(docId, delayMs = 250) {
        if (!docId || attachmentMetaCacheByDocId.has(docId)) return;
        if (debouncedAttachmentPrefetchTimers.has(docId)) {
            clearTimeout(debouncedAttachmentPrefetchTimers.get(docId));
        }
        const timer = setTimeout(() => {
            fetchDocumentAttachments(docId).catch(() => {});
            debouncedAttachmentPrefetchTimers.delete(docId);
        }, delayMs);
        debouncedAttachmentPrefetchTimers.set(docId, timer);
    }

    function createAttachmentPreviewModal() {
        let modal = document.getElementById('attachment-preview-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'attachment-preview-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content attachment-preview-modal-content">
                <div class="attachment-preview-header">
                    <h3 id="attachment-preview-title">Attachment Preview</h3>
                    <button id="attachment-preview-close" type="button" class="btn-cancel attachment-preview-close-btn">Close</button>
                </div>
                <div id="attachment-preview-body" class="attachment-preview-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        const closeBtn = modal.querySelector('#attachment-preview-close');
        if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
        return modal;
    }

    function renderAttachmentPreviewList(docTitle, attachments) {
        if (!attachments.length) {
            return `<div class="attachment-preview-empty">No attachments found for ${escapeHtml(docTitle || 'this document')}.</div>`;
        }
        return `
            <div class="attachment-list-grid">
                ${attachments.map((att, idx) => `
                    <button class="attachment-list-item" data-attachment-index="${idx}" type="button">
                        <div class="attachment-list-name">${escapeHtml(att.name || 'Attachment')}</div>
                        <div class="attachment-list-meta">${escapeHtml(att.mimeType || 'Unknown type')} • ${escapeHtml(formatAttachmentSize(att.size || 0))}</div>
                    </button>
                `).join('')}
            </div>
            <div id="attachment-preview-render-area" class="attachment-preview-render-area"></div>
        `;
    }

    function renderAttachmentPreviewContent(targetEl, att) {
        const kind = getPreviewKind(att);
        const safeName = escapeHtml(att.name || 'Attachment');
        const safeType = escapeHtml(att.mimeType || getExtension(att.name) || 'Unknown');
        const previewUrl = att.previewUrl || att.url || '#';
        const downloadUrl = att.downloadUrl || att.url || '#';
        const attachmentIdRaw = att.id != null && String(att.id) !== '' ? String(att.id) : (att._id != null && String(att._id) !== '' ? String(att._id) : '');
        const apiBase = getApiBase();
        const inlineSrc = attachmentIdRaw
            ? withAttachmentToken(`${apiBase}/attachments/${encodeURIComponent(attachmentIdRaw)}/preview`)
            : previewUrl;
        if (kind === 'image') {
            targetEl.innerHTML = `
                <div class="attachment-preview-actions">
                    <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Open</a>
                    <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Download</a>
                </div>
                <img class="attachment-preview-image" src="${inlineSrc}" alt="${safeName}" loading="lazy">
            `;
            return;
        }
        if (kind === 'pdf') {
            targetEl.innerHTML = `
                <div class="attachment-preview-actions">
                    <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Open</a>
                    <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Download</a>
                </div>
                <iframe class="attachment-preview-pdf" src="${inlineSrc}" title="${safeName}"></iframe>
            `;
            return;
        }
        if (kind === 'word') {
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(inlineSrc)}`;
            targetEl.innerHTML = `
                <div class="attachment-preview-actions">
                    <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Open</a>
                    <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Download</a>
                </div>
                <div style="font-size:0.85em;color:#555;margin-bottom:8px;">
                    Word preview uses Office viewer. If it does not load, use Open or Download.
                </div>
                <iframe class="attachment-preview-pdf" src="${officeViewerUrl}" title="${safeName}"></iframe>
            `;
            return;
        }
        targetEl.innerHTML = `
            <div class="attachment-preview-unsupported">
                <div><strong>${safeName}</strong></div>
                <div>Type: ${safeType}</div>
                <div>Inline preview not supported.</div>
                <div class="attachment-preview-actions">
                    <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Open</a>
                    <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link">Download</a>
                </div>
            </div>
        `;
    }

    async function openAttachmentPreviewModal({ docId, docTitle }) {
        const modal = createAttachmentPreviewModal();
        const titleEl = modal.querySelector('#attachment-preview-title');
        const bodyEl = modal.querySelector('#attachment-preview-body');
        if (titleEl) titleEl.textContent = `Attachment Preview - ${docTitle || docId || ''}`;
        if (bodyEl) bodyEl.innerHTML = '<div class="attachment-preview-loading">Loading attachments...</div>';
        modal.style.display = 'flex';
        try {
            const attachments = await fetchDocumentAttachments(docId);
            if (!bodyEl) return;
            bodyEl.innerHTML = renderAttachmentPreviewList(docTitle, attachments);
            const renderArea = bodyEl.querySelector('#attachment-preview-render-area');
            const itemButtons = bodyEl.querySelectorAll('.attachment-list-item');
            if (!attachments.length || !renderArea) return;
            itemButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.getAttribute('data-attachment-index'));
                    if (Number.isNaN(idx) || !attachments[idx]) return;
                    itemButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderAttachmentPreviewContent(renderArea, attachments[idx]);
                });
            });
            itemButtons[0]?.click();
        } catch (err) {
            if (bodyEl) bodyEl.innerHTML = `<div class="attachment-preview-error">${escapeHtml(err.message || 'Failed to load attachments')}</div>`;
        }
    }

    function replaceReleasedWithForwarded(text) {
        return String(text || '').replace(/\breleased\b/gi, (token) => {
            if (token === token.toUpperCase()) return 'FORWARDED';
            if (token[0] === token[0].toUpperCase()) return 'Forwarded';
            return 'forwarded';
        });
    }

    function formatStatusForDisplay(status) {
        const normalized = String(status || '').trim();
        if (!normalized) return '-';
        return replaceReleasedWithForwarded(normalized);
    }

    function getStatusPillClass(status) {
        const normalized = String(status || '').toLowerCase();
        if (normalized.includes('received')) return 'track-pill received';
        if (normalized.includes('returned')) return 'track-pill returned';
        if (normalized.includes('released') || normalized.includes('forward')) return 'track-pill released';
        if (normalized.includes('hold') || normalized.includes('declined')) return 'track-pill hold';
        if (normalized.includes('complete')) return 'track-pill completed';
        return 'track-pill';
    }

    function getDocLatestTimestamp(doc) {
        const history = Array.isArray(doc?.status_history) ? doc.status_history : [];
        const latest = history.length ? history[history.length - 1] : null;
        return latest?.date || doc?.updated_at || doc?.created_at || '';
    }

    function matchesTrackFilters(doc, filters) {
        const timestamp = getDocLatestTimestamp(doc);
        const dt = timestamp ? new Date(timestamp) : null;
        const validDate = dt && !Number.isNaN(dt.getTime());
        const now = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const statusText = String(doc?.status || '').toLowerCase();
        const keywordText = `${doc?.title || ''} ${doc?.content || ''}`.toLowerCase();

        if (filters.code && !String(doc?.document_code || '').toLowerCase().includes(filters.code)) return false;
        if (filters.keyword && !keywordText.includes(filters.keyword)) return false;
        if (filters.statusPhase) {
            if (filters.statusPhase === 'released' && !statusText.includes('released')) return false;
            if (filters.statusPhase === 'received' && !statusText.includes('received by')) return false;
            if (filters.statusPhase === 'on_hold' && !statusText.includes('on hold by')) return false;
            if (filters.statusPhase === 'declined' && !statusText.includes('declined by')) return false;
            if (filters.statusPhase === 'completed' && !statusText.includes('completed by')) return false;
            if (filters.statusPhase === 'draft' && !statusText.includes('draft')) return false;
        }
        if (filters.datePreset && validDate) {
            if (filters.datePreset === 'today') {
                if (dt < start || dt > now) return false;
            } else if (filters.datePreset === 'last7') {
                const sevenDaysAgo = new Date(start);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                if (dt < sevenDaysAgo || dt > now) return false;
            } else if (filters.datePreset === 'last30') {
                const thirtyDaysAgo = new Date(start);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
                if (dt < thirtyDaysAgo || dt > now) return false;
            }
        }
        return true;
    }

    function setTrackFeedback(message, type = '') {
        if (!trackFeedback) return;
        trackFeedback.classList.remove('error', 'success');
        if (type) trackFeedback.classList.add(type);
        trackFeedback.textContent = message;
    }

    function normalizeDocs(payload) {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.items)) return payload.items;
        if (payload && payload._id) return [payload];
        return [];
    }

    function toTrackSnapshot(docs) {
        return JSON.stringify((docs || []).map(doc => ({
            id: doc._id || doc.id || doc.document_code,
            status: doc.status,
            currentOffice: doc.current_office_id?.office_name || doc.current_office_id || '',
            historyCount: Array.isArray(doc.status_history) ? doc.status_history.length : 0,
            updatedAt: doc.updated_at || ''
        })));
    }

    function stopTrackRealtimePolling() {
        if (!trackRealtimeInterval) return;
        clearInterval(trackRealtimeInterval);
        trackRealtimeInterval = null;
    }

    function startTrackRealtimePolling() {
        stopTrackRealtimePolling();
        if (!lastTrackQuery || !lastTrackQuery.code) return;
        if (lastTrackQuery.keyword || lastTrackQuery.statusPhase || lastTrackQuery.datePreset) return;
        if (trackMockToggle && trackMockToggle.checked) return;

        trackRealtimeInterval = setInterval(async () => {
            if (document.hidden) return;
            const trackSection = document.getElementById('track-section');
            if (!trackSection || trackSection.style.display === 'none') return;

            try {
                const payload = await fetchTrackedDocument(lastTrackQuery);
                const docs = normalizeDocs(payload).filter(doc => matchesTrackFilters(doc, lastTrackQuery));
                const incomingSnapshot = toTrackSnapshot(docs);
                if (incomingSnapshot !== lastTrackSnapshot) {
                    lastTrackSnapshot = incomingSnapshot;
                    lastTrackedDocs = docs;
                    trackResults.innerHTML = '';
                    trackResultsTableContainer.innerHTML = docs.length
                        ? renderTrackResultsTable(docs)
                        : '<div class="track-no-result">No document found for the selected filters.</div>';
                    setTrackFeedback('Live update: status changed.', 'success');
                }
            } catch (error) {
                // Keep interval alive; transient backend/network errors are expected.
            }
        }, 5000);
    }

    async function performTrackSearch() {
        const scope = getTrackScope();
        const filters = {
            code: trackDocCode?.value.trim().toLowerCase() || '',
            keyword: trackKeyword?.value.trim().toLowerCase() || '',
            statusPhase: trackStatus?.value || '',
            datePreset: trackDatePreset?.value || '',
            scopeOfficeId: scope.officeId,
            scopeUserId: scope.userId,
            summaryOnly: true,
            limit: 10,
            offset: 0
        };


        lastTrackQuery = filters;
        setTrackFeedback('Searching documents...');
        trackResults.innerHTML = '<div class="track-loading">Searching...</div>';
        trackResultsTableContainer.innerHTML = '';

        const useMock = trackMockToggle && trackMockToggle.checked;
        try {
            let docs = [];
            if (useMock) {
                await new Promise(r => setTimeout(r, 400));
                docs = mockDocs.filter(doc => matchesTrackFilters(doc, filters));
            } else {
                const apiDocs = await fetchTrackedDocument(filters);
                docs = normalizeDocs(apiDocs);
            }

            lastTrackedDocs = docs;
            lastTrackSnapshot = toTrackSnapshot(docs);

            if (docs.length > 0) {
                trackResults.innerHTML = '';
                trackResultsTableContainer.innerHTML = renderTrackResultsTable(docs);
                setTrackFeedback(`${docs.length} documents found. Click "View" to inspect timeline.`, 'success');
            } else {
                trackResults.innerHTML = '';
                trackResultsTableContainer.innerHTML = '<div class="track-no-result">No document found for the selected filters.</div>';
                setTrackFeedback('No results found.');
            }
            window.logDocs = docs;
            if (window.updateSidebarBadges) window.updateSidebarBadges();

            if (!useMock && filters.code && !filters.keyword && !filters.statusPhase && !filters.datePreset) {
                startTrackRealtimePolling();
                setTrackFeedback('Live tracking enabled for this document code.', 'success');
            } else {
                stopTrackRealtimePolling();
            }
        } catch (err) {
            lastTrackedDocs = [];
            window.logDocs = [];
            trackResultsTableContainer.innerHTML = '';
            trackResults.innerHTML = '<div class="track-no-result">Error fetching documents.</div>';
            setTrackFeedback(`Search failed: ${err.message}`, 'error');
            stopTrackRealtimePolling();
            if (window.updateSidebarBadges) window.updateSidebarBadges();
        }
    }

    if (trackSearchBtn) {
        trackSearchBtn.addEventListener('click', performTrackSearch);
    }

    [trackDocCode, trackKeyword, trackStatus, trackDatePreset].forEach(input => {
        if (!input) return;
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                performTrackSearch();
            }
        });
    });

    if (trackClearBtn) {
        trackClearBtn.addEventListener('click', () => {
            if (trackDocCode) trackDocCode.value = '';
            if (trackKeyword) trackKeyword.value = '';
            if (trackStatus) trackStatus.value = '';
            if (trackDatePreset) trackDatePreset.value = '';
            trackResults.innerHTML = '';
            trackResultsTableContainer.innerHTML = '';
            lastTrackedDocs = [];
            window.logDocs = [];
            lastTrackQuery = null;
            stopTrackRealtimePolling();
            setTrackFeedback('Filters cleared.');
            if (window.updateSidebarBadges) window.updateSidebarBadges();
        });
    }

    function getTrackScope() {
        const user = window.loggedInUser || JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        const officeId = user?.office_id?._id || user?.office_id || '';
        const userId = user?._id || user?.id || '';
        return { officeId, userId };
    }

    async function fetchTrackedDocument({
        code,
        keyword,
        statusPhase,
        datePreset,
        scopeOfficeId,
        scopeUserId,
        limit = 10,
        offset = 0,
        summaryOnly = true,
        recent = false,
        recentMode = 'both'
    }) {
        let url = `${getApiBase()}/documents/search?`;
        const params = [];
        if (code) params.push(`document_code=${encodeURIComponent(code)}`);
        if (keyword) params.push(`q=${encodeURIComponent(keyword)}`);
        if (statusPhase) params.push(`statusPhase=${encodeURIComponent(statusPhase)}`);
        if (datePreset) params.push(`datePreset=${encodeURIComponent(datePreset)}`);
        if (scopeOfficeId) params.push(`scopeOfficeId=${encodeURIComponent(scopeOfficeId)}`);
        if (scopeUserId) params.push(`scopeUserId=${encodeURIComponent(scopeUserId)}`);
        params.push(`limit=${encodeURIComponent(limit)}`);
        params.push(`offset=${encodeURIComponent(offset)}`);
        if (summaryOnly) params.push('summaryOnly=true');
        if (recent) params.push('recent=true');
        if (recentMode) params.push(`recentMode=${encodeURIComponent(recentMode)}`);
        url += params.join('&');
        const res = await fetch(url);
        const payload = await res.json();
        if (!res.ok) {
            throw new Error(payload?.error || 'Unable to fetch tracked documents');
        }
        return payload;
    }

    function renderTimeline(statusHistory) {
        if (!statusHistory || !statusHistory.length) return '<div class="timeline-empty">No status history available.</div>';
        return `<div class="timeline">
            ${statusHistory.map(item => `
                <div class="timeline-item">
                    <div class="timeline-status">${escapeHtml(formatStatusForDisplay(item.status))}</div>
                    <div class="timeline-meta">${escapeHtml((item.to_office_id && item.to_office_id.office_name) || (item.from_office_id && item.from_office_id.office_name) || item.office_name || '')} ${item.user_name ? 'by ' + escapeHtml(item.user_name) : ''}</div>
                    <div class="timeline-date">${item.date ? new Date(item.date).toLocaleString() : '-'}</div>
                    <div class="timeline-meta">Remarks: ${escapeHtml(String(item.remarks || '').trim() || '—')}</div>
                </div>
            `).join('')}
        </div>`;
    }

    function hasEditedLifecycleEvent(doc) {
        const history = Array.isArray(doc?.status_history) ? doc.status_history : [];
        return history.some((item) => String(item?.status || '').toUpperCase().includes('EDITED BY'));
    }

    function renderTrackResult(doc) {
        if (!doc) return '<div class="track-no-result">No document found.</div>';
        const editedIndicator = hasEditedLifecycleEvent(doc)
            ? ' <span class="edited-indicator">Edited</span>'
            : '';
        return `
        <div class="track-doc-card">
            <div class="track-doc-main">
                <div><b>Code:</b> ${escapeHtml(doc.document_code || '-')}</div>
                <div><b>Title:</b> ${escapeHtml(doc.title || '-')}${editedIndicator}</div>
                <div><b>Type:</b> ${escapeHtml(doc.type_id?.type_name || '-')}</div>
                <div><b>Content/Description:</b> ${escapeHtml(doc.content || '-')}</div>
                <div><b>Current Office:</b> ${escapeHtml(doc.current_office_id?.office_name || '-')}</div>
                <div><b>Status:</b> <span class="${getStatusPillClass(doc.status)}">${escapeHtml(formatStatusForDisplay(doc.status))}</span></div>
                <div style="margin-top:10px;"><button type="button" class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</button></div>
            </div>
            <div class="track-doc-timeline">
                <h4>Status Timeline</h4>
                ${renderTimeline(doc.status_history)}
            </div>
            ${lastTrackedDocs.length > 1 ? '<button class="track-back-btn" id="track-back-to-table-btn">Back to list</button>' : ''}
        </div>
        `;
    }

    function renderTrackResultsTable(docs) {
        return `<div class="track-table-container"><table class="track-table"><thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Current Office</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${docs.map((doc, i) => `
            <tr>
                <td>${escapeHtml(doc.document_code || '-')}</td>
                <td>${escapeHtml(doc.title || '-')}${hasEditedLifecycleEvent(doc) ? ' <span class="edited-indicator">Edited</span>' : ''}</td>
                <td>${escapeHtml(doc.type_id?.type_name || '-')}</td>
                <td>${escapeHtml(doc.current_office_id?.office_name || '-')}</td>
                <td><span class="${getStatusPillClass(doc.status)}">${escapeHtml(formatStatusForDisplay(doc.status))}</span></td>
                <td><button class="track-view-btn" data-index="${i}">View</button> <button type="button" class="track-view-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</button></td>
            </tr>
        `).join('')}
    </tbody></table></div>`;
    }

    document.addEventListener('click', function (e) {
        const previewBtn = e.target.closest('.attachment-preview-btn');
        if (previewBtn) {
            const docId = previewBtn.getAttribute('data-doc-id');
            const docTitle = previewBtn.getAttribute('data-doc-title') || 'Document';
            if (docId) openAttachmentPreviewModal({ docId, docTitle });
            return;
        }

        if (e.target.classList.contains('track-view-btn')) {
            const idx = Number(e.target.getAttribute('data-index'));
            if (!Array.isArray(lastTrackedDocs) || !lastTrackedDocs.length || Number.isNaN(idx)) return;
            const selectedDoc = lastTrackedDocs[idx];
            openTrackedDocument(selectedDoc);
        }

        if (e.target.id === 'track-back-to-table-btn' && lastTrackedDocs.length > 1) {
            trackResults.innerHTML = '';
            trackResultsTableContainer.innerHTML = renderTrackResultsTable(lastTrackedDocs);
            setTrackFeedback(`${lastTrackedDocs.length} documents found. Click "View" to inspect timeline.`, 'success');
        }

        if (e.target.classList.contains('track-recent-item-btn')) {
            const docId = e.target.getAttribute('data-doc-id');
            const selectedDoc = (lastRecentDocs || []).find(doc => String(doc._id || doc.id) === String(docId));
            if (!selectedDoc) return;
            openTrackedDocument(selectedDoc);
        }
    });

    document.addEventListener('mouseover', function (e) {
        const previewBtn = e.target.closest('.attachment-preview-btn');
        if (!previewBtn) return;
        const docId = previewBtn.getAttribute('data-doc-id');
        prefetchAttachmentsDebounced(docId, 250);
    });

    async function fetchDocumentTimeline(docId) {
        const res = await fetch(`${getApiBase()}/documents/${docId}/timeline`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Unable to fetch timeline');
        return payload;
    }

    function toTrackTimelineItems(timelinePayload) {
        const list = Array.isArray(timelinePayload?.timeline) ? timelinePayload.timeline : [];
        const mapped = list
            .map((item, index) => ({
                status: item.status,
                date: item.date,
                from_office_id: item.from_office ? { office_name: item.from_office.office_name } : null,
                to_office_id: item.to_office ? { office_name: item.to_office.office_name } : null,
                user_name: item.user?.username || '',
                remarks: item.remarks || '',
                _originalIndex: index
            }))
            .sort((a, b) => {
                const aTime = new Date(a.date).getTime();
                const bTime = new Date(b.date).getTime();
                const safeATime = Number.isFinite(aTime) ? aTime : 0;
                const safeBTime = Number.isFinite(bTime) ? bTime : 0;
                if (safeATime !== safeBTime) return safeATime - safeBTime;
                return a._originalIndex - b._originalIndex;
            })
            .map(({ _originalIndex, ...item }) => item);
        const mappedEpochs = mapped.map((item) => new Date(item.date).getTime());
        const mappedMonotonicAsc = mappedEpochs.every((ts, index) => index === 0 || ts >= mappedEpochs[index - 1]);
        return mapped;
    }

    async function openTrackedDocument(doc) {
        if (!doc) return;
        trackResultsTableContainer.innerHTML = '';
        trackResults.innerHTML = '<div class="track-loading">Loading timeline...</div>';
        try {
            const docId = doc._id || doc.id;
            const timelinePayload = await fetchDocumentTimeline(docId);
            const withTimeline = {
                ...doc,
                status: timelinePayload?.current_status || doc.status,
                status_history: toTrackTimelineItems(timelinePayload)
            };
            trackResults.innerHTML = renderTrackResult(withTimeline);
            setTrackFeedback('Viewing document details.', 'success');
        } catch (err) {
            trackResults.innerHTML = '<div class="track-no-result">Unable to load document timeline.</div>';
            setTrackFeedback(`Failed to load timeline: ${err.message}`, 'error');
        }
    }

    function renderRecentDocuments(docs) {
        if (!trackRecentList) return;
        if (!Array.isArray(docs) || docs.length === 0) {
            trackRecentList.innerHTML = '<div class="track-no-result">No recent documents found.</div>';
            return;
        }
        trackRecentList.innerHTML = docs.map((doc, index) => `
            <button type="button" class="track-recent-item-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}">
                <span class="track-recent-item-order">${index + 1}</span>
                <span class="track-recent-item-main">
                    <span class="track-recent-item-code">${escapeHtml(doc.document_code || '-')}</span>
                    <span class="track-recent-item-title">${escapeHtml(doc.title || '-')}${hasEditedLifecycleEvent(doc) ? ' (Edited)' : ''}</span>
                </span>
                <span class="${getStatusPillClass(doc.status)}">${escapeHtml(formatStatusForDisplay(doc.status))}</span>
                <span class="track-preview-inline-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</span>
            </button>
        `).join('');
    }

    function setActiveRecentTab(mode) {
        activeRecentMode = mode;
        if (trackRecentCreatedTab) trackRecentCreatedTab.classList.toggle('active', mode === 'created');
        if (trackRecentHandledTab) trackRecentHandledTab.classList.toggle('active', mode === 'handled');
    }

    async function loadRecentDocuments(mode = 'created') {
        if (!trackRecentList) return;
        setActiveRecentTab(mode);
        trackRecentList.innerHTML = '<div class="track-loading">Loading recent documents...</div>';
        try {
            const scope = getTrackScope();
            const payload = await fetchTrackedDocument({
                scopeOfficeId: scope.officeId,
                scopeUserId: scope.userId,
                summaryOnly: true,
                recent: true,
                recentMode: mode,
                limit: 10,
                offset: 0
            });
            const docs = normalizeDocs(payload);
            lastRecentDocs = docs;
            window.logDocs = docs;
            renderRecentDocuments(docs);
            if (window.updateSidebarBadges) window.updateSidebarBadges();
        } catch (err) {
            window.logDocs = [];
            trackRecentList.innerHTML = '<div class="track-no-result">Failed to load recent documents.</div>';
            if (window.updateSidebarBadges) window.updateSidebarBadges();
        }
    }

    if (trackRecentCreatedTab) {
        trackRecentCreatedTab.addEventListener('click', () => loadRecentDocuments('created'));
    }
    if (trackRecentHandledTab) {
        trackRecentHandledTab.addEventListener('click', () => loadRecentDocuments('handled'));
    }
    if (trackRecentList) {
        loadRecentDocuments(activeRecentMode);
    }

    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.top-bar i.fa-bars');
    const sidebar = document.querySelector('.sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.sidebar') && !e.target.closest('.top-bar')) {
                sidebar.classList.remove('show');
            }
        }
    });

    // === LOGS REPORT RENDERING (OFFICE-SCOPED) ===
    const LOGS_REPORT_TAB_LABELS = {
        created: 'Created by my Office',
        handled: 'Handled by my Office'
    };
    const logsReportState = {
        activeTab: 'created',
        createdDocs: [],
        handledDocs: []
    };

    function formatReportDateTime(value) {
        if (!value) return '-';
        const dt = new Date(value);
        return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString();
    }

    function getReportDateRangeLabel(datePreset, fromDate, toDate) {
        if (datePreset === 'last7') return 'Last 7 Days';
        if (datePreset === 'last30') return 'Last 30 Days';
        if (datePreset === 'custom') return `${fromDate || '-'} to ${toDate || '-'}`;
        return 'Last 7 Days';
    }

    function setLogsReportMessage(message, isError = false) {
        const messageEl = document.getElementById('logsReportMessage');
        if (!messageEl) return;
        if (!message) {
            messageEl.style.display = 'none';
            messageEl.textContent = '';
            messageEl.classList.remove('error');
            return;
        }
        messageEl.style.display = 'block';
        messageEl.textContent = message;
        messageEl.classList.toggle('error', isError);
    }

    function getActiveLogsReportDocuments() {
        if (logsReportState.activeTab === 'handled') return logsReportState.handledDocs;
        return logsReportState.createdDocs;
    }

    function setLogsReportActiveTab(nextTab) {
        const tab = nextTab === 'handled' ? 'handled' : 'created';
        logsReportState.activeTab = tab;
        document.body.setAttribute('data-logs-report-tab', tab);

        const tabButtons = document.querySelectorAll('.logs-report-tab');
        tabButtons.forEach((btn) => {
            const isActive = btn.getAttribute('data-report-tab') === tab;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const headerScope = document.getElementById('logsHeaderScope');
        if (headerScope) headerScope.textContent = LOGS_REPORT_TAB_LABELS[tab];

        const activeDocs = getActiveLogsReportDocuments();
        window.reportDocs = activeDocs;
        renderLogsReport(activeDocs);

        if (!activeDocs.length) {
            setLogsReportMessage('No report entries found for the selected scope and date range.');
        } else {
            setLogsReportMessage('');
        }
    }

    function renderLogsReport(documents) {
        const container = document.getElementById('log-container');
        if (!container) return;
        container.innerHTML = '';

        if (!Array.isArray(documents) || documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No Report Entries</h3>
                    <p>No documents matched the selected report range.</p>
                </div>
            `;
            return;
        }

        documents.forEach((doc) => {
            const timeline = Array.isArray(doc.timeline) ? doc.timeline : [];
            const hasEditedEvent = timeline.some((item) => String(item?.status || '').toUpperCase().includes('EDITED BY'));
            const rows = timeline.map((item) => `
                <tr>
                    <td>${escapeHtml(formatReportDateTime(item.timestamp))}</td>
                    <td>${escapeHtml(item.document_code || doc.tracking_code || '-')}</td>
                    <td>${escapeHtml(item.title || doc.title || '-')}</td>
                    <td>${escapeHtml(item.from_office_name || '-')} &rarr; ${escapeHtml(item.to_office_name || '-')}</td>
                    <td>${escapeHtml(formatStatusForDisplay(item.status || '-'))}</td>
                    <td>${escapeHtml(item.action_by_username || 'System')}</td>
                    <td class="logs-report-remarks-cell">${escapeHtml(String(item.remarks || '').trim() || '—')}</td>
                </tr>
            `).join('');

            const wrapper = document.createElement('article');
            wrapper.className = 'logs-report-document-card';
            wrapper.innerHTML = `
                <div class="logs-report-document-meta">
                    <div><strong>Tracking Code:</strong> ${escapeHtml(doc.tracking_code || '-')}</div>
                    <div><strong>Title:</strong> ${escapeHtml(doc.title || '-')}${hasEditedEvent ? ' <span class="edited-indicator">Edited</span>' : ''}</div>
                    <div><strong>Type:</strong> ${escapeHtml(doc.type_name || '-')}</div>
                    <div><strong>Content/Description:</strong> ${escapeHtml(doc.content || '-')}</div>
                    <div><strong>Current Status:</strong> ${escapeHtml(doc.current_status || '-')}</div>
                    <div><strong>Last Updated:</strong> ${escapeHtml(formatReportDateTime(doc.last_updated))}</div>
                    <div class="logs-report-preview-action"><button type="button" class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.tracking_code || 'Document')}">👁 Preview</button></div>
                </div>
                <div class="logs-report-table-wrapper">
                    <table class="logs-report-table">
                        <thead>
                            <tr>
                                <th>Date/Time</th>
                                <th>Document Code</th>
                                <th>Title</th>
                                <th>From/To Office</th>
                                <th>Status</th>
                                <th>Action by User</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="7" class="logs-report-empty-row">No timeline entries.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(wrapper);
        });
    }

    async function fetchAndRenderLogCards() {
        const datePresetEl = document.getElementById('logsDatePreset');
        const fromDateEl = document.getElementById('logsDateFrom');
        const toDateEl = document.getElementById('logsDateTo');
        const headerOffice = document.getElementById('logsHeaderOffice');
        const headerDateRange = document.getElementById('logsHeaderDateRange');
        const headerGenerated = document.getElementById('logsHeaderGeneratedAt');
        const datePreset = datePresetEl ? datePresetEl.value : 'last7';
        const fromDate = fromDateEl ? fromDateEl.value : '';
        const toDate = toDateEl ? toDateEl.value : '';

        if (datePreset === 'custom' && (!fromDate || !toDate)) {
            setLogsReportMessage('Select both custom dates before applying the report filter.', true);
            renderLogsReport([]);
            return;
        }

        try {
            setLogsReportMessage('');
            const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            const headers = {};
            if (user && user.token) {
                headers.Authorization = `Bearer ${user.token}`;
            }
            const params = new URLSearchParams({ datePreset: datePreset || 'last7' });
            if (datePreset === 'custom') {
                params.set('fromDate', fromDate);
                params.set('toDate', toDate);
            }
            const res = await fetch(`${getApiBase()}/reports/my-office?${params.toString()}`, { headers });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.message || 'Failed to load office report.');

            const hasBucketPayload =
                Array.isArray(payload.created_documents) || Array.isArray(payload.handled_documents);
            const createdDocs = Array.isArray(payload.created_documents)
                ? payload.created_documents
                : (hasBucketPayload ? [] : (Array.isArray(payload.documents) ? payload.documents : []));
            const handledDocs = Array.isArray(payload.handled_documents) ? payload.handled_documents : [];
            logsReportState.createdDocs = createdDocs;
            logsReportState.handledDocs = handledDocs;

            if (headerOffice) headerOffice.textContent = payload.office?.name || '-';
            if (headerDateRange) headerDateRange.textContent = getReportDateRangeLabel(datePreset, fromDate, toDate);
            if (headerGenerated) headerGenerated.textContent = formatReportDateTime(payload.filters?.generatedAt || new Date().toISOString());
            setLogsReportActiveTab(logsReportState.activeTab);
        } catch (error) {
            console.error('Error loading logs report:', error);
            logsReportState.createdDocs = [];
            logsReportState.handledDocs = [];
            window.reportDocs = [];
            renderLogsReport([]);
            setLogsReportMessage(error.message || 'Failed to load office report.', true);
        }
    }

    (function initLogsReportControls() {
        const datePresetEl = document.getElementById('logsDatePreset');
        const customRangeEl = document.getElementById('logsCustomRange');
        const applyBtn = document.getElementById('logsApplyFilterBtn');
        const printBtn = document.getElementById('logsPrintBtn');
        const fromDateEl = document.getElementById('logsDateFrom');
        const toDateEl = document.getElementById('logsDateTo');
        const createdTabBtn = document.getElementById('logsCreatedTabBtn');
        const handledTabBtn = document.getElementById('logsHandledTabBtn');

        function toggleCustomRange() {
            if (!datePresetEl || !customRangeEl) return;
            customRangeEl.style.display = datePresetEl.value === 'custom' ? 'flex' : 'none';
        }

        if (datePresetEl) {
            datePresetEl.addEventListener('change', () => {
                toggleCustomRange();
                if (datePresetEl.value !== 'custom') fetchAndRenderLogCards();
            });
        }
        if (fromDateEl) fromDateEl.addEventListener('change', () => {
            if (datePresetEl && datePresetEl.value === 'custom' && toDateEl && toDateEl.value) fetchAndRenderLogCards();
        });
        if (toDateEl) toDateEl.addEventListener('change', () => {
            if (datePresetEl && datePresetEl.value === 'custom' && fromDateEl && fromDateEl.value) fetchAndRenderLogCards();
        });
        if (applyBtn) applyBtn.addEventListener('click', fetchAndRenderLogCards);
        if (createdTabBtn) createdTabBtn.addEventListener('click', () => setLogsReportActiveTab('created'));
        if (handledTabBtn) handledTabBtn.addEventListener('click', () => setLogsReportActiveTab('handled'));
        if (printBtn) printBtn.addEventListener('click', () => {
            setLogsReportActiveTab(logsReportState.activeTab);
            window.print();
        });

        toggleCustomRange();
        setLogsReportActiveTab(logsReportState.activeTab);
    })();

    fetchAndRenderLogCards();

    // --- DYNAMIC INCOMING CARD ACTIONS ---
    (function () {
        // Always start empty; incoming data should come from API.
        window.incomingDocs = Array.isArray(window.incomingDocs) ? window.incomingDocs : [];
        const officeOptions = [
            'VPAA',
            "CLASE Dean's Office",
            'Registrar',
            'Accounting',
            'HRMO',
            'CSIT Office'
        ];
        const currentOffice = 'CSIT Office';

        // Render incoming cards
        function renderIncomingCards() {
            if (document.getElementById('incoming-table-body')) return;
            const container = document.getElementById('incoming-container');
            if (!container) return;
            container.innerHTML = '';
            incomingDocs.forEach((doc, idx) => {
                const card = document.createElement('div');
                card.className = 'document-card incoming-card';
                card.setAttribute('data-index', idx);
                card.innerHTML = `
                    <div class="card-header">
                        <div class="document-code">${doc.code}</div>
                    </div>
                    <div class="card-content">
                        <div class="card-row"><div class="label">Office:</div><div class="value">${doc.office}</div></div>
                        <div class="card-row"><div class="label">Subject:</div><div class="value">${doc.subject}</div></div>
                        <div class="card-row"><div class="label">Content:</div><div class="value">${doc.content}</div></div>
                        <div class="card-row"><div class="label">Type:</div><div class="value">${doc.type}</div></div>
                        <div class="card-row"><div class="label">From Office:</div><div class="value">${doc.fromOffice}</div></div>
                        <div class="card-row"><div class="label">Forwarded By:</div><div class="value">${doc.releasedBy}</div></div>
                        <div class="card-row"><div class="label">Forwarded Date:</div><div class="value">${doc.releasedDate}</div></div>
                        ${doc.forwardedTo ? `<div class='card-row'><span class='label'>Forwarded to:</span> <span class='value forwarded-label'>${doc.forwardedTo}</span></div>` : ''}
                    </div>
                `;
                card.style.cursor = 'pointer';
                card.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openActionModal(idx);
                });
                container.appendChild(card);
            });
        }

        // Modal creation (if not present)
        let actionModal = document.getElementById('incoming-action-modal');
        if (!actionModal) {
            actionModal = document.createElement('div');
            actionModal.id = 'incoming-action-modal';
            actionModal.className = 'modal';
            actionModal.style.display = 'none';
            document.body.appendChild(actionModal);
        }
        let selectedIndex = null;

        // Modal open logic
        function openActionModal(idx) {
            selectedIndex = idx;
            const doc = incomingDocs[idx];
            actionModal.innerHTML = `
                <div class="modal-content" style="max-width:420px;width:96%;border-radius:16px;box-shadow:0 8px 32px rgba(44,62,80,0.18),0 1.5px 6px rgba(44,62,80,0.10);padding:32px 32px 24px 32px;">
                    <h2 style="margin-top:0;margin-bottom:20px;font-size:1.2em;font-weight:700;color:#222;">Choose Action</h2>
                    <div style="margin-bottom: 22px;line-height:1.7;">
                        <div style='margin-bottom:6px;'><span style='font-weight:600;color:#222;'>Code:</span> <span style='color:#222;'>${doc.code}</span></div>
                        <div style='margin-bottom:6px;'><span style='font-weight:600;color:#222;'>Office:</span> <span style='color:#222;'>${doc.office}</span></div>
                        <div style='margin-bottom:6px;'><span style='font-weight:600;color:#222;'>Subject:</span> <span style='color:#222;'>${doc.subject}</span></div>
                        <div style='margin-bottom:6px;'><span style='font-weight:600;color:#222;'>Type:</span> <span style='color:#222;'>${doc.type}</span></div>
                        <div style='margin-bottom:6px;'><span style='font-weight:600;color:#222;'>Content:</span> <span style='color:#222;'>${doc.content}</span></div>
                    </div>
                    <div style="display: flex; gap: 16px; justify-content: center; margin-bottom: 24px;">
                        <button id="modal-receive-btn" class="btn-logout" style="background: #27ae60;">Receive</button>
                        <button id="modal-cancel-btn" class="btn-cancel">Cancel</button>
                    </div>
                    <div style="margin-top:10px;padding:18px 0 0 0;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;justify-content:center;">
                        <label for="forward-office-select" style="font-weight:600;color:#222;margin-right:4px;">Forward to Office:</label>
                        <select id="forward-office-select" style="padding:7px 12px;border-radius:6px;border:1px solid #ddd;">${officeOptions.filter(o => o !== currentOffice).map(o => `<option value='${o}'>${o}</option>`).join('')}</select>
                        <button id="forward-doc-btn" class="btn-logout" style="background:#27ae60;color:white;padding:7px 18px;border-radius:6px;">Forward</button>
                    </div>
                </div>
            `;
            actionModal.style.display = 'flex';
            actionModal.querySelector('#modal-receive-btn').onclick = function () {
                if (selectedIndex !== null) {
                    document.getElementById('received-container').appendChild(document.querySelector(`#incoming-container .document-card[data-index='${selectedIndex}']`));
                    selectedIndex = null;
                    actionModal.style.display = 'none';
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                    if (window.updateSummaryCards) window.updateSummaryCards();
                }
            };
            actionModal.querySelector('#modal-cancel-btn').onclick = function () {
                selectedIndex = null;
                actionModal.style.display = 'none';
            };
            actionModal.querySelector('#forward-doc-btn').onclick = function () {
                if (selectedIndex !== null) {
                    const toOffice = actionModal.querySelector('#forward-office-select').value;
                    forwardIncomingDoc(selectedIndex, toOffice);
                    actionModal.style.display = 'none';
                }
            };
            actionModal.onclick = function (e) {
                if (e.target === actionModal) {
                    actionModal.style.display = 'none';
                    selectedIndex = null;
                }
            };
        }

        // Forward logic for incoming
        function forwardIncomingDoc(idx, toOffice) {
            const doc = incomingDocs[idx];
            if (!doc) return;
            doc.forwardedTo = toOffice;
            // Remove from incoming
            incomingDocs.splice(idx, 1);
            // Move to forwarded section
            const forwardedContainer = document.getElementById('forwarded-container');
            if (forwardedContainer) {
                const card = document.createElement('div');
                card.className = 'document-card forwarded-card';
                card.innerHTML = `
                    <div class="card-header">
                        <div class="document-code">${doc.code}</div>
                    </div>
                    <div class="card-content">
                        <div class="card-row"><div class="label">Office:</div><div class="value">${doc.office}</div></div>
                        <div class="card-row"><div class="label">Subject:</div><div class="value">${doc.subject}</div></div>
                        <div class="card-row"><div class="label">Content:</div><div class="value">${doc.content}</div></div>
                        <div class="card-row"><div class="label">Type:</div><div class="value">${doc.type}</div></div>
                        <div class='card-row'><span class='label'>Forwarded to:</span> <span class='value forwarded-label'>${toOffice}</span></div>
                </div>
                `;
                forwardedContainer.appendChild(card);
            }
            renderIncomingCards();
            if (window.updateSidebarBadges) window.updateSidebarBadges();
            if (window.updateSummaryCards) window.updateSummaryCards();
        }

        // Expose for testing
        window.renderIncomingCards = renderIncomingCards;
        window.openActionModal = openActionModal;
        window.forwardIncomingDoc = forwardIncomingDoc;

        // Initial render
        renderIncomingCards();
    })();

    // --- BADGE COUNT UPDATER ---
    (function () {
        const sectionConfig = [
            { key: 'incoming', badgeSelector: '.nav-link[data-section="incoming"] .badge' },
            { key: 'received', badgeSelector: '.nav-link[data-section="received"] .badge' },
            { key: 'outgoing', badgeSelector: '.nav-link[data-section="outgoing"] .badge' },
            { key: 'complete', badgeSelector: '.nav-link[data-section="complete"] .badge' },
            { key: 'logs', badgeSelector: '.nav-link[data-section="logs"] .badge' },
        ];

        function getCount(arr) {
            return Array.isArray(arr) ? arr.length : 0;
        }

        function getBadgeCount(sectionKey) {
            if (sectionKey === 'incoming') return getCount(window.incomingDocs);
            if (sectionKey === 'received') return getCount(window.receivedDocs);
            if (sectionKey === 'complete') return getCount(window.completeDocs);
            if (sectionKey === 'logs') return getCount(window.logDocs);
            if (sectionKey === 'outgoing') {
                const outgoingTotal = Number(window.outgoingDocsTotal);
                return Number.isFinite(outgoingTotal) ? outgoingTotal : getCount(window.outgoingDocs);
            }
            return 0;
        }

        window.incomingDocs = window.incomingDocs || [];
        window.receivedDocs = window.receivedDocs || [];
        window.outgoingDocs = window.outgoingDocs || [];
        window.completeDocs = window.completeDocs || [];
        window.logDocs = window.logDocs || [];

        function updateSidebarBadges() {
            sectionConfig.forEach(cfg => {
                const badge = document.querySelector(cfg.badgeSelector);
                if (badge) {
                    badge.textContent = String(getBadgeCount(cfg.key));
                }
            });
        }

        window.updateSidebarBadges = updateSidebarBadges;
        updateSidebarBadges();
    })();

    // --- SUMMARY CARDS UPDATER ---
    (function () {
        function getCount(arr) {
            return Array.isArray(arr) ? arr.length : 0;
        }
        function updateSummaryCards() {
            // Use global arrays or fallback to 0
            const incoming = window.incomingDocs || [];
            const received = window.receivedDocs || [];
            const outgoing = window.outgoingDocs || [];
            const total = getCount(incoming) + getCount(received) + getCount(outgoing);

            const totalEl = document.getElementById('total-docs-count');
            const incomingEl = document.getElementById('incoming-docs-count');
            const receivedEl = document.getElementById('received-docs-count');
            const outgoingEl = document.getElementById('outgoing-docs-count');
            const outgoingCount = Number.isFinite(window.outgoingDocsTotal) ? window.outgoingDocsTotal : getCount(outgoing);

            if (totalEl) totalEl.textContent = total;
            if (incomingEl) incomingEl.textContent = getCount(incoming);
            if (receivedEl) receivedEl.textContent = getCount(received);
            if (outgoingEl) outgoingEl.textContent = outgoingCount;
        }
        window.updateSummaryCards = updateSummaryCards;
        updateSummaryCards();
    })();

    // After any document move or addition, call window.updateSummaryCards();

    // In modal handlers, after moving a card, also call window.updateSummaryCards();

    // --- RECEIVED SECTION MODULAR LOGIC ---
    // Refactored to use backend data, add Forward button, and modal
    (function () {
        let offices = [];
        // Fetch offices if not already loaded
        async function ensureOfficesLoaded() {
            if (offices.length > 0) return offices;
            try {
                const res = await fetch(`${getOfficesApiBase()}/offices`);
                const data = await res.json();
                offices = Array.isArray(data) ? data.filter(o => o.is_active !== false) : [];
            } catch (err) {
                offices = [];
            }
            return offices;
        }

        // Render received table using backend data
        window.renderReceivedCards = function renderReceivedCards() {
            const tableBody = document.getElementById('received-table-body');
            if (!tableBody) return;
            const docs = Array.isArray(window.receivedDocs) ? window.receivedDocs : [];
            if (!docs.length) {
                tableBody.innerHTML = '<tr><td class="section-empty-row" colspan="8">No received documents found.</td></tr>';
                applySectionFilters(document.getElementById('received-section'));
                return;
            }
            tableBody.innerHTML = docs.map((doc, idx) => {
                const history = Array.isArray(doc.status_history) ? doc.status_history : [];
                const receivedStatus = history
                    .filter(item => String(item?.status || '').toLowerCase().includes('received by'))
                    .slice(-1)[0];
                const receivedAt = receivedStatus?.date || doc.updated_at || doc.created_at;
                const requisitioner = doc.requisitioner || doc.requester_office_id?.office_name || '-';
                return `
                    <tr data-row-type="received" data-row-index="${idx}">
                        <td>${escapeHtml(doc.document_code || '-')}</td>
                        <td>${escapeHtml(requisitioner)}</td>
                        <td>${escapeHtml(doc.title || '-')}</td>
                        <td>${escapeHtml(doc.type_id?.type_name || '-')}</td>
                        <td><span class="${getStatusPillClass(doc.status)}">${escapeHtml(formatStatusForDisplay(doc.status))}</span></td>
                        <td>${receivedAt ? new Date(receivedAt).toLocaleString() : '-'}</td>
                        <td class="attachments-cell"><button class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</button></td>
                        <td class="actions-cell">
                            <button class="action-btn edit-attachments-btn" data-idx="${idx}">Edit Attachments</button>
                            <button class="action-btn forward-btn" data-idx="${idx}">Forward</button>
                            <button class="action-btn decline-btn return-btn" data-idx="${idx}">Return</button>
                            <button class="action-btn receive-btn complete-btn" data-idx="${idx}">Mark as Completed</button>
                        </td>
                    </tr>
                `;
            }).join('');
            tableBody.querySelectorAll('.forward-btn').forEach((btn) => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const idx = Number(btn.getAttribute('data-idx'));
                    if (!Number.isNaN(idx)) openForwardModal(idx);
                });
            });
            tableBody.querySelectorAll('.edit-attachments-btn').forEach((btn) => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const idx = Number(btn.getAttribute('data-idx'));
                    if (!Number.isNaN(idx)) openReceivedAttachmentEditModal(idx);
                });
            });
            tableBody.querySelectorAll('.complete-btn').forEach((btn) => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const idx = Number(btn.getAttribute('data-idx'));
                    if (!Number.isNaN(idx)) openCompleteModal(idx);
                });
            });
            tableBody.querySelectorAll('.return-btn').forEach((btn) => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const idx = Number(btn.getAttribute('data-idx'));
                    if (!Number.isNaN(idx)) returnReceivedDocument(idx);
                });
            });
            tableBody.querySelectorAll('tr[data-row-type="received"]').forEach((row) => {
                row.addEventListener('click', function (e) {
                    if (e.target.closest('.edit-attachments-btn, .forward-btn, .return-btn, .complete-btn, .attachment-preview-btn')) return;
                    const idx = Number(row.getAttribute('data-row-index'));
                    if (!Number.isNaN(idx)) openReceivedModal(idx);
                });
            });
            docs.forEach((doc) => prefetchAttachmentsDebounced(doc._id || doc.id, 250));
            applySectionFilters(document.getElementById('received-section'));
        };

        // Modal creation (if not present)
        let forwardModal = document.getElementById('received-forward-modal');
        if (!forwardModal) {
            forwardModal = document.createElement('div');
            forwardModal.id = 'received-forward-modal';
            forwardModal.className = 'modal';
            forwardModal.style.display = 'none';
            document.body.appendChild(forwardModal);
        }

        let completeModal = document.getElementById('received-complete-modal');
        if (!completeModal) {
            completeModal = document.createElement('div');
            completeModal.id = 'received-complete-modal';
            completeModal.className = 'modal';
            completeModal.style.display = 'none';
            document.body.appendChild(completeModal);
        }

        let receivedEditAttachmentsModal = document.getElementById('received-edit-attachments-modal');
        if (!receivedEditAttachmentsModal) {
            receivedEditAttachmentsModal = document.createElement('div');
            receivedEditAttachmentsModal.id = 'received-edit-attachments-modal';
            receivedEditAttachmentsModal.className = 'modal';
            receivedEditAttachmentsModal.style.display = 'none';
            document.body.appendChild(receivedEditAttachmentsModal);
        }

        // Open modal for forwarding
        async function openForwardModal(index) {
            const doc = window.receivedDocs[index];
            if (!doc) return;
            const officesList = await ensureOfficesLoaded();
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            const myOfficeId = user.office_id?._id || user.office_id;
            const officeOptions = officesList.filter(o => (o._id || o.id) !== myOfficeId && o.is_active !== false);
            forwardModal.innerHTML = `
                <div class="modal-content" style="max-width:420px;width:96%;border-radius:16px;box-shadow:0 8px 32px rgba(44,62,80,0.18),0 1.5px 6px rgba(44,62,80,0.10);padding:32px 32px 24px 32px;">
                    <h2 style="margin-top:0;margin-bottom:20px;font-size:1.2em;font-weight:700;color:#222;">Forward Document</h2>
                    <div style="margin-bottom: 16px;line-height:1.7;">
                        <strong>Code:</strong> ${doc.document_code || '-'}<br>
                        <strong>Title:</strong> ${doc.title || '-'}<br>
                        <strong>Type:</strong> ${doc.type_id?.type_name || '-'}<br>
                    </div>
                    <div style="margin-bottom:18px;">
                        <label for="forward-office-select"><strong>Forward to Office(s):</strong></label>
                        <select id="forward-office-select" multiple size="6" style="margin-top:8px;width:100%;padding:7px 12px;border-radius:6px;border:1px solid #ddd;">
                            ${officeOptions.map(o => `<option value="${o._id}">${o.office_name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-top:-8px;margin-bottom:14px;font-size:0.85em;color:#666;">
                        Hold Ctrl/Cmd to select multiple offices.
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;">
                        <button id="cancel-forward-btn" class="btn-cancel" style="background:#f1f5f9;color:#222;">Cancel</button>
                        <button id="confirm-forward-btn" class="btn-logout" style="background:#27ae60;color:white;">Forward</button>
                    </div>
                    <div id="forward-status-msg" style="margin-top:10px;color:#e74c3c;"></div>
                </div>
            `;
            forwardModal.style.display = 'flex';
            const officeSelect = forwardModal.querySelector('#forward-office-select');
            const statusMsg = forwardModal.querySelector('#forward-status-msg');
            const confirmBtn = forwardModal.querySelector('#confirm-forward-btn');
            confirmBtn.disabled = true;
            officeSelect.addEventListener('change', function () {
                const selectedOfficeIds = Array.from(officeSelect?.selectedOptions || [])
                    .map((option) => String(option.value || '').trim())
                    .filter(Boolean);
                confirmBtn.disabled = selectedOfficeIds.length === 0;
            });
            forwardModal.querySelector('#cancel-forward-btn').onclick = () => forwardModal.style.display = 'none';
            confirmBtn.onclick = async function () {
                const selectedOfficeIds = Array.from(officeSelect?.selectedOptions || [])
                    .map((option) => String(option.value || '').trim())
                    .filter(Boolean);
                if (!selectedOfficeIds.length) return;
                const remarks = await openActionRemarksModal({
                    title: 'Confirm Forward',
                    promptText: `Forward this document to ${selectedOfficeIds.length} selected office(s)?`,
                    confirmLabel: 'Forward',
                    remarksRequired: false
                });
                if (remarks === null) return;
                confirmBtn.disabled = true;
                statusMsg.textContent = 'Forwarding...';
                try {
                    const user = JSON.parse(localStorage.getItem('loggedInUser'));
                    const myUserId = user._id;
                    const myOfficeId = user.office_id?._id || user.office_id;
                    const res = await fetch(`${getApiBase()}/documents/${doc._id}/action`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'forward',
                            acting_office_id: myOfficeId,
                            to_office_id: selectedOfficeIds[0],
                            to_office_ids: selectedOfficeIds,
                            user_id: myUserId,
                            remarks
                        })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || 'Failed to forward document');
                    statusMsg.style.color = '#27ae60';
                    statusMsg.textContent = 'Document forwarded successfully!';
                    await fetchAndRenderReceivedDocs();
                    await fetchAndRenderIncomingDocs();
                    await fetchAndRenderOutgoingDocs();
                    setTimeout(() => { forwardModal.style.display = 'none'; }, 800);
                } catch (err) {
                    statusMsg.style.color = '#e74c3c';
                    statusMsg.textContent = 'Error: ' + err.message;
                    confirmBtn.disabled = false;
                }
            };
            forwardModal.onclick = function (e) {
                if (e.target === forwardModal) forwardModal.style.display = 'none';
            };
        }

        async function openCompleteModal(index) {
            const doc = window.receivedDocs[index];
            if (!doc) return;

            completeModal.innerHTML = `
                <div class="modal-content" style="max-width:420px;width:96%;border-radius:16px;box-shadow:0 8px 32px rgba(44,62,80,0.18),0 1.5px 6px rgba(44,62,80,0.10);padding:32px 32px 24px 32px;">
                    <h2 style="margin-top:0;margin-bottom:20px;font-size:1.2em;font-weight:700;color:#222;">Mark as Completed</h2>
                    <div style="margin-bottom: 16px;line-height:1.7;">
                        <strong>Code:</strong> ${doc.document_code || '-'}<br>
                        <strong>Title:</strong> ${doc.title || '-'}<br>
                        <strong>Type:</strong> ${doc.type_id?.type_name || '-'}<br>
                        <strong>Status:</strong> ${doc.status || '-'}
                    </div>
                    <div style="margin-bottom:18px;">
                        <label for="complete-remarks"><strong>Completion Remarks (optional):</strong></label><br>
                        <textarea id="complete-remarks" style="width:100%;min-height:70px;border-radius:6px;border:1px solid #ddd;padding:7px;"></textarea>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;">
                        <button id="cancel-complete-btn" class="btn-cancel" style="background:#f1f5f9;color:#222;">Cancel</button>
                        <button id="confirm-complete-btn" class="btn-logout" style="background:#2563eb;color:white;">Confirm Completion</button>
                    </div>
                    <div id="complete-status-msg" style="margin-top:10px;color:#e74c3c;"></div>
                </div>
            `;

            completeModal.style.display = 'flex';
            const remarksInput = completeModal.querySelector('#complete-remarks');
            const statusMsg = completeModal.querySelector('#complete-status-msg');
            const confirmBtn = completeModal.querySelector('#confirm-complete-btn');
            const cancelBtn = completeModal.querySelector('#cancel-complete-btn');

            cancelBtn.onclick = () => { completeModal.style.display = 'none'; };
            completeModal.onclick = function (e) {
                if (e.target === completeModal) completeModal.style.display = 'none';
            };

            confirmBtn.onclick = async function () {
                const user = JSON.parse(localStorage.getItem('loggedInUser'));
                const myOfficeId = user?.office_id?._id || user?.office_id;
                const myUserId = user?._id;
                if (!myOfficeId || !myUserId) {
                    statusMsg.textContent = 'Unable to determine current user/office.';
                    return;
                }
                if (typeof actionInFlightByDoc !== 'undefined' && actionInFlightByDoc.has(doc._id)) return;
                const completionRemarks = String(remarksInput.value || '').trim();
                const confirmationRemarks = await openActionRemarksModal({
                    title: 'Confirm Completion',
                    promptText: 'Are you sure you want to mark this document as COMPLETED?',
                    confirmLabel: 'Mark as Completed',
                    remarksRequired: false,
                    initialRemarks: completionRemarks
                });
                if (confirmationRemarks === null) return;
                if (typeof actionInFlightByDoc !== 'undefined') actionInFlightByDoc.add(doc._id);
                confirmBtn.disabled = true;
                statusMsg.style.color = '#374151';
                statusMsg.textContent = 'Completing document...';

                try {
                    const res = await fetch(`${getApiBase()}/documents/${doc._id}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            office_id: myOfficeId,
                            user_id: myUserId,
                            remarks: confirmationRemarks
                        })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || 'Failed to complete document');

                    statusMsg.style.color = '#15803d';
                    statusMsg.textContent = result.message || 'Document completed successfully.';
                    await fetchAndRenderReceivedDocs();
                    await fetchAndRenderIncomingDocs();
                    await fetchAndRenderOutgoingDocs();
                    await fetchAndRenderCompleteDocs();
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                    if (window.updateSummaryCards) window.updateSummaryCards();
                    if (window.updateDashboardCounts) window.updateDashboardCounts();

                    const completeLink = document.querySelector('.nav-link[data-section="complete"]');
                    const completeSection = document.getElementById('complete-section');
                    if (completeSection && completeLink) {
                        showSection(completeSection, completeLink, 'Complete Documents');
                    }
                    setTimeout(() => { completeModal.style.display = 'none'; }, 700);
                } catch (err) {
                    statusMsg.style.color = '#dc2626';
                    statusMsg.textContent = 'Error: ' + err.message;
                    confirmBtn.disabled = false;
                } finally {
                    if (typeof actionInFlightByDoc !== 'undefined') actionInFlightByDoc.delete(doc._id);
                }
            };
        }

        async function returnReceivedDocument(index) {
            const doc = window.receivedDocs[index];
            if (!doc) return;
            const docId = doc._id || doc.id;
            if (!docId || actionInFlightByDoc.has(docId)) return;

            const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            const myOfficeId = user?.office_id?._id || user?.office_id;
            const myUserId = user?._id;
            if (!myOfficeId || !myUserId) {
                alert('Unable to determine current user/office.');
                return;
            }

            const remarks = await openActionRemarksModal({
                title: 'Return Document',
                promptText: 'Are you sure you want to RETURN this document to the previous office?',
                confirmLabel: 'Return',
                remarksRequired: true,
                requiredMessage: 'Return remarks are required.'
            });
            if (remarks === null) return;

            actionInFlightByDoc.add(docId);
            try {
                const res = await fetch(`${getApiBase()}/documents/${docId}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'return',
                        office_id: myOfficeId,
                        user_id: myUserId,
                        remarks
                    })
                });
                const payload = await res.json();
                if (!res.ok) throw new Error(payload.error || 'Failed to return document');
                alert('Document RETURNED.');
                await refreshCoreDocumentSections();
            } catch (err) {
                alert('Error: ' + err.message);
            } finally {
                actionInFlightByDoc.delete(docId);
            }
        }

        async function openReceivedAttachmentEditModal(index) {
            const doc = window.receivedDocs[index];
            if (!doc) return;
            const docId = String(doc._id || doc.id || '').trim();
            if (!docId) return;

            let existingAttachments = [];
            try {
                existingAttachments = await fetchDocumentAttachments(docId);
            } catch (err) {
                existingAttachments = [];
            }

            const existingAttachmentItems = existingAttachments.length
                ? existingAttachments.map((att) => `
                    <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <input type="checkbox" class="received-edit-remove-attachment" value="${escapeHtml(String(att.id || ''))}">
                        <span>${escapeHtml(att.name || 'Attachment')}</span>
                    </label>
                `).join('')
                : '<div style="color:#666;font-size:0.9em;">No current attachments found.</div>';

            receivedEditAttachmentsModal.innerHTML = `
                <div class="modal-content" style="max-width:560px;width:96%;">
                    <h3 style="margin-top:0;">Edit Received Attachments</h3>
                    <div style="margin-bottom:12px;line-height:1.6;">
                        <strong>Document:</strong> ${escapeHtml(doc.document_code || '-')} - ${escapeHtml(doc.title || '-')}
                    </div>
                    <form id="received-edit-attachments-form">
                        <label><strong>Current Attachments</strong></label>
                        <div style="max-height:140px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:10px;">
                            ${existingAttachmentItems}
                        </div>
                        <div style="margin-top:-6px;margin-bottom:10px;font-size:0.85em;color:#666;">
                            Check files you want to remove.
                        </div>
                        <label><strong>Add / Replace Attachments</strong></label>
                        <input id="received-edit-attachments-input" type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg" style="width:100%;margin-bottom:10px;">
                        <label><strong>Remarks (optional)</strong></label>
                        <textarea id="received-edit-attachments-remarks" style="width:100%;min-height:70px;margin-bottom:12px;" placeholder="Reason for attachment update..."></textarea>
                        <div style="display:flex;justify-content:flex-end;gap:10px;">
                            <button type="button" class="btn-cancel" id="cancel-received-edit-attachments-btn">Cancel</button>
                            <button type="submit" class="btn-logout">Save Attachments</button>
                        </div>
                    </form>
                </div>
            `;
            receivedEditAttachmentsModal.style.display = 'flex';
            receivedEditAttachmentsModal.querySelector('#cancel-received-edit-attachments-btn').onclick = () => {
                receivedEditAttachmentsModal.style.display = 'none';
            };
            receivedEditAttachmentsModal.onclick = (e) => {
                if (e.target === receivedEditAttachmentsModal) receivedEditAttachmentsModal.style.display = 'none';
            };

            const form = receivedEditAttachmentsModal.querySelector('#received-edit-attachments-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const parseJsonOrThrow = async (response, contextLabel) => {
                    const contentType = String(response.headers.get('content-type') || '');
                    const raw = await response.text();
                    if (!raw) return {};
                    try {
                        return JSON.parse(raw);
                    } catch (err) {
                        throw new Error(`${contextLabel} returned non-JSON (status ${response.status}, content-type ${contentType || 'unknown'})`);
                    }
                };
                const files = Array.from(receivedEditAttachmentsModal.querySelector('#received-edit-attachments-input')?.files || []);
                const remarks = String(receivedEditAttachmentsModal.querySelector('#received-edit-attachments-remarks')?.value || '').trim();
                const removeAttachmentIds = Array.from(receivedEditAttachmentsModal.querySelectorAll('.received-edit-remove-attachment:checked'))
                    .map((input) => String(input.value || '').trim())
                    .filter(Boolean);
                if (!removeAttachmentIds.length && !files.length) {
                    alert('Select attachments to remove or add at least one file.');
                    return;
                }
                const nextAttachmentCount = existingAttachments.length - removeAttachmentIds.length + files.length;
                if (nextAttachmentCount < ATTACHMENT_LIMITS.MIN_FILES) {
                    alert(`Please keep at least ${ATTACHMENT_LIMITS.MIN_FILES} attachment.`);
                    return;
                }
                if (nextAttachmentCount > ATTACHMENT_LIMITS.MAX_FILES) {
                    alert(`You can attach up to ${ATTACHMENT_LIMITS.MAX_FILES} files only.`);
                    return;
                }
                const attachmentValidationError = validateAttachmentSelection(files, { required: false });
                if (attachmentValidationError) {
                    alert(attachmentValidationError);
                    return;
                }
                const confirmedRemarks = await openActionRemarksModal({
                    title: 'Confirm Attachment Update',
                    promptText: 'Apply these attachment changes to the received document?',
                    confirmLabel: 'Save Attachments',
                    remarksRequired: false,
                    initialRemarks: remarks
                });
                if (confirmedRemarks === null) {
                    return;
                }
                try {
                    const formData = new FormData();
                    formData.append('remove_attachment_ids', JSON.stringify(removeAttachmentIds));
                    formData.append('remarks', confirmedRemarks);
                    files.forEach((file) => formData.append('files[]', file));
                    const receivedAttachmentsUrl = `${getApiBase()}/documents/${docId}/received-attachments`;
                    const updateRes = await fetch(receivedAttachmentsUrl, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: formData
                    });
                    const updatePayload = await parseJsonOrThrow(updateRes, 'Received attachment update');
                    if (!updateRes.ok) throw new Error(updatePayload.error || 'Failed to update received attachments');
                    attachmentMetaCacheByDocId.delete(String(docId));
                    receivedEditAttachmentsModal.style.display = 'none';
                    await fetchAndRenderReceivedDocs();
                    await fetchAndRenderIncomingDocs();
                    await fetchAndRenderOutgoingDocs();
                    alert('Received document attachments updated successfully.');
                } catch (err) {
                    alert(`Failed to update received attachments: ${err.message}`);
                }
            };
        }

        // Optionally, keep the old openReceivedModal for details
        window.openReceivedModal = async function openReceivedModal(index) {
            const doc = window.receivedDocs[index];
            if (!doc) return;
            let receivedModal = document.getElementById('received-action-modal');
            if (!receivedModal) {
                receivedModal = document.createElement('div');
                receivedModal.id = 'received-action-modal';
                receivedModal.className = 'modal';
                receivedModal.style.display = 'none';
                document.body.appendChild(receivedModal);
            }

            // Fetch Attachments
            let attachmentsHtml = '<div style="color:#888;font-size:0.9em;">Loading attachments...</div>';
            receivedModal.innerHTML = `
                <div class="modal-content" style="max-width:420px;width:96%;border-radius:16px;box-shadow:0 8px 32px rgba(44,62,80,0.18),0 1.5px 6px rgba(44,62,80,0.10);padding:32px 32px 24px 32px;">
                    <h2 style="margin-top:0;margin-bottom:20px;font-size:1.2em;font-weight:700;color:#222;">Document Details</h2>
                    <div style="margin-bottom: 16px;line-height:1.7;">
                        <strong>Code:</strong> ${doc.document_code || '-'}<br>
                        <strong>Requisitioner:</strong> ${doc.requisitioner || '-'}<br>
                        <strong>Title:</strong> ${doc.title || '-'}<br>
                        <strong>Type:</strong> ${doc.type_id?.type_name || '-'}<br>
                        <strong>Content:</strong> ${doc.content || '-'}<br>
                        <strong>Status:</strong> ${doc.status || '-'}<br>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Attachments:</strong>
                        <div id="modal-attachments-list" style="margin-top: 8px; border: 1px solid #eee; padding: 8px; border-radius: 6px; background: #fafafa;">
                            ${attachmentsHtml}
                        </div>
                    </div>
                    <button id="close-received-modal" class="btn-cancel" style="margin-top:10px;background:#f1f5f9;color:#222;">Close</button>
                </div>
            `;
            receivedModal.style.display = 'flex';
            receivedModal.querySelector('#close-received-modal').onclick = () => receivedModal.style.display = 'none';
            receivedModal.onclick = function (e) {
                if (e.target === receivedModal) receivedModal.style.display = 'none';
            };

            let atts = [];
            // Process Attachments Request
            try {
                const docId = doc._id;
                const res = await fetch(`${getApiBase()}/documents/${docId}/attachments`, { headers: getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    atts = (data.attachments || []).map(normalizeAttachmentUrls);
                } else {
                    throw new Error('API attachments failed');
                }
            } catch (err) {
                // Fallback
                const fallbackStorage = JSON.parse(localStorage.getItem('documentAttachments') || '{}');
                atts = fallbackStorage[doc._id] || [];
            }

            const attListDiv = receivedModal.querySelector('#modal-attachments-list');
            if (atts.length > 0) {
                attListDiv.innerHTML = atts.map(a => {
                    const sizeKb = Math.round(a.size / 1024);
                    const date = a.uploadedAt ? new Date(a.uploadedAt).toLocaleString() : '-';
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #eee;">
                        <div>
                            <div style="font-weight:500;font-size:0.95em;">${a.name}</div>
                            <div style="font-size:0.8em;color:#666;">${sizeKb} KB - ${date}</div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button type="button" class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}" style="padding:4px 8px;font-size:0.85em;">👁 Preview</button>
                            <a href="${a.downloadUrl || a.url}" target="_blank" rel="noopener noreferrer" style="background:#2563eb; color:white; padding:4px 10px; border-radius:4px; text-decoration:none; font-size:0.85em;">Download</a>
                        </div>
                    </div>`;
                }).join('');
            } else {
                attListDiv.innerHTML = '<div style="color:#888;font-size:0.9em;">No attachments found.</div>';
            }
        };
    })();

    // --- OUTGOING NEW DOCUMENT MODAL LOGIC ---
    (function () {
        const typeCodeMap = {
            "Memo": "MEMO",
            "Endorsement": "ENDS",
            "Communication Letter": "COMM",
        };
        const outgoingNewDocBtn = document.getElementById('outgoing-new-doc-btn');
        const outgoingNewDocModal = document.getElementById('outgoingNewDocModal');
        const outgoingNewDocForm = document.getElementById('outgoingNewDocForm');
        const outgoingNewDocCancel = document.getElementById('outgoingNewDocCancel');
        const outgoingAttachmentInput = document.getElementById('outgoingAttachment');
        const outgoingSelectedAttachmentsWrap = document.getElementById('outgoingSelectedAttachmentsWrap');
        const outgoingSelectedAttachmentsList = document.getElementById('outgoingSelectedAttachmentsList');
        const outgoingContainer = document.getElementById('outgoing-container');
        const outgoingSearchInput = document.getElementById('outgoing-search-input');
        const outgoingEntriesSelect = document.getElementById('outgoing-show-entries');
        const outgoingSection = document.getElementById('outgoing-section');
        let pendingOutgoingAttachments = [];

        // Store outgoing docs in memory
        window.outgoingDocs = window.outgoingDocs || [];
        window.outgoingDocsTotal = Number.isFinite(window.outgoingDocsTotal) ? window.outgoingDocsTotal : 0;

        // Helper to generate code ([TYPE]-CSIT-YYYY-MM-XXXX)
        function generateDocCode(type) {
            const typePrefix = typeCodeMap[type] || "DOC";
            const officePrefix = "CSIT"; // Or dynamically get current office
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const count = window.outgoingDocs.length + 1;
            return typePrefix + '-' + officePrefix + '-' + year + '-' + month + '-' + count;
        }

        function getOutgoingSortTimestamp(doc) {
            const created = new Date(doc?.created_at || 0).getTime();
            if (Number.isFinite(created) && created > 0) return created;
            const updated = new Date(doc?.updated_at || 0).getTime();
            if (Number.isFinite(updated) && updated > 0) return updated;
            return 0;
        }

        function renderPendingOutgoingAttachments() {
            if (!outgoingSelectedAttachmentsWrap || !outgoingSelectedAttachmentsList) return;
            if (!pendingOutgoingAttachments.length) {
                outgoingSelectedAttachmentsWrap.style.display = 'none';
                outgoingSelectedAttachmentsList.innerHTML = '';
                return;
            }
            outgoingSelectedAttachmentsWrap.style.display = 'block';
            outgoingSelectedAttachmentsList.innerHTML = pendingOutgoingAttachments.map((file, idx) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
                    <div style="min-width:0;flex:1;">
                        <div style="font-size:0.9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(file?.name || 'Attachment')}</div>
                        <div style="font-size:0.8em;color:#666;">${escapeHtml(formatAttachmentSize(file?.size || 0))}</div>
                    </div>
                    <button type="button" class="outgoing-remove-pending-attachment" data-index="${idx}"
                        style="background:#fff;color:#e74c3c;border:1px solid #e74c3c;border-radius:6px;padding:2px 8px;cursor:pointer;">Remove</button>
                </div>
            `).join('');
            outgoingSelectedAttachmentsList.querySelectorAll('.outgoing-remove-pending-attachment').forEach((btn) => {
                btn.onclick = () => {
                    const idx = Number(btn.getAttribute('data-index'));
                    if (!Number.isInteger(idx) || idx < 0 || idx >= pendingOutgoingAttachments.length) return;
                    pendingOutgoingAttachments.splice(idx, 1);
                    renderPendingOutgoingAttachments();
                };
            });
        }

        function resetPendingOutgoingAttachments() {
            pendingOutgoingAttachments = [];
            if (outgoingAttachmentInput) outgoingAttachmentInput.value = '';
            renderPendingOutgoingAttachments();
        }

        function appendPendingOutgoingAttachments(newFiles) {
            const incomingFiles = Array.isArray(newFiles) ? newFiles : [];
            if (!incomingFiles.length) return;
            const mergedFiles = pendingOutgoingAttachments.concat(incomingFiles);
            const attachmentValidationError = validateAttachmentSelection(mergedFiles, { required: false });
            if (attachmentValidationError) {
                alert(attachmentValidationError);
                if (outgoingAttachmentInput) outgoingAttachmentInput.value = '';
                return;
            }
            pendingOutgoingAttachments = mergedFiles;
            if (outgoingAttachmentInput) outgoingAttachmentInput.value = '';
            renderPendingOutgoingAttachments();
        }

        function getOutgoingDocsForOffice() {
            if (!Array.isArray(window.outgoingDocs)) return [];
            return window.outgoingDocs;
        }

        function getFilteredSortedOutgoingDocs() {
            const searchTerm = String(outgoingSearchInput?.value || '').trim().toLowerCase();
            const docs = getOutgoingDocsForOffice()
                .slice()
                .sort((a, b) => getOutgoingSortTimestamp(b) - getOutgoingSortTimestamp(a));

            if (!searchTerm) return docs;
            return docs.filter(doc => {
                const searchable = [
                    doc.document_code,
                    doc.type_id?.type_name,
                    doc.title,
                    doc.destination_label,
                    doc.current_office_id?.office_name,
                    doc.status
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return searchable.includes(searchTerm);
            });
        }

        function updateOutgoingPaginationInfo(visibleCount, totalCount) {
            const paginationInfo = outgoingSection?.querySelector('.pagination-info');
            if (!paginationInfo) return;
            if (totalCount === 0 || visibleCount === 0) {
                paginationInfo.textContent = 'Showing 0 to 0 of 0 entries';
                return;
            }
            paginationInfo.textContent = `Showing 1 to ${visibleCount} of ${totalCount} entries`;
        }

        function getOutgoingEntriesLimit() {
            const entriesToShow = Number.parseInt(outgoingEntriesSelect?.value, 10);
            return Number.isFinite(entriesToShow) && entriesToShow > 0 ? entriesToShow : 10;
        }

        function formatRecipientStatus(status) {
            const normalized = String(status || '').toUpperCase();
            if (normalized === 'RELEASED') return 'PENDING';
            return normalized || '-';
        }

        function getRecipientStatusRows(doc) {
            const recipients = Array.isArray(doc?.recipients) ? doc.recipients : [];
            if (!recipients.length) return '<tr><td colspan="4">No recipient details found.</td></tr>';
            return recipients.map((recipient) => {
                const officeName = recipient?.recipient_office_id?.office_name || '-';
                const statusLabel = formatRecipientStatus(recipient?.recipient_status);
                const lastAction = recipient?.last_action_at
                    ? new Date(recipient.last_action_at).toLocaleString()
                    : '-';
                const remarks = String(recipient?.latest_remarks || '').trim() || '—';
                return `
                    <tr>
                        <td>${escapeHtml(officeName)}</td>
                        <td><span class="${getStatusPillClass(statusLabel)}">${escapeHtml(statusLabel)}</span></td>
                        <td>${escapeHtml(lastAction)}</td>
                        <td>${escapeHtml(remarks)}</td>
                    </tr>
                `;
            }).join('');
        }

        function openRecipientBreakdownModal(doc) {
            let modal = document.getElementById('outgoing-recipient-breakdown-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'outgoing-recipient-breakdown-modal';
                modal.className = 'modal';
                modal.style.display = 'none';
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="modal-content" style="max-width:820px;width:96%;">
                    <h3 style="margin-top:0;">Recipient Status Breakdown</h3>
                    <div style="margin-bottom:12px;">
                        <strong>Document:</strong> ${escapeHtml(doc?.document_code || '-')} - ${escapeHtml(doc?.title || '-')}
                    </div>
                    <div style="margin-bottom:12px;line-height:1.5;">
                        <strong>Content/Description:</strong> ${escapeHtml(doc?.content || '-')}
                    </div>
                    <div class="table-container">
                        <table class="section-table">
                            <thead>
                                <tr>
                                    <th>Recipient Office</th>
                                    <th>Status</th>
                                    <th>Last Updated</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${getRecipientStatusRows(doc)}
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top:16px;text-align:right;">
                        <button type="button" class="btn-cancel" id="close-recipient-breakdown-modal">Close</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
            modal.querySelector('#close-recipient-breakdown-modal').onclick = () => { modal.style.display = 'none'; };
            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        }

        async function openEditOutgoingModal(doc) {
            const docId = doc?._id || doc?.id;
            if (!docId) return;
            let modal = document.getElementById('outgoing-edit-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'outgoing-edit-modal';
                modal.className = 'modal';
                modal.style.display = 'none';
                document.body.appendChild(modal);
            }
            const typeOptions = (Array.isArray(documentTypes) ? documentTypes : []).map((dt) => {
                const typeId = dt._id || dt.id;
                const selected = String(typeId) === String(doc?.type_id?._id || doc?.type_id?.id || '');
                return `<option value="${escapeHtml(String(typeId || ''))}" ${selected ? 'selected' : ''}>${escapeHtml(dt.type_name || '-')}</option>`;
            }).join('');
            const user = window.loggedInUser || JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            const myOfficeId = String(user?.office_id?._id || user?.office_id || '');
            const currentRecipient = (Array.isArray(doc?.recipients) ? doc.recipients : []).find((recipient) => {
                const officeId = String(recipient?.recipient_office_id?._id || recipient?.recipient_office_id?.id || recipient?.recipient_office_id || '').trim();
                return officeId === myOfficeId;
            });
            const isReturnedEditResend = String(currentRecipient?.recipient_status || '').toUpperCase() === 'RETURNED';
            let availableOffices = [];
            try {
                const officeRes = await fetch(`${getApiBase()}/offices`, { headers: getAuthHeaders() });
                const officePayload = await officeRes.json();
                availableOffices = Array.isArray(officePayload)
                    ? officePayload.filter((office) => {
                        const officeId = String(office?._id || office?.id || '');
                        return officeId && officeId !== myOfficeId && office.is_active !== false;
                    })
                    : [];
            } catch (err) {
                availableOffices = [];
            }
            const currentDestinationIds = new Set(
                (Array.isArray(doc?.recipients) ? doc.recipients : [])
                    .map((recipient) => {
                        const office = recipient?.recipient_office_id || {};
                        const officeId = String(office?._id || office?.id || office || '').trim();
                        const status = String(recipient?.recipient_status || '').toUpperCase();
                        if (!officeId || officeId === myOfficeId) return '';
                        if (status === 'DECLINED' || status === 'COMPLETED' || status === 'FORWARDED') return '';
                        return officeId;
                    })
                    .filter(Boolean)
            );
            if (isReturnedEditResend) {
                currentDestinationIds.clear();
                (Array.isArray(doc?.recipients) ? doc.recipients : []).forEach((recipient) => {
                    const office = recipient?.recipient_office_id || {};
                    const officeId = String(office?._id || office?.id || office || '').trim();
                    const status = String(recipient?.recipient_status || '').toUpperCase();
                    if (!officeId || officeId === myOfficeId) return;
                    if (status === 'DECLINED' || status === 'RETURNED') {
                        currentDestinationIds.add(officeId);
                    }
                });
                const history = Array.isArray(doc?.status_history) ? doc.status_history : [];
                const latestReturnToMe = [...history].reverse().find((entry) => {
                    const statusText = String(entry?.status || '').toUpperCase();
                    if (!statusText.includes('RETURNED TO')) return false;
                    const toOfficeId = String(entry?.to_office_id?._id || entry?.to_office_id?.id || entry?.to_office_id || '').trim();
                    return Boolean(toOfficeId) && toOfficeId === myOfficeId;
                });
                const lastReturningOfficeId = String(
                    latestReturnToMe?.from_office_id?._id ||
                    latestReturnToMe?.from_office_id?.id ||
                    latestReturnToMe?.from_office_id ||
                    ''
                ).trim();
                if (lastReturningOfficeId && lastReturningOfficeId !== myOfficeId) {
                    currentDestinationIds.add(lastReturningOfficeId);
                }
            }
            const officeOptions = availableOffices.map((office) => {
                const officeId = String(office._id || office.id || '');
                const selected = currentDestinationIds.has(officeId) ? 'selected' : '';
                return `<option value="${escapeHtml(officeId)}" ${selected}>${escapeHtml(office.office_name || '-')}</option>`;
            }).join('');
            let existingAttachments = [];
            try {
                existingAttachments = await fetchDocumentAttachments(docId);
            } catch (err) {
                existingAttachments = [];
            }
            const existingAttachmentItems = existingAttachments.length
                ? existingAttachments.map((att) => `
                    <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <input type="checkbox" class="outgoing-edit-remove-attachment" value="${escapeHtml(String(att.id || ''))}">
                        <span>${escapeHtml(att.name || 'Attachment')}</span>
                    </label>
                `).join('')
                : '<div style="color:#666;font-size:0.9em;">No current attachments found.</div>';

            modal.innerHTML = `
                <div class="modal-content" style="max-width:600px;width:96%;">
                    <h3 style="margin-top:0;">Edit Outgoing Document</h3>
                    <form id="outgoing-edit-form">
                        <label><strong>Title</strong></label>
                        <input id="outgoing-edit-title" type="text" value="${escapeHtml(doc?.title || '')}" required style="width:100%;margin-bottom:10px;">
                        <label><strong>Type</strong></label>
                        <select id="outgoing-edit-type" required style="width:100%;margin-bottom:10px;">
                            <option value="">-- Select Type --</option>
                            ${typeOptions}
                        </select>
                        <label><strong>Content</strong></label>
                        <textarea id="outgoing-edit-content" style="width:100%;min-height:100px;margin-bottom:10px;">${escapeHtml(doc?.content || '')}</textarea>
                        <label><strong>Forward to Office(s)</strong></label>
                        <select id="outgoing-edit-offices" multiple size="5" style="width:100%;margin-bottom:10px;">
                            ${officeOptions}
                        </select>
                        <div style="margin-top:-6px;margin-bottom:10px;font-size:0.85em;color:#666;">
                            Hold Ctrl/Cmd to select multiple offices.
                        </div>
                        <label><strong>Current Attachments</strong></label>
                        <div style="max-height:140px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:10px;">
                            ${existingAttachmentItems}
                        </div>
                        <div style="margin-top:-6px;margin-bottom:10px;font-size:0.85em;color:#666;">
                            Check files you want to remove.
                        </div>
                        <label><strong>Add / Replace Attachments</strong></label>
                        <input id="outgoing-edit-attachments" type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg" style="width:100%;margin-bottom:10px;">
                        <label><strong>Remarks (optional)</strong></label>
                        <textarea id="outgoing-edit-remarks" style="width:100%;min-height:70px;margin-bottom:12px;" placeholder="Reason for edit..."></textarea>
                        <div style="display:flex;justify-content:flex-end;gap:10px;">
                            <button type="button" class="btn-cancel" id="cancel-outgoing-edit-btn">Cancel</button>
                            <button type="submit" class="btn-logout">Save Changes</button>
                        </div>
                    </form>
                </div>
            `;
            modal.style.display = 'flex';
            modal.querySelector('#cancel-outgoing-edit-btn').onclick = () => { modal.style.display = 'none'; };
            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
            const form = modal.querySelector('#outgoing-edit-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const parseJsonOrThrow = async (response, contextLabel) => {
                    const contentType = String(response.headers.get('content-type') || '');
                    const raw = await response.text();
                    if (!raw) return {};
                    try {
                        return JSON.parse(raw);
                    } catch (err) {
                        throw new Error(`${contextLabel} returned non-JSON (status ${response.status}, content-type ${contentType || 'unknown'})`);
                    }
                };
                const title = String(modal.querySelector('#outgoing-edit-title')?.value || '').trim();
                const content = String(modal.querySelector('#outgoing-edit-content')?.value || '').trim();
                const type_id = String(modal.querySelector('#outgoing-edit-type')?.value || '').trim();
                const remarks = String(modal.querySelector('#outgoing-edit-remarks')?.value || '').trim();
                const selectedOfficeIds = Array.from(modal.querySelector('#outgoing-edit-offices')?.selectedOptions || [])
                    .map((option) => String(option.value || '').trim())
                    .filter(Boolean);
                const uniqueSelectedOfficeIds = Array.from(new Set(selectedOfficeIds));
                const files = Array.from(modal.querySelector('#outgoing-edit-attachments')?.files || []);
                const removeAttachmentIds = Array.from(modal.querySelectorAll('.outgoing-edit-remove-attachment:checked'))
                    .map((input) => String(input.value || '').trim())
                    .filter(Boolean);
                if (!title || !type_id) {
                    alert('Title and type are required.');
                    return;
                }
                if (isReturnedEditResend && uniqueSelectedOfficeIds.length === 0) {
                    alert('Select at least one destination office to resend this returned document.');
                    return;
                }
                const nextAttachmentCount = existingAttachments.length - removeAttachmentIds.length + files.length;
                if (nextAttachmentCount < ATTACHMENT_LIMITS.MIN_FILES) {
                    alert(`Please keep at least ${ATTACHMENT_LIMITS.MIN_FILES} attachment.`);
                    return;
                }
                if (nextAttachmentCount > ATTACHMENT_LIMITS.MAX_FILES) {
                    alert(`You can attach up to ${ATTACHMENT_LIMITS.MAX_FILES} files only.`);
                    return;
                }
                const attachmentValidationError = validateAttachmentSelection(files, { required: false });
                if (attachmentValidationError) {
                    alert(attachmentValidationError);
                    return;
                }

                try {
                    const updateUrl = `${getApiBase()}/documents/${docId}`;
                    const authHeaders = getAuthHeaders();
                    const updateRes = await fetch(updateUrl, {
                        method: 'PUT',
                        headers: {
                            ...authHeaders,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            title,
                            content,
                            type_id,
                            remarks,
                            forward_to_office_ids: uniqueSelectedOfficeIds
                        })
                    });
                    const updatePayload = await parseJsonOrThrow(updateRes, 'Document update');
                    if (!updateRes.ok) throw new Error(updatePayload.error || 'Failed to update document');

                    if (removeAttachmentIds.length) {
                        for (const attachmentId of removeAttachmentIds) {
                            const removeUrl = `${getApiBase()}/documents/${docId}/attachments/${attachmentId}`;
                            const removeRes = await fetch(removeUrl, {
                                method: 'DELETE',
                                headers: getAuthHeaders()
                            });
                            const removePayload = await parseJsonOrThrow(removeRes, 'Attachment removal');
                            if (!removeRes.ok) throw new Error(removePayload.error || 'Failed to remove selected attachment');
                        }
                    }

                    if (files.length) {
                        const formData = new FormData();
                        files.forEach((file) => formData.append('files[]', file));
                        if (removeAttachmentIds.length) {
                            const replacedAttachments = existingAttachments
                                .filter((att) => removeAttachmentIds.includes(String(att?.id || '')))
                                .map((att) => ({
                                    id: String(att?.id || ''),
                                    name: String(att?.name || 'Attachment')
                                }));
                            formData.append('replaced_attachments', JSON.stringify(replacedAttachments));
                        }
                        const uploadUrl = `${getApiBase()}/documents/${docId}/attachments`;
                        const uploadRes = await fetch(uploadUrl, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: formData
                        });
                        const uploadPayload = await parseJsonOrThrow(uploadRes, 'Attachment upload');
                        if (!uploadRes.ok) throw new Error(uploadPayload.error || 'Document updated but attachment upload failed');
                    }

                    attachmentMetaCacheByDocId.delete(String(docId));
                    modal.style.display = 'none';
                    await refreshCoreDocumentSections();
                    alert(isReturnedEditResend ? 'Returned document updated and resent successfully.' : 'Outgoing document updated successfully.');
                } catch (err) {
                    alert(`Failed to update outgoing document: ${err.message}`);
                }
            };
        }
        window.openEditOutgoingModal = openEditOutgoingModal;

        // Render outgoing table rows
        function renderOutgoingCards() {
            if (!outgoingContainer) return;
            const outgoingTableBody = document.getElementById('outgoing-table-body');
            if (!outgoingTableBody) return;

            const filteredDocs = getFilteredSortedOutgoingDocs();
            const visibleDocs = filteredDocs.slice(0, getOutgoingEntriesLimit());

            if (visibleDocs.length === 0) {
                outgoingTableBody.innerHTML = '<tr><td colspan="7" class="outgoing-empty-row">No outgoing documents found.</td></tr>';
                updateOutgoingPaginationInfo(0, 0);
            } else {
                outgoingTableBody.innerHTML = visibleDocs.map(doc => {
                    const docId = doc._id || doc.id;
                    const releasedDate = doc.created_at || doc.updated_at;
                    const destinationLabel = doc.destination_label || doc.current_office_id?.office_name || '-';
                    return `
                    <tr>
                        <td>${escapeHtml(doc.document_code || '-')}</td>
                        <td>${escapeHtml(doc.type_id?.type_name || '-')}</td>
                        <td>${escapeHtml(doc.title || '-')}</td>
                        <td>${escapeHtml(destinationLabel)}</td>
                        <td><span class="${getStatusPillClass(doc.status)}">${escapeHtml(formatStatusForDisplay(doc.status))}</span></td>
                        <td>${releasedDate ? new Date(releasedDate).toLocaleString() : '-'}</td>
                        <td>
                            <button type="button" class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(docId || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</button>
                            <button type="button" class="action-btn outgoing-details-btn" data-docid="${escapeHtml(docId || '')}">Details</button>
                            ${doc.can_edit ? `<button type="button" class="action-btn receive-btn edit-outgoing-btn" data-docid="${escapeHtml(docId || '')}">Edit</button>` : ''}
                            <button class="action-btn decline-btn cancel-outgoing-btn" data-docid="${escapeHtml(docId || '')}">Cancel Outgoing</button>
                        </td>
                    </tr>
                `;
                }).join('');
                updateOutgoingPaginationInfo(visibleDocs.length, filteredDocs.length);
            }

            outgoingContainer.querySelectorAll('.outgoing-details-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const docId = btn.getAttribute('data-docid');
                    const doc = (window.outgoingDocs || []).find((item) => String(item._id || item.id) === String(docId));
                    if (!doc) return;
                    openRecipientBreakdownModal(doc);
                });
            });

            outgoingContainer.querySelectorAll('.edit-outgoing-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const docId = btn.getAttribute('data-docid');
                    const doc = (window.outgoingDocs || []).find((item) => String(item._id || item.id) === String(docId));
                    if (!doc) return;
                    await openEditOutgoingModal(doc);
                });
            });

            outgoingContainer.querySelectorAll('.cancel-outgoing-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const docId = btn.getAttribute('data-docid');
                    if (!docId) return;
                    await cancelOutgoingDocument(docId);
                });
            });
        }

        async function cancelOutgoingDocument(docId) {
            const ok = confirm('Cancel this outgoing document? This will remove it from other offices\' incoming queue as well.');
            if (!ok) return;
            try {
                const res = await fetch(`${getApiBase()}/documents/${docId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to cancel outgoing document');

                await fetchAndRenderOutgoingDocs();
                if (window.updateSidebarBadges) window.updateSidebarBadges();
                if (window.updateSummaryCards) window.updateSummaryCards();
                if (window.updateDashboardCounts) window.updateDashboardCounts();
                alert('Outgoing document cancelled successfully.');
            } catch (err) {
                alert('Failed to cancel outgoing document: ' + err.message);
            }
        }

        // Show modal
        if (outgoingNewDocBtn && outgoingNewDocModal) {
            outgoingNewDocBtn.onclick = function () {
                outgoingNewDocModal.style.display = 'flex';
                renderPendingOutgoingAttachments();
            };
        }
        // Hide modal
        if (outgoingNewDocCancel && outgoingNewDocModal) {
            outgoingNewDocCancel.onclick = function () {
                outgoingNewDocModal.style.display = 'none';
                outgoingNewDocForm.reset();
                resetPendingOutgoingAttachments();
            };
        }
        // Hide modal on outside click
        if (outgoingNewDocModal) {
            outgoingNewDocModal.onclick = function (e) {
                if (e.target === outgoingNewDocModal) {
                    outgoingNewDocModal.style.display = 'none';
                    outgoingNewDocForm.reset();
                    resetPendingOutgoingAttachments();
                }
            };
        }
        if (outgoingAttachmentInput) {
            outgoingAttachmentInput.addEventListener('change', function () {
                const newlySelectedFiles = Array.from(outgoingAttachmentInput.files || []);
                appendPendingOutgoingAttachments(newlySelectedFiles);
            });
        }
        // Handle form submit
        if (outgoingNewDocForm) {
            outgoingNewDocForm.onsubmit = async function (e) {
                e.preventDefault();
                const title = document.getElementById('outgoingDocTitle').value.trim();
                const typeName = document.getElementById('outgoingDocType').value;
                const content = document.getElementById('outgoingDocContent').value.trim();
                const officeSelectEl = document.getElementById('outgoingDocOffice');
                const selectedOfficeIds = Array.from(officeSelectEl?.selectedOptions || [])
                    .map(option => String(option.value || '').trim())
                    .filter(Boolean);
                const files = pendingOutgoingAttachments.slice();
                if (!title || !typeName || selectedOfficeIds.length === 0) {
                    alert('Please select at least one destination office.');
                    return;
                }
                const attachmentValidationError = validateAttachmentSelection(files, { required: true });
                if (attachmentValidationError) {
                    alert(attachmentValidationError);
                    return;
                }
                const submitConfirmed = await openActionRemarksModal({
                    title: 'Submit New Outgoing Document',
                    promptText: 'Are you sure you want to submit this document to the selected office(s)?',
                    confirmLabel: 'Submit',
                    hideRemarks: true
                });
                if (submitConfirmed === null) {
                    return;
                }

                // Get logged-in user
                const user = window.loggedInUser || JSON.parse(localStorage.getItem('loggedInUser'));
                let requester_office_id = user.office_id;
                const creatorUserId = user?._id;
                if (requester_office_id && typeof requester_office_id === 'object' && requester_office_id._id) {
                    requester_office_id = requester_office_id._id;
                }
                // Find the type_id for the selected type name
                const selectedType = String(typeName || '').trim().toLowerCase();
                const docType = documentTypes.find(dt => String(dt.type_name || '').trim().toLowerCase() === selectedType);
                if (!docType) {
                    alert('Invalid document type selected.');
                    return;
                }
                const type_id = docType._id;
                // Debug log
                console.log({
                    title,
                    content,
                    type_id,
                    requester_office_id,
                    status: 'RELEASED'
                });
                // Send to backend
                const response = await fetch(`${getOfficesApiBase()}/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title,
                        content,
                        type_id,
                        requester_office_id,
                        created_by_admin_id: creatorUserId || null,
                        status: 'RELEASED',
                        current_office_id: selectedOfficeIds[0],
                        forward_to_office_id: selectedOfficeIds.length === 1 ? selectedOfficeIds[0] : null,
                        forward_to_office_ids: selectedOfficeIds,
                        attachment_count: files.length
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    // Start of File Attachments Feature #6
                    if (files.length > 0) {
                        const docId = result._id || result.document?._id; // Ensure we get the correct _id depending on backend response format
                        if (docId) {
                            const formData = new FormData();
                            files.forEach(file => formData.append('files[]', file));

                            try {
                                const uploadRes = await fetch(`${getApiBase()}/documents/${docId}/attachments`, {
                                    method: 'POST',
                                    headers: getAuthHeaders(),
                                    body: formData
                                });

                                if (!uploadRes.ok) {
                                    throw new Error('Upload API failed');
                                }
                                const uploadData = await uploadRes.json();
                                console.log('Attachments uploaded:', uploadData);
                                alert('Document and attachments successfully added!');
                            } catch (err) {
                                console.warn('API upload failed, using fallback to localStorage.', err);
                                // Fallback to localStorage
                                const attachments = await Promise.all(files.map(async file => {
                                    return new Promise((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onload = e => resolve({
                                            id: 'att_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                                            name: file.name,
                                            size: file.size,
                                            mimeType: file.type,
                                            url: e.target.result,
                                            uploadedAt: new Date().toISOString(),
                                            uploadedBy: user.username || 'Current User'
                                        });
                                        reader.onerror = reject;
                                        reader.readAsDataURL(file);
                                    });
                                }));
                                const fallbackStorage = JSON.parse(localStorage.getItem('documentAttachments') || '{}');
                                fallbackStorage[docId] = (fallbackStorage[docId] || []).concat(attachments);
                                localStorage.setItem('documentAttachments', JSON.stringify(fallbackStorage));
                                alert('Document added (Attachments saved locally as fallback).');
                            }
                        } else {
                            alert('Document created but failed to get document ID for attachments.');
                        }
                    } else {
                        alert('Document successfully added!');
                    }
                    // End of File Attachments Feature #6

                    await fetchAndRenderOutgoingDocs();
                    outgoingNewDocModal.style.display = 'none';
                    outgoingNewDocForm.reset();
                    resetPendingOutgoingAttachments();
                    if (window.updateSidebarBadges) window.updateSidebarBadges();
                    if (window.updateSummaryCards) window.updateSummaryCards();
                } else {
                    alert(result.error || 'Failed to create document');
                }
            };
        }
        // Initial render
        renderOutgoingCards();
        window.renderOutgoingCards = renderOutgoingCards;
    })(); // End Outgoing Form IIFE

    // --- DASHBOARD OVERVIEW CARDS CLICKABLE NAVIGATION ---
    const overviewCardMap = [
        { cardId: 'track-documents-card', sectionId: 'track-section' },
        { cardId: 'incoming-documents-card', sectionId: 'incoming-section' },
        { cardId: 'received-documents-card', sectionId: 'received-section' },
        { cardId: 'outgoing-documents-card', sectionId: 'outgoing-section' }
    ];
    overviewCardMap.forEach(({ cardId, sectionId }) => {
        const card = document.getElementById(cardId);
        const section = document.getElementById(sectionId);
        if (card && section) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                // Hide all content sections
                document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
                // Show the selected section
                section.style.display = 'block';
            });
        }
    });

    // --- DYNAMIC DASHBOARD CARD COUNTS ---
    function updateDashboardCounts() {
        const user = JSON.parse(localStorage.getItem('loggedInUser'));
        const officeId = user?.office_id?._id || user?.office_id;
        const incomingCount = Array.isArray(window.incomingDocs) ? window.incomingDocs.length : 0;
        const receivedCount = Array.isArray(window.receivedDocs) ? window.receivedDocs.length : 0;
        let outgoingCount = Number.isFinite(window.outgoingDocsTotal) ? window.outgoingDocsTotal : 0;
        if (!Number.isFinite(window.outgoingDocsTotal) && Array.isArray(window.outgoingDocs) && officeId) {
            outgoingCount = window.outgoingDocs.filter(
                doc =>
                    String(doc.requester_office_id?._id || doc.requester_office_id) === String(officeId) &&
                    !String(doc.status || '').toUpperCase().includes('COMPLETED')
            ).length;
        }
        const incomingEl = document.getElementById('incoming-docs-count');
        const receivedEl = document.getElementById('received-docs-count');
        const outgoingEl = document.getElementById('outgoing-docs-count');
        if (incomingEl) incomingEl.textContent = incomingCount;
        if (receivedEl) receivedEl.textContent = receivedCount;
        if (outgoingEl) outgoingEl.textContent = outgoingCount;
        // Update sidebar badge for outgoing
        const outgoingBadge = document.querySelector('.nav-link[data-section="outgoing"] .badge');
        if (outgoingBadge) outgoingBadge.textContent = outgoingCount;
    }
    window.updateDashboardCounts = updateDashboardCounts;
    updateDashboardCounts();

    // Call updateDashboardCounts() after any document array change
    // Example: after moving, adding, or removing documents
    // ... existing code ...

    // Example: After rendering cards or changing arrays, call:
    // updateDashboardCounts();

    // Set sidebar/profile office name dynamically after login or show 'Guest'
    const userNameElem = document.querySelector('.user-name');
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('loggedInUser'));
    } catch (e) {
        user = null;
    }
    if (userNameElem) {
        if (user && user.office_id && user.office_id.office_name) {
            userNameElem.textContent = user.office_id.office_name;
        } else {
            userNameElem.textContent = 'Guest';
        }
    }

    let documentTypes = [];

    function findTypeByAliases(aliases) {
        if (!Array.isArray(documentTypes)) return null;
        const aliasSet = aliases.map(a => String(a).trim().toLowerCase());
        return documentTypes.find(dt => aliasSet.includes(String(dt.type_name || '').trim().toLowerCase())) || null;
    }

    function populateTypeDropdowns() {
        const outgoingTypeSelect = document.getElementById('outgoingDocType');
        const newDocTypeSelect = document.getElementById('type');
        if (!Array.isArray(documentTypes) || documentTypes.length === 0) return;

        const canonicalTypeOptions = [
            { label: 'Memo', aliases: ['Memorandum', 'Memo'] },
            { label: 'Endorsement', aliases: ['Endorsement'] },
            { label: 'Communication Letter', aliases: ['Communication Letter'] }
        ];

        const resolvedOptions = canonicalTypeOptions
            .map(item => {
                const match = findTypeByAliases(item.aliases);
                return match ? { label: item.label, value: match.type_name } : null;
            })
            .filter(Boolean);

        if (outgoingTypeSelect) {
            outgoingTypeSelect.innerHTML = '<option value="">-- Select Type --</option>';
            resolvedOptions.forEach(dt => {
                const option = document.createElement('option');
                option.value = dt.value;
                option.textContent = dt.label;
                outgoingTypeSelect.appendChild(option);
            });
        }

        if (newDocTypeSelect) {
            newDocTypeSelect.innerHTML = '<option value="">-- Select Type --</option>';
            resolvedOptions.forEach(dt => {
                const option = document.createElement('option');
                option.value = dt.value;
                option.textContent = dt.label;
                newDocTypeSelect.appendChild(option);
            });
        }
    }

    async function loadDocumentTypes() {
        try {
            const res = await fetch(`${getOfficesApiBase()}/document-types`);
            if (!res.ok) throw new Error('Failed to load document types');
            documentTypes = await res.json();
            populateTypeDropdowns();
        } catch (err) {
            console.error('Error loading document types:', err);
            documentTypes = [];
        }
    }
    window.loadDocumentTypes = loadDocumentTypes;

    loadDocumentTypes();

    async function fetchAndRenderOutgoingDocs() {
        try {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/documents/outgoing`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch outgoing documents');
            const payload = await res.json();
            const items = Array.isArray(payload?.items) ? payload.items : [];
            const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : items.length;
            window.outgoingDocs = items;
            window.outgoingDocsTotal = total;
        } catch (err) {
            console.error('Failed to fetch outgoing documents:', err);
            window.outgoingDocs = [];
            window.outgoingDocsTotal = 0;
        }
        renderOutgoingCards();
        if (window.updateSidebarBadges) window.updateSidebarBadges();
        if (window.updateSummaryCards) window.updateSummaryCards();
        if (window.updateDashboardCounts) window.updateDashboardCounts();
    }

    fetchAndRenderOutgoingDocs();

    // --- INCOMING DOCUMENTS WORKFLOW ---
    const INCOMING_POLL_INTERVAL_MS = 4000;
    let incomingPollHandle = null;
    const actionInFlightByDoc = new Set();

    async function fetchAndRenderIncomingDocs() {
        try {
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            const myOfficeId = user?.office_id?._id || user?.office_id;
            if (!myOfficeId) {
                window.incomingDocs = [];
                renderIncomingCards([]);
                updateIncomingBadge(0);
                if (window.updateDashboardCounts) window.updateDashboardCounts();
                if (window.updateSummaryCards) window.updateSummaryCards();
                if (window.updateSidebarBadges) window.updateSidebarBadges();
                return;
            }

            const incomingUrl = `${getApiBase()}/documents/incoming?office_id=${myOfficeId}`;
            const res = await fetch(incomingUrl, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch incoming documents');
            const incomingDocs = await res.json();
            const normalized = Array.isArray(incomingDocs) ? incomingDocs : [];
            window.incomingDocs = normalized;
            renderIncomingCards(normalized);
            updateIncomingBadge(normalized.length);
            if (window.updateDashboardCounts) window.updateDashboardCounts();
            if (window.updateSummaryCards) window.updateSummaryCards();
            if (window.updateSidebarBadges) window.updateSidebarBadges();
        } catch (err) {
            console.error('Failed to fetch incoming documents:', err);
            window.incomingDocs = [];
            renderIncomingCards([]);
            updateIncomingBadge(0);
            if (window.updateDashboardCounts) window.updateDashboardCounts();
            if (window.updateSummaryCards) window.updateSummaryCards();
            if (window.updateSidebarBadges) window.updateSidebarBadges();
        }
    }

    function getRecipientForCurrentOffice(doc) {
        const myOfficeId = getMyOfficeId();
        if (!myOfficeId) return null;
        const recipients = Array.isArray(doc?.recipients) ? doc.recipients : [];
        return recipients.find((row) => {
            const recipientOfficeId = String(row?.recipient_office_id?._id || row?.recipient_office_id || '');
            return recipientOfficeId === myOfficeId;
        }) || null;
    }

    function hasEditIndicator(doc) {
        const history = Array.isArray(doc?.status_history) ? doc.status_history : [];
        return history.some((item) => String(item?.status || '').toUpperCase().includes('EDITED BY'));
    }

    function getIncomingStatusLabel(doc) {
        const recipient = getRecipientForCurrentOffice(doc);
        if (String(recipient?.recipient_status || '').toUpperCase() === 'RETURNED') {
            return 'RETURNED';
        }
        return formatStatusForDisplay(doc?.status || '-');
    }

    function getIncomingRemarks(doc, latestStatus) {
        const recipient = getRecipientForCurrentOffice(doc);
        const recipientRemarks = String(recipient?.latest_remarks || '').trim();
        if (recipientRemarks) return recipientRemarks;
        return String(latestStatus?.remarks || '').trim() || '—';
    }

    function getIncomingActionButtons(doc, docId) {
        const recipient = getRecipientForCurrentOffice(doc);
        const recipientStatus = String(recipient?.recipient_status || '').toUpperCase();
        if (recipientStatus === 'RETURNED') {
            return `
                <button type="button" class="action-btn receive-btn" data-doc-action="ack_returned" data-doc-id="${escapeHtml(docId)}">Acknowledge / Receive Returned</button>
                <button type="button" class="action-btn receive-btn" data-doc-action="edit_resend" data-doc-id="${escapeHtml(docId)}">Edit &amp; Resend</button>
            `;
        }
        return `
            <button type="button" class="action-btn receive-btn" data-doc-action="receive" data-doc-id="${escapeHtml(docId)}">Receive</button>
            <button type="button" class="action-btn decline-btn" data-doc-action="decline" data-doc-id="${escapeHtml(docId)}">Decline</button>
        `;
    }

    async function refreshCoreDocumentSections() {
        await fetchAndRenderIncomingDocs();
        await fetchAndRenderReceivedDocs();
        await fetchAndRenderOutgoingDocs();
        if (window.updateSidebarBadges) window.updateSidebarBadges();
        if (window.updateSummaryCards) window.updateSummaryCards();
        if (window.updateDashboardCounts) window.updateDashboardCounts();
    }

    function renderIncomingCards(docs) {
        const tableBody = document.getElementById('incoming-table-body');
        if (!tableBody) return;
        const safeDocs = Array.isArray(docs) ? docs : [];
        if (!safeDocs.length) {
            tableBody.innerHTML = '<tr><td class="section-empty-row" colspan="9">No incoming documents found.</td></tr>';
            applySectionFilters(document.getElementById('incoming-section'));
            return;
        }
        tableBody.innerHTML = safeDocs.map((doc) => {
            const latestStatus = doc.status_history?.[doc.status_history.length - 1];
            const fromOffice = latestStatus?.from_office_id?.office_name || '-';
            const sortDate = latestStatus?.date || doc.updated_at || doc.created_at;
            const docId = doc._id || doc.id || '';
            const statusLabel = getIncomingStatusLabel(doc);
            const editedBadge = hasEditIndicator(doc) ? '<span class="edited-indicator">Edited</span>' : '';
            return `
                <tr data-row-type="incoming" data-doc-id="${escapeHtml(String(docId))}">
                    <td>${escapeHtml(doc.document_code || '-')}</td>
                    <td>${escapeHtml(fromOffice)}</td>
                    <td>${escapeHtml(doc.title || '-')} ${editedBadge}</td>
                    <td>${escapeHtml(doc.type_id?.type_name || '-')}</td>
                    <td><span class="${getStatusPillClass(statusLabel)}">${escapeHtml(statusLabel)}</span></td>
                    <td>${sortDate ? new Date(sortDate).toLocaleString() : '-'}</td>
                    <td>${escapeHtml(getIncomingRemarks(doc, latestStatus))}</td>
                    <td class="attachments-cell"><button class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(docId)}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</button></td>
                    <td class="actions-cell">
                        ${getIncomingActionButtons(doc, docId)}
                    </td>
                </tr>
            `;
        }).join('');
        safeDocs.forEach((doc) => prefetchAttachmentsDebounced(doc._id || doc.id, 250));
        applySectionFilters(document.getElementById('incoming-section'));
    }

    function updateIncomingBadge(count) {
        const incomingBadge = document.querySelector('.nav-link[data-section="incoming"] .badge');
        if (incomingBadge) incomingBadge.textContent = count;
    }

    function startIncomingPolling() {
        if (incomingPollHandle) return;
        incomingPollHandle = setInterval(() => {
            if (document.hidden) return;
            fetchAndRenderIncomingDocs();
        }, INCOMING_POLL_INTERVAL_MS);
    }

    function stopIncomingPolling() {
        if (!incomingPollHandle) return;
        clearInterval(incomingPollHandle);
        incomingPollHandle = null;
    }

    function openActionRemarksModal({
        title,
        promptText,
        confirmLabel,
        remarksRequired = false,
        requiredMessage = 'Remarks are required.',
        hideRemarks = false,
        initialRemarks = ''
    }) {
        return new Promise((resolve) => {
            let actionRemarksModal = document.getElementById('incoming-action-remarks-modal');
            if (!actionRemarksModal) {
                actionRemarksModal = document.createElement('div');
                actionRemarksModal.id = 'incoming-action-remarks-modal';
                actionRemarksModal.className = 'modal';
                actionRemarksModal.style.display = 'none';
                document.body.appendChild(actionRemarksModal);
            }

            actionRemarksModal.innerHTML = `
                <div class="modal-content" style="max-width:460px;width:96%;border-radius:16px;box-shadow:0 8px 32px rgba(44,62,80,0.18),0 1.5px 6px rgba(44,62,80,0.10);padding:28px 24px;">
                    <h3 style="margin-top:0;margin-bottom:12px;">${escapeHtml(title || 'Confirm Action')}</h3>
                    <p style="margin:0 0 14px 0;color:#374151;">${escapeHtml(promptText || '')}</p>
                    ${hideRemarks ? '' : `
                    <div style="margin-bottom:16px;">
                        <label for="incoming-action-remarks-input" style="display:block;font-weight:600;margin-bottom:6px;">Remarks ${remarksRequired ? '<span style="color:#dc2626;">*</span>' : '(optional)'}</label>
                        <textarea id="incoming-action-remarks-input" style="width:100%;min-height:80px;border-radius:6px;border:1px solid #ddd;padding:8px;">${escapeHtml(initialRemarks)}</textarea>
                        <div id="incoming-action-remarks-error" style="display:none;color:#dc2626;font-size:0.9em;margin-top:6px;"></div>
                    </div>
                    `}
                    <div style="display:flex;justify-content:flex-end;gap:10px;">
                        <button id="incoming-action-cancel-btn" class="btn-cancel" style="background:#f1f5f9;color:#222;">Cancel</button>
                        <button id="incoming-action-confirm-btn" class="btn-logout" style="background:#2563eb;color:#fff;">${escapeHtml(confirmLabel || 'Confirm')}</button>
                    </div>
                </div>
            `;

            const cleanupAndResolve = (value) => {
                actionRemarksModal.style.display = 'none';
                resolve(value);
            };

            actionRemarksModal.style.display = 'flex';
            const remarksInput = actionRemarksModal.querySelector('#incoming-action-remarks-input');
            const cancelBtn = actionRemarksModal.querySelector('#incoming-action-cancel-btn');
            const confirmBtn = actionRemarksModal.querySelector('#incoming-action-confirm-btn');
            const remarksError = actionRemarksModal.querySelector('#incoming-action-remarks-error');
            if (remarksInput) remarksInput.focus();
            if (cancelBtn) cancelBtn.onclick = () => cleanupAndResolve(null);
            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    const normalizedRemarks = hideRemarks ? '' : String(remarksInput?.value || '').trim();
                    if (remarksRequired && !normalizedRemarks) {
                        if (remarksError) {
                            remarksError.textContent = requiredMessage;
                            remarksError.style.display = 'block';
                        }
                        if (remarksInput) remarksInput.focus();
                        return;
                    }
                    if (remarksError) remarksError.style.display = 'none';
                    cleanupAndResolve(normalizedRemarks);
                };
            }
            actionRemarksModal.onclick = (e) => {
                if (e.target === actionRemarksModal) cleanupAndResolve(null);
            };
        });
    }

    async function receiveDocument(docId, options = {}) {
        if (actionInFlightByDoc.has(docId)) return;
        const {
            isReturnedAcknowledge = false
        } = options;
        const user = JSON.parse(localStorage.getItem('loggedInUser'));
        const myOfficeId = user.office_id?._id || user.office_id;
        const myUserId = user._id;
        const remarks = await openActionRemarksModal({
            title: isReturnedAcknowledge ? 'Acknowledge Returned Document' : 'Mark as Received',
            promptText: isReturnedAcknowledge
                ? 'Acknowledge this RETURNED document and move it to RECEIVED?'
                : 'Are you sure you want to mark this document as RECEIVED?',
            confirmLabel: isReturnedAcknowledge ? 'Acknowledge' : 'Receive',
            remarksRequired: !isReturnedAcknowledge,
            requiredMessage: 'Receive remarks are required.'
        });
        if (remarks === null) return;
        actionInFlightByDoc.add(docId);
        try {
            const res = await fetch(`${getApiBase()}/documents/${docId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'receive',
                    office_id: myOfficeId,
                    user_id: myUserId,
                    remarks
                })
            });
            if (!res.ok) throw new Error('Failed to receive document');
            alert(isReturnedAcknowledge ? 'Returned document acknowledged and moved to RECEIVED.' : 'Document marked as RECEIVED.');
            await refreshCoreDocumentSections();
            // Switch to Received section
            const receivedSection = document.getElementById('received-section');
            const receivedLink = document.querySelector('.nav-link[data-section="received"]');
            if (receivedSection && receivedLink) {
                showSection(receivedSection, receivedLink, 'Received Documents');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            actionInFlightByDoc.delete(docId);
        }
    }

    async function declineDocument(docId) {
        if (actionInFlightByDoc.has(docId)) return;
        const user = JSON.parse(localStorage.getItem('loggedInUser'));
        const myOfficeId = user.office_id?._id || user.office_id;
        const myUserId = user._id;
        const remarks = await openActionRemarksModal({
            title: 'Decline Document',
            promptText: 'Are you sure you want to DECLINE this document?',
            confirmLabel: 'Decline',
            remarksRequired: true,
            requiredMessage: 'Decline remarks are required.'
        });
        if (remarks === null) return;
        actionInFlightByDoc.add(docId);
        try {
            const res = await fetch(`${getApiBase()}/documents/${docId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'decline',
                    office_id: myOfficeId,
                    user_id: myUserId,
                    remarks
                })
            });
            if (!res.ok) throw new Error('Failed to decline document');
            alert('Document DECLINED.');
            await refreshCoreDocumentSections();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            actionInFlightByDoc.delete(docId);
        }
    }

    const incomingTableBody = document.getElementById('incoming-table-body');
    if (incomingTableBody) {
        incomingTableBody.addEventListener('click', (event) => {
            const actionButton = event.target.closest('button[data-doc-action]');
            if (!actionButton) return;
            const docId = actionButton.getAttribute('data-doc-id');
            const actionType = actionButton.getAttribute('data-doc-action');
            if (!docId || !actionType) return;
            if (actionType === 'receive') {
                receiveDocument(docId);
                return;
            }
            if (actionType === 'ack_returned') {
                receiveDocument(docId, { isReturnedAcknowledge: true });
                return;
            }
            if (actionType === 'decline') {
                declineDocument(docId);
                return;
            }
            if (actionType === 'edit_resend') {
                const sourceDoc = (window.incomingDocs || []).find((item) => String(item?._id || item?.id) === String(docId));
                if (!sourceDoc) return;
                try {
                    const editFn = window.openEditOutgoingModal;
                    if (typeof editFn !== 'function') {
                        throw new Error('openEditOutgoingModal is not available on window');
                    }
                    editFn(sourceDoc);
                } catch (err) {
                    alert(`Unable to open Edit & Resend: ${err.message}`);
                }
            }
        });
    }

    // On page load, also fetch incoming docs
    fetchAndRenderIncomingDocs();
    fetchAndRenderReceivedDocs();
    fetchAndRenderCompleteDocs();
    startIncomingPolling();
    window.addEventListener('beforeunload', () => {
        stopIncomingPolling();
        if (notificationsPollHandle) {
            clearInterval(notificationsPollHandle);
            notificationsPollHandle = null;
        }
        if (typeof stopTrackRealtimePolling === 'function') stopTrackRealtimePolling();
    });

    // When switching to Incoming section, call fetchAndRenderIncomingDocs()
    // Example:
    // document.querySelector('.nav-link[data-section="incoming"]').addEventListener('click', fetchAndRenderIncomingDocs);

    // Add after documentTypes and loadDocumentTypes
    async function populateOutgoingOfficeDropdown() {
        try {
            const res = await fetch(`${getOfficesApiBase()}/offices`);
            const officesData = await res.json();
            const user = window.loggedInUser || JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            const myOfficeId = String(user?.office_id?._id || user?.office_id || '');
            const offices = Array.isArray(officesData)
                ? officesData.filter(office => {
                    if (office.is_active === false) return false;
                    const officeId = String(office._id || office.id || '');
                    return officeId && officeId !== myOfficeId;
                })
                : [];
            console.log('Fetched offices:', offices);
            const officeSelect = document.getElementById('outgoingDocOffice');
            if (!officeSelect) {
                console.error('Dropdown not found!');
                return;
            }
            officeSelect.innerHTML = '';
            offices.forEach(office => {
                officeSelect.innerHTML += `<option value="${office._id || office.id}">${office.office_name}</option>`;
            });
            console.log('Dropdown populated!');
        } catch (err) {
            console.error('Error populating dropdown:', err);
        }
    }
    populateOutgoingOfficeDropdown();

    async function fetchAndRenderReceivedDocs() {
        const user = JSON.parse(localStorage.getItem('loggedInUser'));
        const myOfficeId = user.office_id?._id || user.office_id;
        const res = await fetch(`${getApiBase()}/documents/received?office_id=${myOfficeId}`, {
            headers: getAuthHeaders()
        });
        const receivedDocs = await res.json();
        window.receivedDocs = receivedDocs;
        renderReceivedCards();
        if (window.updateSidebarBadges) window.updateSidebarBadges();
        if (window.updateSummaryCards) window.updateSummaryCards();
        if (window.updateDashboardCounts) window.updateDashboardCounts();
    }

    function renderCompleteCards() {
        const tableBody = document.getElementById('complete-table-body');
        if (!tableBody) return;
        const docs = Array.isArray(window.completeDocs) ? window.completeDocs : [];
        tableBody.innerHTML = '';
        if (docs.length === 0) {
            tableBody.innerHTML = '<tr><td class="section-empty-row" colspan="8">No completed documents found.</td></tr>';
            applySectionFilters(document.getElementById('complete-section'));
            return;
        }

        tableBody.innerHTML = docs.map((doc) => {
            const completedBy = `${doc.completed_by_office_id?.office_name || 'Office N/A'} / ${doc.completed_by_user_id?.username || 'User N/A'}`;
            return `
                <tr data-row-type="complete">
                    <td>${escapeHtml(doc.document_code || '-')}</td>
                    <td>${escapeHtml(doc.title || '-')}</td>
                    <td>${escapeHtml(doc.type_id?.type_name || '-')}</td>
                    <td><span class="${getStatusPillClass(doc.status)}">${escapeHtml(formatStatusForDisplay(doc.status))}</span></td>
                    <td>${doc.completed_at ? new Date(doc.completed_at).toLocaleString() : '-'}</td>
                    <td>${escapeHtml(completedBy)}</td>
                    <td>${escapeHtml(doc.completion_remarks || '-')}</td>
                    <td class="attachments-cell"><button type="button" class="action-btn attachment-preview-btn" data-doc-id="${escapeHtml(doc._id || doc.id || '')}" data-doc-title="${escapeHtml(doc.title || doc.document_code || 'Document')}">👁 Preview</button></td>
                </tr>
            `;
        }).join('');
        docs.forEach((doc) => prefetchAttachmentsDebounced(doc._id || doc.id, 250));
        applySectionFilters(document.getElementById('complete-section'));
    }

    async function fetchAndRenderCompleteDocs() {
        try {
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            const myOfficeId = user?.office_id?._id || user?.office_id;
            if (!myOfficeId) {
                window.completeDocs = [];
                renderCompleteCards();
                return;
            }
            const res = await fetch(`${getApiBase()}/documents/complete?office_id=${myOfficeId}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch completed documents');
            const completeDocs = await res.json();
            window.completeDocs = Array.isArray(completeDocs) ? completeDocs : [];
            renderCompleteCards();
            if (window.updateSidebarBadges) window.updateSidebarBadges();
            if (window.updateSummaryCards) window.updateSummaryCards();
            if (window.updateDashboardCounts) window.updateDashboardCounts();
        } catch (err) {
            console.error('Failed to fetch completed documents:', err);
            window.completeDocs = [];
            renderCompleteCards();
        }
    }
});
