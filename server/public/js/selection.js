/**
 * Multi-select fixture management for DMXr.
 * Provides Ctrl+click / Shift+click selection on fixture cards and grid cells,
 * with a floating action bar for batch delete, duplicate, and group operations.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrSelection() {
  return {
    // Selection state
    selectedFixtureIds: [],
    lastSelectedFixtureId: null,
    batchDeleteModalOpen: false,
    groupFromSelectionOpen: false,
    groupFromSelectionTarget: "new",
    groupFromSelectionName: "",
    selectionError: "",

    // Computed-like helpers
    get hasSelection() {
      return this.selectedFixtureIds.length > 0;
    },

    get selectionCount() {
      return this.selectedFixtureIds.length;
    },

    isSelected: function(id) {
      return this.selectedFixtureIds.indexOf(id) !== -1;
    },

    toggleFixtureSelect: function(id, event) {
      // Ctrl/Cmd+click: toggle individual
      if (event && (event.ctrlKey || event.metaKey)) {
        if (this.isSelected(id)) {
          this.selectedFixtureIds = this.selectedFixtureIds.filter(function(fid) { return fid !== id; });
        } else {
          this.selectedFixtureIds = this.selectedFixtureIds.concat([id]);
        }
        this.lastSelectedFixtureId = id;
        return;
      }

      // Shift+click: range select
      if (event && event.shiftKey && this.lastSelectedFixtureId) {
        var anchorIdx = -1;
        var targetIdx = -1;
        for (var i = 0; i < this.fixtures.length; i++) {
          if (this.fixtures[i].id === this.lastSelectedFixtureId) anchorIdx = i;
          if (this.fixtures[i].id === id) targetIdx = i;
        }
        if (anchorIdx !== -1 && targetIdx !== -1) {
          var start = Math.min(anchorIdx, targetIdx);
          var end = Math.max(anchorIdx, targetIdx);
          var rangeIds = [];
          for (var j = start; j <= end; j++) {
            rangeIds.push(this.fixtures[j].id);
          }
          this.selectedFixtureIds = rangeIds;
          return;
        }
      }

      // Plain click: replace selection with single fixture
      this.selectedFixtureIds = [id];
      this.lastSelectedFixtureId = id;
    },

    selectGridFixture: function(ch, event) {
      var info = this.getFixtureAtChannel(ch);
      if (!info) return;
      this.toggleFixtureSelect(info.fixture.id, event);
    },

    selectAll: function() {
      var self = this;
      this.selectedFixtureIds = this.fixtures.map(function(f) { return f.id; });
      if (this.fixtures.length > 0) {
        this.lastSelectedFixtureId = this.fixtures[0].id;
      }
    },

    clearSelection: function() {
      this.selectedFixtureIds = [];
      this.lastSelectedFixtureId = null;
      this.groupFromSelectionOpen = false;
      this.batchDeleteModalOpen = false;
      this.selectionError = "";
    },

    // Prune stale selection IDs when fixtures reload
    pruneSelection: function() {
      if (this.selectedFixtureIds.length === 0) return;
      var fixtureIds = {};
      for (var i = 0; i < this.fixtures.length; i++) {
        fixtureIds[this.fixtures[i].id] = true;
      }
      this.selectedFixtureIds = this.selectedFixtureIds.filter(function(id) {
        return fixtureIds[id];
      });
    },

    // --- Batch Delete ---

    openBatchDeleteModal: function() {
      this.selectionError = "";
      this.batchDeleteModalOpen = true;
    },

    async confirmBatchDelete() {
      try {
        var res = await fetch("/fixtures/batch", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: this.selectedFixtureIds }),
        });
        if (res.ok) {
          this.clearSelection();
          await this.loadFixtures();
          await this.loadGroups();
        } else {
          var err = await res.json().catch(function() { return {}; });
          this.selectionError = err.error || "Batch delete failed";
        }
      } catch {
        this.selectionError = "Network error";
      }
      this.batchDeleteModalOpen = false;
    },

    // --- Batch Duplicate ---

    async batchDuplicate() {
      this.selectionError = "";
      try {
        var payload = { ids: this.selectedFixtureIds };
        if (this.selectedUniverseId) {
          payload.universeId = this.selectedUniverseId;
        }
        var res = await fetch("/fixtures/batch-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          this.clearSelection();
          await this.loadFixtures();
        } else {
          var err = await res.json().catch(function() { return {}; });
          this.selectionError = err.error || "Batch duplicate failed";
          if (this.selectionError) {
            this.showGridError(this.selectionError);
          }
        }
      } catch {
        this.showGridError("Network error");
      }
    },

    // --- Group from Selection ---

    openGroupFromSelection: function() {
      this.groupFromSelectionTarget = "new";
      this.groupFromSelectionName = "";
      this.selectionError = "";
      this.groupFromSelectionOpen = true;
    },

    async confirmGroupFromSelection() {
      var self = this;
      this.selectionError = "";

      try {
        if (this.groupFromSelectionTarget === "new") {
          var name = this.groupFromSelectionName.trim();
          if (!name) {
            this.selectionError = "Group name is required";
            return;
          }
          var res = await fetch("/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name,
              fixtureIds: this.selectedFixtureIds,
            }),
          });
          if (!res.ok) {
            var err = await res.json().catch(function() { return {}; });
            this.selectionError = err.error || "Failed to create group";
            return;
          }
        } else {
          // Add to existing group
          var group = this.groups.find(function(g) {
            return g.id === self.groupFromSelectionTarget;
          });
          if (!group) {
            this.selectionError = "Group not found";
            return;
          }

          // Merge fixture IDs (avoid duplicates)
          var merged = group.fixtureIds.slice();
          for (var i = 0; i < this.selectedFixtureIds.length; i++) {
            if (merged.indexOf(this.selectedFixtureIds[i]) === -1) {
              merged.push(this.selectedFixtureIds[i]);
            }
          }

          var res2 = await fetch("/groups/" + group.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixtureIds: merged }),
          });
          if (!res2.ok) {
            var err2 = await res2.json().catch(function() { return {}; });
            this.selectionError = err2.error || "Failed to update group";
            return;
          }
        }

        this.groupFromSelectionOpen = false;
        this.clearSelection();
        await this.loadGroups();
      } catch {
        this.selectionError = "Network error";
      }
    },

    // --- Keyboard Shortcuts ---

    onSelectionKeydown: function(event) {
      var tag = event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) {
        return;
      }

      if (event.key === "Escape") {
        this.clearSelection();
        return;
      }

      if (event.key === "Delete" && this.hasSelection) {
        event.preventDefault();
        this.openBatchDeleteModal();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        event.preventDefault();
        this.selectAll();
      }
    },

    // Helper: get selected fixture objects
    getSelectedFixtures: function() {
      var self = this;
      return this.selectedFixtureIds
        .map(function(id) { return self.fixtures.find(function(f) { return f.id === id; }); })
        .filter(function(f) { return f !== undefined; });
    },
  };
}
