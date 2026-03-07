/**
 * Multi-select fixture management for DMXr.
 * Provides Ctrl+click / Shift+click selection on fixture cards and grid cells,
 * marquee drag-select on the DMX grid, and a floating action bar for batch
 * delete, duplicate, and group operations.
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

    // Marquee state
    marquee: null,       // { startX, startY, x, y, w, h } or null
    marqueeGridEl: null,  // cached ref to .channel-grid

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
      // Don't trigger selection at the end of a drag or marquee operation
      if (this.isDragging) return;
      if (this.marquee) return;
      var info = this.getFixtureAtChannel(ch);
      if (!info) return;
      this.toggleFixtureSelect(info.fixture.id, event);
    },

    selectAll: function() {
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

    // --- Marquee Drag Select on Grid ---

    onGridMousedown: function(event) {
      // Only start marquee on left-click, not during fixture drag
      if (event.button !== 0) return;
      if (this.isDragging) return;

      // Don't start marquee on a draggable fixture-start cell (let drag-drop handle it)
      var cell = event.target.closest(".channel-cell");
      if (cell && cell.draggable) return;

      var grid = event.currentTarget;
      this.marqueeGridEl = grid;

      var rect = grid.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;

      this.marquee = {
        startX: x,
        startY: y,
        x: x,
        y: y,
        w: 0,
        h: 0,
      };

      // Bind mousemove/mouseup to window so we track even outside the grid
      var self = this;
      this._marqueeMove = function(e) { self.onGridMarqueeMove(e); };
      this._marqueeUp = function(e) { self.onGridMarqueeUp(e); };
      window.addEventListener("mousemove", this._marqueeMove);
      window.addEventListener("mouseup", this._marqueeUp);

      event.preventDefault(); // prevent text selection
    },

    onGridMarqueeMove: function(event) {
      if (!this.marquee || !this.marqueeGridEl) return;

      var rect = this.marqueeGridEl.getBoundingClientRect();
      var curX = event.clientX - rect.left;
      var curY = event.clientY - rect.top;

      // Clamp to grid bounds
      curX = Math.max(0, Math.min(curX, rect.width));
      curY = Math.max(0, Math.min(curY, rect.height));

      var x = Math.min(this.marquee.startX, curX);
      var y = Math.min(this.marquee.startY, curY);
      var w = Math.abs(curX - this.marquee.startX);
      var h = Math.abs(curY - this.marquee.startY);

      this.marquee = {
        startX: this.marquee.startX,
        startY: this.marquee.startY,
        x: x,
        y: y,
        w: w,
        h: h,
      };
    },

    onGridMarqueeUp: function(event) {
      window.removeEventListener("mousemove", this._marqueeMove);
      window.removeEventListener("mouseup", this._marqueeUp);

      if (!this.marquee || !this.marqueeGridEl) {
        this.marquee = null;
        return;
      }

      var m = this.marquee;
      // Only process if dragged more than a few pixels (not just a click)
      if (m.w > 5 || m.h > 5) {
        this.resolveMarqueeSelection(event);
      }

      this.marquee = null;
      this.marqueeGridEl = null;
    },

    resolveMarqueeSelection: function(event) {
      if (!this.marqueeGridEl) return;

      var gridRect = this.marqueeGridEl.getBoundingClientRect();
      var m = this.marquee;

      // Marquee rect in viewport coords
      var mLeft = gridRect.left + m.x;
      var mTop = gridRect.top + m.y;
      var mRight = mLeft + m.w;
      var mBottom = mTop + m.h;

      // Find all cells that intersect the marquee
      var cells = this.marqueeGridEl.querySelectorAll(".channel-cell");
      var hitFixtureIds = {};

      for (var i = 0; i < cells.length; i++) {
        var cellRect = cells[i].getBoundingClientRect();
        // Check overlap
        if (cellRect.right > mLeft && cellRect.left < mRight &&
            cellRect.bottom > mTop && cellRect.top < mBottom) {
          var ch = parseInt(cells[i].dataset.address, 10);
          if (!isNaN(ch)) {
            var info = this.getFixtureAtChannel(ch);
            if (info) {
              hitFixtureIds[info.fixture.id] = true;
            }
          }
        }
      }

      var ids = Object.keys(hitFixtureIds);
      if (ids.length === 0) return;

      // Ctrl/Cmd: add to existing selection; otherwise replace
      if (event.ctrlKey || event.metaKey) {
        var merged = this.selectedFixtureIds.slice();
        for (var j = 0; j < ids.length; j++) {
          if (merged.indexOf(ids[j]) === -1) {
            merged.push(ids[j]);
          }
        }
        this.selectedFixtureIds = merged;
      } else {
        this.selectedFixtureIds = ids;
      }

      if (ids.length > 0) {
        this.lastSelectedFixtureId = ids[ids.length - 1];
      }
    },

    getMarqueeStyle: function() {
      if (!this.marquee) return "display:none";
      return "left:" + this.marquee.x + "px;" +
             "top:" + this.marquee.y + "px;" +
             "width:" + this.marquee.w + "px;" +
             "height:" + this.marquee.h + "px;";
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
