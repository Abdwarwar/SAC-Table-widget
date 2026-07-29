(function () {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host { display: block; width: 100%; height: 100%; }
      .wrap {
        display: flex; flex-direction: column; height: 100%; box-sizing: border-box;
        font-family: "72", "72full", Arial, Helvetica, sans-serif;
        color: #32363a; background: #fff;
      }
      .controls {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end;
        padding: 8px; border-bottom: 1px solid #e5e5e5; background: #fafafa;
      }
      .control { display: flex; flex-direction: column; gap: 2px; }
      .control label { font-size: 11px; color: #6a6d70; }
      .control select {
        min-width: 140px; padding: 4px 6px; border: 1px solid #c8ced4;
        border-radius: 4px; background: #fff; font-size: 12px; color: inherit;
      }
      td select.rowic {
        width: 100%; min-width: 120px; padding: 2px 4px; border: 1px solid #c8ced4;
        border-radius: 4px; background: #fff; font-size: inherit; color: inherit;
      }
      td select.rowic:focus { outline: 2px solid var(--accent, #0a6ed1); outline-offset: -2px; }
      td.rowcontrol { padding: 3px 5px; }
      .spacer { flex: 1 1 auto; }
      .actions { display: flex; gap: 6px; align-items: center; }
      button {
        border: 1px solid #c8ced4; background: #fff; color: #32363a;
        padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;
      }
      button.primary { background: var(--accent, #0a6ed1); border-color: var(--accent, #0a6ed1); color: #fff; }
      button:disabled { opacity: .5; cursor: default; }
      .scroll { flex: 1 1 auto; overflow: auto; }
      table { border-collapse: collapse; width: 100%; font-size: var(--fs, 13px); }
      th, td { border: 1px solid #e5e5e5; padding: 5px 8px; text-align: left; white-space: nowrap; }
      thead th { position: sticky; top: 0; background: var(--headerBg, #f2f4f7); font-weight: 600; z-index: 1; }
      td.measure { text-align: right; font-variant-numeric: tabular-nums; }
      td.editable { background: #fffdf5; cursor: text; }
      td.editable:focus { outline: 2px solid var(--accent, #0a6ed1); outline-offset: -2px; background: #fff; }
      td.dirty { background: #eaf5ea; font-weight: 600; }
      td.error { background: #ffe6e6; }
      tbody tr:hover td { background: #f7f9fb; }
      tbody tr:hover td.dirty { background: #e2f0e2; }
      .status { font-size: 11px; color: #6a6d70; padding: 4px 8px; border-top: 1px solid #e5e5e5; }
      .empty { padding: 24px; color: #6a6d70; font-size: 13px; }
    </style>
    <div class="wrap">
      <div class="controls" id="controls"></div>
      <div class="scroll">
        <div class="empty" id="empty">No data bound. Add dimensions and measures in the Builder Panel.</div>
        <table id="table" style="display:none"><thead id="thead"></thead><tbody id="tbody"></tbody></table>
      </div>
      <div class="status" id="status"></div>
    </div>
  `;

  class PlanningTable extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));
      this._pending = {};
      this._selection = {};
      this._rowOverrides = {};
      this._rows = [];
      this._dimensions = [];
      this._measures = [];

      this.planningEnabled = true;
      this.autoSubmit = true;
      this.showInputControls = true;
      this.inputControlDimensions = "";
      this.rowInputControls = true;
      this.rowInputControlDimensions = "";
      this.linkedAnalysisEnabled = true;
      this.headerColor = "#f2f4f7";
      this.accentColor = "#0a6ed1";
      this.fontSize = 13;

      this.$controls = this._shadowRoot.getElementById("controls");
      this.$table = this._shadowRoot.getElementById("table");
      this.$thead = this._shadowRoot.getElementById("thead");
      this.$tbody = this._shadowRoot.getElementById("tbody");
      this.$status = this._shadowRoot.getElementById("status");
      this.$empty = this._shadowRoot.getElementById("empty");
    }

    onCustomWidgetBeforeUpdate(changedProps) {
      this._pendingProps = changedProps;
    }

    onCustomWidgetAfterUpdate(changedProps) {
      Object.keys(changedProps).forEach((k) => { this[k] = changedProps[k]; });
      this._render();
    }

    onCustomWidgetResize() {}

    onCustomWidgetDestroy() { this._pending = {}; }

    set myDataSource(ds) { this._dataSource = ds; this._render(); }
    get myDataSource() { return this._dataSource; }

    _getBinding() {
      try {
        return this.dataBindings && this.dataBindings.getDataBinding
          ? this.dataBindings.getDataBinding("myDataBinding")
          : null;
      } catch (e) { return null; }
    }

    _readData() {
      const binding = this._getBinding();
      const ds = (binding && binding.getDataSource && binding.getDataSource()) || this._dataSource;
      if (!ds || ds.state !== "success") { this._rows = []; return; }
      this._ds = ds;
      this._dimensions = ds.metadata.feeds.dimensions.values.map((id) =>
        Object.assign({ id: id }, ds.metadata.dimensions[id]));
      this._measures = ds.metadata.feeds.measures.values.map((id) =>
        Object.assign({ id: id }, ds.metadata.mainStructureMembers[id]));
      this._rows = ds.data || [];
    }

    _render() {
      this._shadowRoot.host.style.setProperty("--headerBg", this.headerColor);
      this._shadowRoot.host.style.setProperty("--accent", this.accentColor);
      this._shadowRoot.host.style.setProperty("--fs", this.fontSize + "px");

      this._readData();

      const hasData = this._rows.length > 0 && this._measures.length > 0;
      this.$empty.style.display = hasData ? "none" : "block";
      this.$table.style.display = hasData ? "table" : "none";

      this._renderControls();
      if (!hasData) { this.$status.textContent = ""; return; }

      const indexed = this._rows.map((row, i) => ({ row: row, index: i }));
      const visibleRows = indexed.filter((entry) =>
        this._dimensions.every((d) => {
          const sel = this._selection[d.id];
          if (!sel) return true;
          return this._effMemberId(entry.row, entry.index, d.id) === sel;
        })
      );

      this.$thead.innerHTML =
        "<tr>" +
        this._dimensions.map((d) => "<th>" + this._esc(d.description || d.id) + "</th>").join("") +
        this._measures.map((m) => '<th style="text-align:right">' + this._esc(m.label || m.id) + "</th>").join("") +
        "</tr>";

      this.$tbody.innerHTML = "";
      const rowDims = this._rowControlDimensions();
      visibleRows.forEach((entry) => {
        const row = entry.row;
        const rowIndex = entry.index;
        const tr = document.createElement("tr");
        this._dimensions.forEach((d) => {
          const td = document.createElement("td");
          const memberId = this._effMemberId(row, rowIndex, d.id);
          if (rowDims.indexOf(d.id) >= 0) {
            td.className = "rowcontrol";
            const select = document.createElement("select");
            select.className = "rowic";
            select.innerHTML = this._members(d.id)
              .map((m) =>
                '<option value="' + this._esc(m.id) + '">' +
                this._esc(m.description || m.label || m.id) + "</option>")
              .join("");
            select.value = memberId || "";
            select.addEventListener("change", () => {
              if (!this._rowOverrides[rowIndex]) this._rowOverrides[rowIndex] = {};
              this._rowOverrides[rowIndex][d.id] = select.value;
              this._fire("onRowInputControlChange", {
                rowIndex: rowIndex, dimension: d.id, member: select.value,
              });
              this._render();
            });
            td.appendChild(select);
          } else {
            const member = this._memberById(d.id, memberId);
            td.textContent = (member && (member.description || member.label || member.id)) || "";
          }
          tr.appendChild(td);
        });
        const sourceRow = this._resolveRow(row, rowIndex) || {};
        this._measures.forEach((m) => {
          const cell = sourceRow[m.id] || {};
          const td = document.createElement("td");
          td.className = "measure";
          const key = this._cellKey(row, m.id, rowIndex);
          const pending = this._pending[key];
          td.textContent = pending
            ? String(pending.value)
            : (cell.formatted != null ? cell.formatted : (cell.raw != null ? cell.raw : ""));
          if (pending) td.classList.add("dirty");
          if (this.planningEnabled) {
            td.classList.add("editable");
            td.setAttribute("contenteditable", "true");
            td.dataset.key = key;
            td.addEventListener("focus", () => {
              const p = this._pending[key];
              td.textContent = p ? String(p.value) : (cell.raw != null ? String(cell.raw) : "");
              this._fire("onCellSelect", { rowIndex: rowIndex, measureId: m.id });
            });
            td.addEventListener("keydown", (e) => {
              if (e.key === "Enter") { e.preventDefault(); td.blur(); }
              if (e.key === "Escape") { td.textContent = cell.formatted || ""; td.blur(); }
            });
            td.addEventListener("blur", () => this._commitCell(td, row, m, cell));
            td.dataset.rowIndex = String(rowIndex);
          }
          tr.appendChild(td);
        });
        this.$tbody.appendChild(tr);
      });

      this._updateStatus(visibleRows.length);
    }

    _renderControls() {
      this.$controls.style.display = this.showInputControls ? "flex" : "none";
      if (!this.showInputControls) return;

      const wanted = (this.inputControlDimensions || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
      const dims = wanted.length
        ? this._dimensions.filter((d) => wanted.indexOf(d.id) >= 0 || wanted.indexOf(d.description) >= 0)
        : this._dimensions;

      this.$controls.innerHTML = "";
      dims.forEach((d) => {
        const members = this._members(d.id);
        const holder = document.createElement("div");
        holder.className = "control";
        const label = document.createElement("label");
        label.textContent = d.description || d.id;
        const select = document.createElement("select");
        select.innerHTML =
          '<option value="">(All)</option>' +
          members.map((m) =>
            '<option value="' + this._esc(m.id) + '">' +
            this._esc(m.description || m.label || m.id) + "</option>").join("");
        select.value = this._selection[d.id] || "";
        select.addEventListener("change", () => {
          if (select.value) this._selection[d.id] = select.value;
          else delete this._selection[d.id];
          this._applyLinkedAnalysis();
          this._fire("onInputControlChange", { dimension: d.id, member: select.value });
          this._render();
        });
        holder.appendChild(label);
        holder.appendChild(select);
        this.$controls.appendChild(holder);
      });

      const spacer = document.createElement("div");
      spacer.className = "spacer";
      this.$controls.appendChild(spacer);

      if (this.planningEnabled) {
        const actions = document.createElement("div");
        actions.className = "actions";
        const count = Object.keys(this._pending).length;
        const submit = document.createElement("button");
        submit.className = "primary";
        submit.textContent = count ? "Publish (" + count + ")" : "Publish";
        submit.disabled = count === 0;
        submit.addEventListener("click", () => this.submitPlanningData());
        const discard = document.createElement("button");
        discard.textContent = "Discard";
        discard.disabled = count === 0;
        discard.addEventListener("click", () => this.discardPlanningData());
        actions.appendChild(submit);
        actions.appendChild(discard);
        this.$controls.appendChild(actions);
      }
    }

    _commitCell(td, row, measure, cell) {
      const key = td.dataset.key;
      const rowIndex = Number(td.dataset.rowIndex);
      const text = (td.textContent || "").trim().replace(/\s/g, "").replace(/,/g, ".");
      const original = cell.raw != null ? Number(cell.raw) : 0;
      if (text === "") { delete this._pending[key]; this._render(); return; }
      const value = Number(text);
      if (!isFinite(value)) {
        td.classList.add("error");
        setTimeout(() => this._render(), 800);
        return;
      }
      if (value === original && !this._pending[key]) { this._render(); return; }

      const selection = { "@MeasureDimension": measure.id };
      this._dimensions.forEach((d) => {
        const id = this._effMemberId(row, rowIndex, d.id);
        if (id) selection[d.id] = id;
      });

      this._pending[key] = { selection: selection, value: value, oldValue: original, measureId: measure.id };
      this._fire("onValueChange", {
        measureId: measure.id, oldValue: original, newValue: value, selection: selection,
      });

      if (this.autoSubmit) this.submitPlanningData();
      else this._render();
    }

    async submitPlanningData() {
      const keys = Object.keys(this._pending);
      if (!keys.length) return true;
      const planning = this._ds && this._ds.getPlanning && this._ds.getPlanning();
      if (!planning) {
        this._fire("onSubmitError", { message: "Data source is not planning enabled" });
        this.$status.textContent = "Writeback failed: data source is not planning enabled.";
        return false;
      }
      try {
        keys.forEach((k) => {
          const p = this._pending[k];
          planning.setUserInput(p.selection, String(p.value));
        });
        await planning.submitData();
        this._pending = {};
        this._fire("onDataSubmitted", { count: keys.length });
        this.$status.textContent = keys.length + " value(s) written to the model.";
        this._render();
        return true;
      } catch (err) {
        const msg = String((err && err.message) || err);
        this._fire("onSubmitError", { message: msg });
        this.$status.textContent = "Writeback failed: " + msg;
        return false;
      }
    }

    discardPlanningData() {
      this._pending = {};
      this.$status.textContent = "Pending changes discarded.";
      this._render();
    }

    getPendingChanges() { return JSON.stringify(this._pending); }

    getSelectedMembers() { return JSON.stringify(this._selection); }

    clearInputControls() {
      this._selection = {};
      this._rowOverrides = {};
      this._applyLinkedAnalysis();
      this._render();
    }

    _applyLinkedAnalysis() {
      if (!this.linkedAnalysisEnabled) return;
      const binding = this._getBinding();
      const la = binding && binding.getLinkedAnalysis && binding.getLinkedAnalysis();
      if (!la) return;
      try {
        if (!Object.keys(this._selection).length) la.removeFilters();
        else la.setFilters(this._selection);
      } catch (e) {}
    }

    _cellKey(row, measureId, rowIndex) {
      return this._dimensions
        .map((d) => this._effMemberId(row, rowIndex, d.id) || "")
        .join("|") + "||" + measureId;
    }

    _rowControlDimensions() {
      if (!this.rowInputControls) return [];
      const wanted = (this.rowInputControlDimensions || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
      return this._dimensions
        .filter((d) => !wanted.length || wanted.indexOf(d.id) >= 0 || wanted.indexOf(d.description) >= 0)
        .map((d) => d.id);
    }

    _members(dimId) {
      const members = [];
      const seen = {};
      this._rows.forEach((r) => {
        const m = r[dimId];
        if (m && !seen[m.id]) { seen[m.id] = 1; members.push(m); }
      });
      return members;
    }

    _memberById(dimId, id) {
      const list = this._members(dimId);
      for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }

    _effMemberId(row, rowIndex, dimId) {
      const ov = this._rowOverrides[rowIndex];
      if (ov && ov[dimId]) return ov[dimId];
      return row[dimId] ? row[dimId].id : "";
    }

    _resolveRow(row, rowIndex) {
      const ov = this._rowOverrides[rowIndex];
      if (!ov || !Object.keys(ov).length) return row;
      for (let i = 0; i < this._rows.length; i++) {
        const candidate = this._rows[i];
        const match = this._dimensions.every((d) => {
          const wanted = this._effMemberId(row, rowIndex, d.id);
          return candidate[d.id] && candidate[d.id].id === wanted;
        });
        if (match) return candidate;
      }
      return null;
    }

    _updateStatus(visible) {
      const pending = Object.keys(this._pending).length;
      this.$status.textContent =
        visible + " row(s)" + (pending ? " · " + pending + " unpublished change(s)" : "") +
        (this.planningEnabled ? "" : " · read only");
    }

    _esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    }

    _fire(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }
  }

  if (!customElements.get("com-custom-planning-table")) {
    customElements.define("com-custom-planning-table", PlanningTable);
  }
})();
