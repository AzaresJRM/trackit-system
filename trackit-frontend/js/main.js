// Firebase config (no imports needed, using CDN compat) // const firebaseConfig = { // apiKey: "AIzaSyBVBqVV1YiTmu2yCfW68jxmr3cnXx-vqX0", // authDomain: "trackit--dts.firebaseapp.com", // projectId: "trackit--dts", // storageBucket: "trackit--dts.firebasestorage.app", // messagingSenderId: "49347098537", // appId: "1:49347098537:web:47ec15ea7be0536278b6b8", // measurementId: "G-KPBJ3TSWT3" // }; // firebase.initializeApp(firebaseConfig); // const analytics = firebase.analytics(); // const db = firebase.firestore();

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
    if (resetIdentifierInput && usernameInput && usernameInput.value.trim()) {
      resetIdentifierInput.value = usernameInput.value.trim();
    }
    passwordResetModal.classList.remove('hidden');
    passwordResetModal.setAttribute('aria-hidden', 'false');
  }

  if (forgotPasswordLink && passwordResetModal) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      openPasswordResetModal();
    });

    if (passwordResetCancelBtn) {
      passwordResetCancelBtn.addEventListener('click', () => closePasswordResetModal());
    }

    passwordResetModal.addEventListener('click', (event) => {
      if (event.target === passwordResetModal) {
        closePasswordResetModal();
      }
    });
  }

  if (passwordResetForm && resetIdentifierInput) {
    passwordResetForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const requestedIdentifier = resetIdentifierInput.value.trim();
      const message = resetMessageInput ? resetMessageInput.value.trim() : '';

      if (!requestedIdentifier) {
        if (passwordResetFeedback) {
          passwordResetFeedback.textContent = 'Please enter your office username.';
          passwordResetFeedback.classList.add('error');
        }
        return;
      }

      if (passwordResetSubmitBtn) passwordResetSubmitBtn.disabled = true;

      if (passwordResetFeedback) {
        passwordResetFeedback.textContent = '';
        passwordResetFeedback.classList.remove('error');
      }

      try {
        await fetch(${getApiBase()}/auth/password-reset-request, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requested_identifier: requestedIdentifier, message })
        });

        if (passwordResetFeedback) {
          passwordResetFeedback.textContent = 'Request sent to Admin.';
          passwordResetFeedback.classList.remove('error');
        }

        setTimeout(() => {
          closePasswordResetModal();
        }, 900);
      } catch (error) {
        if (passwordResetFeedback) {
          passwordResetFeedback.textContent = 'Unable to send request right now. Please try again.';
          passwordResetFeedback.classList.add('error');
        }
      } finally {
        if (passwordResetSubmitBtn) passwordResetSubmitBtn.disabled = false;
      }
    });
  }

  if (loginForm && usernameInput && passwordInput) {
    loginForm.addEventListener('submit', async function(event) {
      event.preventDefault();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        alert('Please enter both username and password.');
        return;
      }

      try {
        // Call backend API for login
        const response = await fetch(${getApiBase()}/login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(result.message || 'Invalid username or password.');
          return;
        }

        // Store user info (including token) for dashboard
        if (result.office_id && typeof result.office_id === 'object' && result.office_id.$oid) {
          result.office_id = result.office_id.$oid;
        }

        localStorage.setItem('loggedInUser', JSON.stringify(result));

        // Redirect based on role (treat any admin-like account as admin)
        const role = typeof result.role === 'string' ? result.role.toLowerCase() : '';
        const isAdmin = role === 'admin' || role === 'superadmin' || result.username === 'admin';

        if (isAdmin) {
          window.location.href = 'admin_dashboard.html';
        } else {
          if (result.must_change_password) {
            alert('Your password has been reset. You must change your password before continuing.');
          }
          window.location.href = 'user_dashboard.html';
        }
      } catch (error) {
        alert('Login error: ' + error.message);
      }
    });
  }
});

// Import the Firebase modules (if using modules, otherwise use CDN in HTML) // import { initializeApp } from 'firebase/app'; // import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore'; // Initialize Firebase // const db1 = firebase.firestore();

// Example: Get all users from 'users' collection
function getAllUsers() {
  // db.collection('users').get().then((querySnapshot) => {
  // querySnapshot.forEach((doc) => {
  // console.log(doc.id, doc.data());
  // });
  // }).catch((error) => {
  // console.error('Error getting users:', error);
  // });
}

// Example: Add a new user
// db.collection('users').add({
// username: 'newuser',
// is_active: 1
// }).then((docRef) => {
// console.log('User added with ID:', docRef.id);
// }).catch((error) => {
// console.error('Error adding user:', error);
// });

// Call getAllUimage.pngest
getAllUsers();
