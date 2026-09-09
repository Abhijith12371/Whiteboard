document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal');

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // Interactive Blob following mouse (Subtle effect)
    const blob1 = document.querySelector('.blob-1');
    const blob2 = document.querySelector('.blob-2');
    
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Smooth following using requestAnimationFrame
    function animateBlobs() {
        // Easing
        targetX += (mouseX - targetX) * 0.02;
        targetY += (mouseY - targetY) * 0.02;

        if (blob1 && blob2) {
            // Slight offset for parallax feel
            blob1.style.transform = `translate(${targetX * 0.05}px, ${targetY * 0.05}px)`;
            blob2.style.transform = `translate(${targetX * -0.03}px, ${targetY * -0.03}px)`;
        }

        requestAnimationFrame(animateBlobs);
    }

    animateBlobs();
});
