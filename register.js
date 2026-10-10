document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("registerForm");

    const fullName = document.getElementById("full_name");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirm_password");

    const togglePassword = document.getElementById("togglePassword");
    const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

    const message = document.getElementById("message");
    const registerButton = document.getElementById("registerButton");

    const strengthFill = document.getElementById("strengthFill");
    const strengthText = document.getElementById("strengthText");

    const lengthRule = document.getElementById("lengthRule");
    const uppercaseRule = document.getElementById("uppercaseRule");
    const lowercaseRule = document.getElementById("lowercaseRule");
    const numberRule = document.getElementById("numberRule");
    const specialRule = document.getElementById("specialRule");


    /* =====================================================
       SHOW MESSAGE
    ===================================================== */

    function showMessage(text, type = "error") {

        message.textContent = text;

        message.className = "message show " + type;
    }


    /* =====================================================
       CLEAR MESSAGE
    ===================================================== */

    function clearMessage() {

        message.textContent = "";

        message.className = "message";
    }


    /* =====================================================
       SHOW / HIDE PASSWORD
    ===================================================== */

    togglePassword.addEventListener("click", function () {

        if (password.type === "password") {

            password.type = "text";
            togglePassword.textContent = "Hide";
            togglePassword.setAttribute("aria-label", "Hide password");

        } else {

            password.type = "password";
            togglePassword.textContent = "Show";
            togglePassword.setAttribute("aria-label", "Show password");
        }

    });


    /* =====================================================
       SHOW / HIDE CONFIRM PASSWORD
    ===================================================== */

    toggleConfirmPassword.addEventListener("click", function () {

        if (confirmPassword.type === "password") {

            confirmPassword.type = "text";
            toggleConfirmPassword.textContent = "Hide";
            toggleConfirmPassword.setAttribute("aria-label", "Hide password");

        } else {

            confirmPassword.type = "password";
            toggleConfirmPassword.textContent = "Show";
            toggleConfirmPassword.setAttribute("aria-label", "Show password");
        }

    });


    /* =====================================================
       UPDATE PASSWORD REQUIREMENTS
    ===================================================== */

    function updateRule(element, valid) {

        const icon = element.querySelector("span");

        if (valid) {

            element.classList.add("valid");
            icon.textContent = "✓";

        } else {

            element.classList.remove("valid");
            icon.textContent = "○";
        }
    }


    /* =====================================================
       PASSWORD STRENGTH
    ===================================================== */

    function updatePasswordStrength() {

        const value = password.value;

        const hasLength = value.length >= 8;
        const hasUppercase = /[A-Z]/.test(value);
        const hasLowercase = /[a-z]/.test(value);
        const hasNumber = /[0-9]/.test(value);
        const hasSpecial = /[^A-Za-z0-9]/.test(value);

        updateRule(lengthRule, hasLength);
        updateRule(uppercaseRule, hasUppercase);
        updateRule(lowercaseRule, hasLowercase);
        updateRule(numberRule, hasNumber);
        updateRule(specialRule, hasSpecial);

        let score = 0;

        if (hasLength) score++;
        if (hasUppercase) score++;
        if (hasLowercase) score++;
        if (hasNumber) score++;
        if (hasSpecial) score++;


        if (value.length === 0) {

            strengthFill.style.width = "0%";
            strengthText.textContent = "Enter a password";

        } else if (score <= 2) {

            strengthFill.style.width = "25%";
            strengthText.textContent = "Weak";

        } else if (score === 3) {

            strengthFill.style.width = "50%";
            strengthText.textContent = "Fair";

        } else if (score === 4) {

            strengthFill.style.width = "75%";
            strengthText.textContent = "Good";

        } else {

            strengthFill.style.width = "100%";
            strengthText.textContent = "Strong";
        }
    }


    password.addEventListener("input", function () {

        updatePasswordStrength();

        clearMessage();

    });


    /* =====================================================
       CLEAR MESSAGE WHEN USER TYPES
    ===================================================== */

    fullName.addEventListener("input", clearMessage);
    email.addEventListener("input", clearMessage);
    confirmPassword.addEventListener("input", clearMessage);


    /* =====================================================
       EMAIL VALIDATION
    ===================================================== */

    function validEmail(value) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
    }


    /* =====================================================
       PASSWORD VALIDATION
    ===================================================== */

    function strongPassword(value) {

        return (
            value.length >= 8 &&
            /[A-Z]/.test(value) &&
            /[a-z]/.test(value) &&
            /[0-9]/.test(value) &&
            /[^A-Za-z0-9]/.test(value)
        );
    }


    /* =====================================================
       FORM SUBMISSION
    ===================================================== */

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        clearMessage();


        const nameValue = fullName.value.trim();
        const emailValue = email.value.trim();
        const passwordValue = password.value;
        const confirmValue = confirmPassword.value;


        /* NAME */

        if (nameValue.length < 2) {

            showMessage("Please enter your full name.");

            fullName.focus();

            return;
        }


        /* EMAIL */

        if (!validEmail(emailValue)) {

            showMessage("Please enter a valid email address.");

            email.focus();

            return;
        }


        /* PASSWORD */

        if (!strongPassword(passwordValue)) {

            showMessage(
                "Please complete all password requirements."
            );

            password.focus();

            return;
        }


        /* CONFIRM PASSWORD */

        if (passwordValue !== confirmValue) {

            showMessage("Passwords do not match.");

            confirmPassword.focus();

            return;
        }


        /* =================================================
           SUBMIT
        ================================================= */

        registerButton.disabled = true;
        registerButton.textContent = "Creating Account...";

        form.submit();

    });

});