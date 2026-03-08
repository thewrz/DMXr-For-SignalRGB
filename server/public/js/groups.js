/**
 * Fixture group management for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrGroups() {
  return {
    // State
    groups: [],
    groupModalOpen: false,
    editingGroup: null,
    groupName: "",
    groupColor: "#4fc3f7",
    groupError: "",
    groupFixtureSelection: {},

    // Load groups from API
    async loadGroups() {
      try {
        var res = await fetch("/groups");
        if (res.ok) {
          var incoming = await res.json();
          if (JSON.stringify(this.groups) !== JSON.stringify(incoming)) {
            this.groups = incoming;
          }
        }
      } catch {
        // Non-critical
      }
    },

    // Open create modal
    openGroupModal() {
      this.editingGroup = null;
      this.groupName = "";
      this.groupColor = "#4fc3f7";
      this.groupError = "";
      this.groupFixtureSelection = {};
      // Pre-populate from selection if active
      if (this.selectedFixtureIds && this.selectedFixtureIds.length > 0) {
        var self = this;
        this.selectedFixtureIds.forEach(function(id) {
          self.groupFixtureSelection[id] = true;
        });
      }
      this.groupModalOpen = true;
    },

    // Open edit modal
    editGroup(group) {
      this.editingGroup = group;
      this.groupName = group.name;
      this.groupColor = group.color || "#4fc3f7";
      this.groupError = "";
      this.groupFixtureSelection = {};
      var self = this;
      group.fixtureIds.forEach(function(id) {
        self.groupFixtureSelection[id] = true;
      });
      this.groupModalOpen = true;
    },

    closeGroupModal() {
      this.groupModalOpen = false;
      this.editingGroup = null;
      this.groupError = "";
    },

    // Save group (create or update)
    async saveGroup() {
      var name = this.groupName.trim();
      if (!name) {
        this.groupError = "Name is required";
        return;
      }

      var fixtureIds = [];
      var self = this;
      Object.keys(this.groupFixtureSelection).forEach(function(id) {
        if (self.groupFixtureSelection[id]) fixtureIds.push(id);
      });

      try {
        if (this.editingGroup) {
          var res = await fetch("/groups/" + this.editingGroup.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, fixtureIds: fixtureIds, color: this.groupColor }),
          });
          if (!res.ok) {
            var err = await res.json().catch(function() { return {}; });
            this.groupError = err.error || "Update failed";
            return;
          }
        } else {
          var res = await fetch("/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, fixtureIds: fixtureIds, color: this.groupColor }),
          });
          if (!res.ok) {
            var err = await res.json().catch(function() { return {}; });
            this.groupError = err.error || "Create failed";
            return;
          }
        }

        this.closeGroupModal();
        await this.loadGroups();
      } catch {
        this.groupError = "Network error";
      }
    },

    // Delete group
    async deleteGroup(groupId) {
      if (!confirm("Delete this group? Fixtures will not be affected.")) return;
      try {
        await fetch("/groups/" + groupId, { method: "DELETE" });
        await this.loadGroups();
      } catch (err) {
        console.warn("DMXr: deleteGroup failed:", err);
      }
    },

    // Bulk operations
    async groupBlackout(groupId) {
      try {
        await fetch("/groups/" + groupId + "/blackout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch (err) {
        console.warn("DMXr: groupBlackout failed:", err);
      }
    },

    async groupWhiteout(groupId) {
      try {
        await fetch("/groups/" + groupId + "/whiteout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch (err) {
        console.warn("DMXr: groupWhiteout failed:", err);
      }
    },

    async groupFlash(groupId) {
      try {
        await fetch("/groups/" + groupId + "/flash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMs: 500 }),
        });
      } catch (err) {
        console.warn("DMXr: groupFlash failed:", err);
      }
    },

    async groupResume(groupId) {
      try {
        await fetch("/groups/" + groupId + "/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch (err) {
        console.warn("DMXr: groupResume failed:", err);
      }
    },

    // Helper: get groups for a fixture (for badge display)
    getFixtureGroups(fixtureId) {
      return this.groups.filter(function(g) {
        return g.fixtureIds.indexOf(fixtureId) !== -1;
      });
    },

    // Helper: is fixture in this group
    isFixtureInGroup(fixtureId, groupId) {
      var group = this.groups.find(function(g) { return g.id === groupId; });
      return group ? group.fixtureIds.indexOf(fixtureId) !== -1 : false;
    },
  };
}
