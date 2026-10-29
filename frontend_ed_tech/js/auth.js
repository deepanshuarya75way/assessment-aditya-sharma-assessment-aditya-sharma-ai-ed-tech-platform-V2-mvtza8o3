document.addEventListener('DOMContentLoaded', () => {
    const isFileProtocol = window.location.protocol === 'file:';
    const PROD_API_URL = '';
    let API_BASE_URL;

    if (PROD_API_URL) {
        API_BASE_URL = PROD_API_URL;
    } else if (isFileProtocol) {
        API_BASE_URL = 'http://localhost:8000';
    } else {
        API_BASE_URL = window.location.origin;
    }

    // Use an absolute path for dashboard if on file protocol
    const DASHBOARD_URL = isFileProtocol ? 'dashboard.html' : '/dashboard.html';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toRegisterBtn = document.getElementById('to-register');
    const toLoginBtn = document.getElementById('to-login');
    const loginButton = loginForm.querySelector('button[type="submit"]');
    const registerButton = registerForm.querySelector('button[type="submit"]');

    const loginMessage = createMessageElement(loginForm);
    const registerMessage = createMessageElement(registerForm);

    // Smooth Toggle to Register Form
    toRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(loginForm, registerForm);
    });

    // Smooth Toggle to Login Form
    toLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(registerForm, loginForm);
    });

    // Helper function to handle form transition states
    function switchForm(hideForm, showForm) {
        clearMessage(loginMessage);
        clearMessage(registerMessage);
        hideForm.style.opacity = '0';
        hideForm.style.transform = 'translateY(10px)';

        setTimeout(() => {
            hideForm.classList.remove('active');
            showForm.classList.add('active');

            // Tiny delay to trigger the entering transition smoothly
            setTimeout(() => {
                showForm.style.opacity = '1';
                showForm.style.transform = 'translateY(0)';
            }, 50);
        }, 300); // Matches the CSS transition time
    }

    function createMessageElement(form) {
        const message = document.createElement('p');
        message.className = 'auth-message';
        message.setAttribute('aria-live', 'polite');
        form.insertBefore(message, form.querySelector('.toggle-text'));
        return message;
    }

    function showMessage(element, text, type) {
        element.textContent = text;
        element.className = `auth-message ${type}`;
    }

    function clearMessage(element) {
        element.textContent = '';
        element.className = 'auth-message';
    }

    async function parseApiResponse(response) {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return response.json();
        }

        return { detail: await response.text() };
    }

    function getApiErrorMessage(data, fallback) {
        if (Array.isArray(data.detail)) {
            return data.detail.map((error) => error.msg).join(' ');
        }

        return data.detail || fallback;
    }

    function splitFullName(fullName) {
        const [firstName = '', ...rest] = fullName.trim().split(/\s+/);

        return {
            first_name: firstName,
            last_name: rest.join(' '),
        };
    }

    function goToDashboard(user) {
        sessionStorage.setItem('eduai_user', JSON.stringify(user));
        window.location.href = DASHBOARD_URL;
    }

    // FastAPI auth handlers
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const formData = new URLSearchParams();

        formData.append('username', email);
        formData.append('password', password);

        loginButton.disabled = true;
        loginButton.textContent = 'Signing in...';
        clearMessage(loginMessage);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
                credentials: 'include',
            });

            const data = await parseApiResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Login failed'));
            }

            showMessage(loginMessage, `Welcome back, ${data.first_name}!`, 'success');
            goToDashboard(data);
        } catch (error) {
            showMessage(loginMessage, error.message, 'error');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Sign In';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showMessage(registerMessage, 'Please enter a valid email address.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showMessage(registerMessage, 'Passwords do not match', 'error');
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = 'Creating...';
        clearMessage(registerMessage);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
                credentials: 'include',
            });

            const data = await parseApiResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Registration failed'));
            }

            showMessage(registerMessage, `Account created. Welcome, ${data.first_name}!`, 'success');
            goToDashboard(data);
        } catch (error) {
            showMessage(registerMessage, error.message, 'error');
        } finally {
            registerButton.disabled = false;
            registerButton.textContent = 'Get Started';
        }
    });


});
