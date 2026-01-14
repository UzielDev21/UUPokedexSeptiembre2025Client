
const passwordInput = document.getElementById('pass_d');
const toggleButton = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');

toggleButton.addEventListener('click', function () {

    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    this.classList.toggle('active');
    if (type === 'password') {
        eyeIcon.classList.replace('bi-eye-slash', 'bi-eye');
    } else {
        eyeIcon.classList.replace('bi-eye', 'bi-eye-slash');
    }
});

passwordInput.addEventListener('click', function (){
    console.log("grtyuiop");
});

eyeIcon.addEventListener('click', function (){
    console.log("grtyuiop");
});