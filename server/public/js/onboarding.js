function dmxrOnboarding() {
  var tourSteps = [
    {
      selector: ".header-right",
      title: "Header Controls",
      description: "Access the DMX Monitor, Latency Dashboard, Connection Log, and Settings."
    },
    {
      selector: ".sidebar",
      title: "Fixture Library",
      description: "Search or browse thousands of fixtures from Open Fixture Library. Drag onto the grid to add.",
      preHook: function (ctx) { ctx.sidebarOpen = true; }
    },
    {
      selector: ".channel-grid",
      title: "Universe Grid",
      description: "Your 512-channel DMX universe. Drag fixtures to reposition. Hover for channel details."
    },
    {
      selector: ".fixture-list",
      title: "Your Fixtures",
      description: "Each card shows DMX range, color preview, and channels. Expand for overrides and movement control."
    },
    {
      selector: ".toolbar",
      title: "Toolbar",
      description: "Blackout/Whiteout all fixtures, sync with SignalRGB, or manage groups."
    }
  ];

  return {
    onboardingSplash: false,
    onboardingActive: false,
    onboardingStep: 0,
    spotlightStyle: "",
    cardStyle: "",
    helpMode: false,
    helpTooltip: { visible: false, x: 0, y: 0, title: "", description: "" },
    tourSteps: tourSteps,
    _onboardingResizeHandler: null,

    async checkOnboardingNeeded() {
      if (this.wizardVisible) return;
      try {
        var res = await fetch("/settings");
        if (!res.ok) return;
        var data = await res.json();
        if (!data.settings.onboardingCompleted) {
          this.onboardingSplash = true;
        }
      } catch (e) {
        // server may not support settings yet
      }
    },

    startTour() {
      this.onboardingSplash = false;
      this.onboardingActive = true;
      this.onboardingStep = 0;
      this.goToStep(0);
      this._bindOnboardingResize();
    },

    goToStep(i) {
      var self = this;
      var step = tourSteps[i];
      if (!step) return;

      if (step.preHook) {
        step.preHook(self);
      }

      var el = document.querySelector(step.selector);
      if (!el) {
        self.positionSpotlight(null);
        return;
      }

      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(function () {
        self.positionSpotlight(el);
      }, 150);
    },

    positionSpotlight(el) {
      if (!el) {
        this.spotlightStyle = "display:none";
        this.cardStyle = "display:none";
        return;
      }
      var pad = 8;
      var rect = el.getBoundingClientRect();
      this.spotlightStyle =
        "left:" + (rect.left - pad) + "px;" +
        "top:" + (rect.top - pad) + "px;" +
        "width:" + (rect.width + pad * 2) + "px;" +
        "height:" + (rect.height + pad * 2) + "px";
      this.positionCard(rect);
    },

    positionCard(spotRect) {
      var cardWidth = 320;
      var cardHeight = 180;
      var gap = 12;
      var vw = window.innerWidth;
      var vh = window.innerHeight;

      // If the spotlight is taller than half the viewport (e.g. sidebar),
      // place the card to the right of the spotlight instead of above/below
      if (spotRect.height > vh * 0.5) {
        var x = Math.min(spotRect.right + gap, vw - cardWidth - 16);
        var y = Math.max(16, Math.min(spotRect.top + 40, vh - cardHeight - 16));
        this.cardStyle = "left:" + x + "px;top:" + y + "px";
        return;
      }

      var x = Math.max(16, Math.min(spotRect.left, vw - cardWidth - 16));
      var y = spotRect.bottom + gap;

      if (y + cardHeight > vh) {
        y = spotRect.top - cardHeight - gap;
      }

      this.cardStyle = "left:" + x + "px;top:" + y + "px";
    },

    onboardingNext() {
      if (this.onboardingStep >= tourSteps.length - 1) {
        this.finishOnboarding();
      } else {
        this.onboardingStep++;
        this.goToStep(this.onboardingStep);
      }
    },

    onboardingBack() {
      if (this.onboardingStep > 0) {
        this.onboardingStep--;
        this.goToStep(this.onboardingStep);
      }
    },

    async skipOnboarding() {
      this.onboardingSplash = false;
      this.onboardingActive = false;
      this._unbindOnboardingResize();
      try {
        await fetch("/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingCompleted: true })
        });
      } catch (e) {
        // best-effort
      }
    },

    async finishOnboarding() {
      this.onboardingActive = false;
      this._unbindOnboardingResize();
      try {
        await fetch("/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingCompleted: true })
        });
      } catch (e) {
        // best-effort
      }
    },

    restartTour() {
      this.helpMode = false;
      this.onboardingSplash = true;
    },

    toggleHelpMode() {
      this.helpMode = !this.helpMode;
      if (!this.helpMode) {
        this.helpTooltip = { visible: false, x: 0, y: 0, title: "", description: "" };
      }
    },

    onHelpHover(event) {
      if (!this.helpMode) return;
      var target = event.target.closest("[data-help-title]");
      if (target) {
        var rect = target.getBoundingClientRect();
        this.helpTooltip = {
          visible: true,
          x: Math.max(8, Math.min(rect.left, window.innerWidth - 260)),
          y: rect.bottom + 8,
          title: target.getAttribute("data-help-title"),
          description: target.getAttribute("data-help-desc") || ""
        };
      } else {
        this.helpTooltip = { visible: false, x: 0, y: 0, title: "", description: "" };
      }
    },

    _bindOnboardingResize() {
      var self = this;
      this._onboardingResizeHandler = function () {
        if (!self.onboardingActive) return;
        var step = tourSteps[self.onboardingStep];
        if (!step) return;
        var el = document.querySelector(step.selector);
        self.positionSpotlight(el);
      };
      window.addEventListener("resize", this._onboardingResizeHandler);
      window.addEventListener("scroll", this._onboardingResizeHandler, true);
    },

    _unbindOnboardingResize() {
      if (this._onboardingResizeHandler) {
        window.removeEventListener("resize", this._onboardingResizeHandler);
        window.removeEventListener("scroll", this._onboardingResizeHandler, true);
        this._onboardingResizeHandler = null;
      }
    }
  };
}
