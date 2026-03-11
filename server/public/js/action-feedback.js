/**
 * Action feedback toast system for DMXr.
 * Shows brief notifications for user-initiated actions with DMX status.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrActionFeedback() {
  return {
    actionToasts: [],
    _toastId: 0,

    showActionToast(result) {
      var id = ++this._toastId;
      var toast = {
        id: id,
        action: result.action || "action",
        success: result.success !== false,
        dmxStatus: result.dmxStatus || null,
        dmxError: result.dmxError || null,
        timestamp: Date.now(),
      };

      // Determine toast type: green (all ok), yellow (success but dmx error), red (http error)
      if (!toast.success) {
        toast.type = "error";
        toast.message = result.error || "Action failed";
      } else if (toast.dmxStatus === "error") {
        toast.type = "warning";
        toast.message = (result.action || "Action") + " sent — DMX write failed: " + (toast.dmxError || "unknown");
      } else {
        toast.type = "success";
        toast.message = (result.action || "Action") + " applied";
      }

      this.actionToasts = [toast].concat(this.actionToasts).slice(0, 5);

      var self = this;
      setTimeout(function () {
        self.actionToasts = self.actionToasts.filter(function (t) {
          return t.id !== id;
        });
      }, 3000);
    },

    async doAction(url, options, actionName) {
      try {
        var res = await fetch(url, options || {});
        var data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          this.showActionToast({
            action: actionName,
            success: false,
            error: data.error || "Request failed (" + res.status + ")",
          });
          return data;
        }
        // Only show toast if response includes dmxStatus (indicates a DMX-writing action)
        if (data.dmxStatus) {
          this.showActionToast({
            action: actionName,
            success: true,
            dmxStatus: data.dmxStatus,
            dmxError: data.dmxError,
          });
        }
        return data;
      } catch (err) {
        this.showActionToast({
          action: actionName,
          success: false,
          error: "Network error",
        });
        return null;
      }
    },
  };
}
