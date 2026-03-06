/**
 * Configuration export/import for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrConfig() {
  return {
    // Import modal state
    configImportOpen: false,
    configImportFile: null,
    configImportPreview: null,
    configImportMode: "replace",
    configImportError: "",
    configImportResult: null,

    async exportConfig() {
      try {
        var res = await fetch("/config/export");
        if (!res.ok) {
          this.showGridError("Export failed");
          return;
        }
        var blob = await res.blob();
        var disposition = res.headers.get("content-disposition") || "";
        var match = disposition.match(/filename="?([^"]+)"?/);
        var filename = match ? match[1] : "dmxr-config.json";

        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        this.showGridError("Export failed: network error");
      }
    },

    openImportModal() {
      this.configImportOpen = true;
      this.configImportFile = null;
      this.configImportPreview = null;
      this.configImportMode = "replace";
      this.configImportError = "";
      this.configImportResult = null;
    },

    closeImportModal() {
      this.configImportOpen = false;
      this.configImportFile = null;
      this.configImportPreview = null;
      this.configImportError = "";
      this.configImportResult = null;
    },

    async handleConfigFile(event) {
      this.configImportError = "";
      this.configImportPreview = null;
      this.configImportResult = null;

      var file = event.target.files[0];
      if (!file) return;

      try {
        var text = await file.text();
        var config = JSON.parse(text);
        this.configImportFile = config;

        var res = await fetch("/config/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: config }),
        });

        var body = await res.json();
        if (body.valid) {
          this.configImportPreview = body;
        } else {
          this.configImportError = body.error || "Invalid config file";
        }
      } catch {
        this.configImportError = "Could not read file. Is it a valid DMXr config JSON?";
      }
    },

    async submitImport() {
      if (!this.configImportFile) return;

      this.configImportError = "";
      this.configImportResult = null;

      var confirmed = this.configImportMode === "replace"
        ? confirm("Replace mode will remove ALL existing fixtures. Continue?")
        : true;
      if (!confirmed) return;

      try {
        var res = await fetch("/config/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: this.configImportFile,
            mode: this.configImportMode,
          }),
        });

        var body = await res.json();
        if (body.success) {
          this.configImportResult = body;
          await this.loadFixtures();
          if (body.settingsApplied) {
            this.loadServerName();
          }
        } else {
          this.configImportError = body.error || "Import failed";
        }
      } catch {
        this.configImportError = "Network error";
      }
    },
  };
}
