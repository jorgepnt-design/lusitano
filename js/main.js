/* ============================================================
   STROMFLOTTE — motion
   Lenis inertia scroll + GSAP ScrollTrigger reveals
   ============================================================ */

(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  /* ---------- progress rail ---------- */
  const bar = document.getElementById("progressBar");
  function updateProgress() {
    const h = document.documentElement;
    const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    if (bar) bar.style.width = (scrolled * 100).toFixed(2) + "%";
  }
  if (lenis) lenis.on("scroll", updateProgress);
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---------- GSAP reveals ---------- */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    if (!reduce) {
      // generic fade-up reveals
      gsap.utils.toArray(".reveal").forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // thesis: word-by-word
      gsap.to(".reveal-word", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".thesis", start: "top 70%" },
      });

      // hero parallax (locked to scroll axis, constant, no drift)
      gsap.to(".hero__video", {
        yPercent: 14,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // feature images: gentle scrub parallax
      gsap.utils.toArray(".feature__media img").forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: "none",
            scrollTrigger: {
              trigger: img,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      });

      // numbered row heads slide accent
      gsap.utils.toArray(".row__num").forEach((num) => {
        gsap.from(num, {
          xPercent: -40,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: num, start: "top 88%" },
        });
      });
    }
  } else {
    // no GSAP: make everything visible
    document.querySelectorAll(".reveal, .reveal-word").forEach((el) => {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
  }

  /* ---------- thesis words initial state ---------- */
  if (!reduce) {
    document.querySelectorAll(".reveal-word").forEach((w) => {
      w.style.opacity = 0;
      w.style.transform = "translateY(36px)";
    });
  }

  /* ---------- footer marquee loop ---------- */
  const track = document.querySelector(".footer__track");
  if (track && !reduce) {
    let x = 0;
    const speed = 0.4;
    const half = () => track.scrollWidth / 2;
    function loop() {
      x -= speed;
      if (Math.abs(x) >= half()) x = 0;
      track.style.transform = "translateX(" + x + "px)";
      requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------- anchor links through Lenis ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------- ambient background music ---------- */
  (function () {
    const audio = document.getElementById("bgm");
    const btn = document.getElementById("soundToggle");
    if (!audio || !btn) return;

    const TARGET = 0.32;
    let playing = false;
    let fadeTimer = null;

    function fadeTo(target, done) {
      clearInterval(fadeTimer);
      fadeTimer = setInterval(() => {
        const step = 0.04;
        if (Math.abs(audio.volume - target) <= step) {
          audio.volume = target;
          clearInterval(fadeTimer);
          if (done) done();
        } else {
          audio.volume += audio.volume < target ? step : -step;
        }
      }, 30);
    }

    function setUI(on) {
      btn.classList.toggle("is-playing", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        on ? "Hintergrundmusik ausschalten" : "Hintergrundmusik einschalten"
      );
    }

    function play() {
      audio.volume = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      playing = true;
      setUI(true);
      fadeTo(TARGET);
    }

    function pause() {
      playing = false;
      setUI(false);
      fadeTo(0, () => audio.pause());
    }

    btn.addEventListener("click", () => (playing ? pause() : play()));

    // pause while the tab is hidden, resume if it was playing
    let resumeOnReturn = false;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && playing) {
        resumeOnReturn = true;
        audio.pause();
      } else if (!document.hidden && resumeOnReturn) {
        resumeOnReturn = false;
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
      }
    });
  })();
})();
