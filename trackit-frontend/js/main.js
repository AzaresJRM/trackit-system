document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    const forgotPasswordLink = document.querySelector('.forgot-password');
    const passwordResetModal = document.getElementById('passwordResetModal');
    const passwordResetForm = document.getElementById('passwordResetForm');
    const resetIdentifierInput = document.getElementById('resetIdentifierInput');
    const resetMessageInput = document.getElementById('resetMessageInput');
    const passwordResetFeedback = document.getElementById('passwordResetFeedback');
    const passwordResetCancelBtn = document.getElementById('passwordResetCancelBtn');
    const passwordResetSubmitBtn = document.getElementById('passwordResetSubmitBtn');

    function getApiBase() {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:4000/api';
        }
        return 'https://trackit-system.onrender.com/api';
    }

    // ---------------- PASSWORD RESET ----------------
    function closePasswordResetModal() {
        if (!passwordResetModal) return;
        passwordResetModal.classList.add('hidden');
        passwordResetModal.setAttribute('aria-hidden', 'true');

        if (passwordResetFeedback) {
            passwordResetFeedback.textContent = '';
            passwordResetFeedback.classList.remove('error');
        }

        if (passwordResetForm) passwordResetForm.reset();
    }

    function openPasswordResetModal() {
        if (!passwordResetModal) return;

        if (resetIdentifierInput && usernameInput?.value.trim()) {
            resetIdentifierInput.value = usernameInput.value.trim();
        }

        passwordResetModal.classList.remove('hidden');
        passwordResetModal.setAttribute('aria-hidden', 'false');
    }

    if (forgotPasswordLink && passwordResetModal) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            openPasswordResetModal();
        });

        passwordResetCancelBtn?.addEventListener('click', closePasswordResetModal);

        passwordResetModal.addEventListener('click', (e) => {
            if (e.target === passwordResetModal) closePasswordResetModal();
        });
    }

    if (passwordResetForm) {
        passwordResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const requestedIdentifier = resetIdentifierInput.value.trim();
            const message = resetMessageInput?.value.trim() || '';

            if (!requestedIdentifier) {
                passwordResetFeedback.textContent = 'Please enter your office username.';
                passwordResetFeedback.classList.add('error');
                return;
            }

            passwordResetSubmitBtn.disabled = true;
            passwordResetFeedback.textContent = '';

            try {
                const res = await fetch(`${getApiBase()}/auth/password-reset-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requested_identifier: requestedIdentifier,
                        message
                    })
                });

                if (!res.ok) throw new Error('Request failed');

                passwordResetFeedback.textContent = 'Request sent to Admin.';
                setTimeout(closePasswordResetModal, 900);

            } catch (err) {
                passwordResetFeedback.textContent = 'Unable to send request.';
                passwordResetFeedback.classList.add('error');
            } finally {
                passwordResetSubmitBtn.disabled = false;
            }
        });
    }

    // ---------------- LOGIN ----------------
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                alert('Please enter both username and password.');
                return;
            }

            try {
                const response = await fetch(`${getApiBase()}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                let result;
                try {
                    result = await response.json();
                } catch {
                    throw new Error('Invalid server response');
                }

                if (!response.ok) {
                    alert(result.message || 'Invalid login');
                    return;
                }

                // Fix possible Mongo-style ID
                if (result.office_id?.$oid) {
                    result.office_id = result.office_id.$oid;
                }

                localStorage.setItem('loggedInUser', JSON.stringify(result));

                const role = (result.role || '').toLowerCase();
                const isAdmin =
                    role === 'admin' ||
                    role === 'superadmin' ||
                    result.username === 'admin';

                if (isAdmin) {
                    window.location.href = 'admin_dashboard.html';
                } else {
                    if (result.must_change_password) {
                        alert('You must change your password first.');
                    }
                    window.location.href = 'user_dashboard.html';
                }

            } catch (err) {
                console.error('LOGIN ERROR:', err);
                alert('Server error. Please try again.');
            }
        });
    }
});
