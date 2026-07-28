(function () {
  const tpl = document.createElement("template");
  tpl.innerHTML = `
    <style>
      form { display: flex; flex-direction: column; gap: 10px; font-family: "72", Arial, sans-serif; font-size: 12px; color: #32363a; }
      .row { display: flex; flex-direction: column; gap: 3px; }
      .check { flex-direction: row; align-items: center; gap: 6px; }
      input[type="text"] { padding: 4px 6px; border: 1px solid #c8ced4; border-radius: 4px; }
      label { color: #6a6d70; }
      button { align-self: flex-start; padding: 5px 10px; border: 1px solid #0a6ed1; background: #0a6ed1; color: #fff; border-radius: 4px; cursor: pointer; }
    </style>
    <form id="form">
      <div class="row check"><input id="planningEnabled" type="checkbox" /><label for="planningEnabled">Enable planning (editable cells)</label></div>
      <div class="row check"><input id="autoSubmit" type="checkbox" /><label for="autoSubmit">Write back immediately on cell change</label></div>
      <div class="row check"><input id="showInputControls" type="checkbox" /><label for="showInputControls">Show dimension input controls</label></div>
      <div class="row check"><input id="linkedAnalysisEnabled" type="checkbox" /><label for="linkedAnalysisEnabled">Publish selection via linked analysis</label></div>
      <div class="row">
        <label for="inputControlDimensions">Input control dimensions (comma separated ids, empty = all)</label>
        <input id="inputControlDimensions" type="text" />
      </div>
      <button type="submit">Apply</button>
    </form>
  `;

  class Builder extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(tpl.content.cloneNode(true));
      this._shadowRoot.getElementById("form").addEventListener("submit", (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("propertiesChanged", {
          detail: {
            properties: {
              planningEnabled: this.planningEnabled,
              autoSubmit: this.autoSubmit,
              showInputControls: this.showInputControls,
              linkedAnalysisEnabled: this.linkedAnalysisEnabled,
              inputControlDimensions: this.inputControlDimensions,
            },
          },
        }));
      });
    }

    _cb(id) { return this._shadowRoot.getElementById(id); }

    set planningEnabled(v) { this._cb("planningEnabled").checked = !!v; }
    get planningEnabled() { return this._cb("planningEnabled").checked; }
    set autoSubmit(v) { this._cb("autoSubmit").checked = !!v; }
    get autoSubmit() { return this._cb("autoSubmit").checked; }
    set showInputControls(v) { this._cb("showInputControls").checked = !!v; }
    get showInputControls() { return this._cb("showInputControls").checked; }
    set linkedAnalysisEnabled(v) { this._cb("linkedAnalysisEnabled").checked = !!v; }
    get linkedAnalysisEnabled() { return this._cb("linkedAnalysisEnabled").checked; }
    set inputControlDimensions(v) { this._cb("inputControlDimensions").value = v || ""; }
    get inputControlDimensions() { return this._cb("inputControlDimensions").value; }
  }

  customElements.define("com-custom-planning-table-builder", Builder);
})();
