/**
 * Batch operations on selected fixtures: delete, duplicate, group, and move.
 * Depends on selection state from selection-core.js.
 * Mixed into the main Alpine component via the selection.js aggregator.
 */
function dmxrSelectionActions() {
  return {
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
      // Smart default: if one group detected and there are ungrouped fixtures, pre-select it
      var info = this.selectionGroupInfo;
      if (info.detectedGroups.length === 1 && info.ungroupedIds.length > 0) {
        this.groupFromSelectionTarget = info.detectedGroups[0].id;
      }
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

    // --- Batch Move ---

    async batchMoveFixtures(moves) {
      try {
        var res = await fetch("/fixtures/batch-move", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moves: moves }),
        });
        if (res.ok) {
          this.clearSelection();
          await this.loadFixtures();
        } else {
          var err = await res.json().catch(function() { return {}; });
          this.showGridError(err.error || "Move failed");
        }
      } catch {
        this.showGridError("Network error");
      }
    },
  };
}
