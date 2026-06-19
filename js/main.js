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

  /* ---------- video autoplay resilience (iOS Safari) ---------- */
  (function () {
    const vids = Array.prototype.slice.call(document.querySelectorAll("video"));
    if (!vids.length) return;

    function tryPlay(v) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }

    vids.forEach((v) => {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      // start as soon as the clip is decodable, and immediately if already so
      v.addEventListener("loadeddata", () => tryPlay(v));
      v.addEventListener("canplay", () => tryPlay(v));
      if (v.readyState >= 2) tryPlay(v);
    });

    // re-assert play when a video scrolls into view (covers iOS + lazy load).
    // Never pause off-screen: both clips are short muted loops.
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && e.target.paused) tryPlay(e.target);
          });
        },
        { threshold: 0.1 }
      );
      vids.forEach((v) => io.observe(v));
    }

    // first user gesture kick (covers iOS gesture / low-power gating)
    function kick() {
      vids.forEach(tryPlay);
      document.removeEventListener("touchstart", kick);
      document.removeEventListener("click", kick);
    }
    document.addEventListener("touchstart", kick, { passive: true });
    document.addEventListener("click", kick);
  })();

  /* ---------- ambient background music ---------- */
  (function () {
    const audio = document.getElementById("bgm");
    const btn = document.getElementById("soundToggle");
    if (!audio || !btn) return;

    const TARGET = 0.32;
    let playing = false;
    let fadeTimer = null;

    // Cosmetic volume fade. iOS Safari ignores volume changes, so the loop
    // is capped by step count and never gates playback control.
    function fadeVolume(target) {
      clearInterval(fadeTimer);
      let steps = 0;
      fadeTimer = setInterval(() => {
        steps++;
        const v = audio.volume;
        if (Math.abs(v - target) <= 0.05 || steps >= 24) {
          try { audio.volume = target; } catch (e) {}
          clearInterval(fadeTimer);
        } else {
          try {
            audio.volume = Math.min(1, Math.max(0, v + (v < target ? 0.05 : -0.05)));
          } catch (e) {}
        }
      }, 28);
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
      try { audio.volume = 0; } catch (e) {}
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      playing = true;
      setUI(true);
      fadeVolume(TARGET);
    }

    function pause() {
      // Stop immediately and reliably (works on iOS where volume is read-only).
      clearInterval(fadeTimer);
      playing = false;
      setUI(false);
      audio.pause();
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
