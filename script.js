// Reply & Close — The 24/7 Sales Engine — entry landing page
// Edit the values below. See README.md for how to preview and deploy.

var CONFIG = {
  PRICE: "₦2,500",
  WAS_PRICE: "₦9,900",
  SELAR_URL: "TODO:SELAR_URL", // paste your Selar product link for the ₦2,500 product here
  SUPPORT_EMAIL: "TODO:SUPPORT_EMAIL", // your support contact email
  WHATSAPP_URL: "", // e.g. https://wa.me/234XXXXXXXXXX, or leave empty to hide the WhatsApp footer link
  META_PIXEL_ID: "2324842898318551", // reused from the previous version of this page, or leave empty to load nothing
};

(function () {
  "use strict";

  // ---- fill CONFIG into the page ----

  document.querySelectorAll('[data-field="price"]').forEach(function (el) {
    el.textContent = CONFIG.PRICE;
  });
  document.querySelectorAll('[data-field="was-price"]').forEach(function (el) {
    el.textContent = CONFIG.WAS_PRICE;
  });
  document.querySelectorAll(".cta-link").forEach(function (el) {
    if (CONFIG.SELAR_URL) el.setAttribute("href", CONFIG.SELAR_URL);
  });
  document.querySelectorAll(".support-email-link").forEach(function (el) {
    if (CONFIG.SUPPORT_EMAIL) el.setAttribute("href", "mailto:" + CONFIG.SUPPORT_EMAIL);
  });
  if (CONFIG.WHATSAPP_URL) {
    document.querySelectorAll(".whatsapp-link").forEach(function (el) {
      el.setAttribute("href", CONFIG.WHATSAPP_URL);
      el.style.display = "";
    });
  }

  // ---- Meta Pixel (base code + PageView), only if META_PIXEL_ID is set ----

  if (CONFIG.META_PIXEL_ID) {
    /* eslint-disable */
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", CONFIG.META_PIXEL_ID);
    window.fbq("track", "PageView");
  }

  // Fire a custom event before navigating away on any CTA click.
  document.querySelectorAll(".cta-link").forEach(function (el) {
    el.addEventListener("click", function () {
      if (CONFIG.META_PIXEL_ID && window.fbq) {
        window.fbq("trackCustom", "CTAClick");
      }
    });
  });

  // ---- "What's inside" tabs ----

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".inside-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".inside-panel"));

  function activateTab(tab) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", selected ? "true" : "false");
      t.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.id === tab.getAttribute("data-panel"));
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      activateTab(tab);
    });
    tab.addEventListener("keydown", function (e) {
      var targetIndex = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") targetIndex = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") targetIndex = (i - 1 + tabs.length) % tabs.length;
      if (targetIndex !== null) {
        e.preventDefault();
        tabs[targetIndex].focus();
        activateTab(tabs[targetIndex]);
      }
    });
  });

  // ---- Lightbox ----

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxClose = document.getElementById("lightbox-close");
  var lastFocused = null;

  if (!lightbox || !lightboxImg || !lightboxClose) {
    return; // this page (e.g. a policy page) has no lightbox/tabs markup
  }

  function openLightbox(src, alt) {
    lastFocused = document.activeElement;
    lightboxImg.setAttribute("src", src);
    lightboxImg.setAttribute("alt", alt || "");
    lightbox.classList.add("is-open");
    lightboxClose.focus();
    document.addEventListener("keydown", onLightboxKeydown);
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightboxImg.setAttribute("src", "");
    document.removeEventListener("keydown", onLightboxKeydown);
    if (lastFocused) lastFocused.focus();
  }

  function onLightboxKeydown(e) {
    if (e.key === "Escape") closeLightbox();
  }

  document.querySelectorAll(".lightbox-trigger").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openLightbox(btn.getAttribute("data-full"), btn.getAttribute("data-alt"));
    });
  });

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
})();
