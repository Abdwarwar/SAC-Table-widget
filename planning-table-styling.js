(function () {
  const tpl = document.createElement("template");
  tpl.innerHTML = `
    <style>
      form { display: flex; flex-direction: column; gap: 10px; font-family: "72", Arial, sans-serif; font-size: 12px; color: #32363a; }
      .row { display: flex; flex-direction: column; gap: 3px; }
      label { color: #6a6d70; }
      input { padding: 3px 5px; border: 1px solid #c8ced4; border-radius: 4px; }
      button { align-self: flex-start; padding: 5px 10px; border: 1px solid #0a6ed1; background: #0a6ed1; color: #fff; border-radius: 4px; cursor: pointer; }
    </style>
    <form id="form">
      <div class="row"><label for="headerColor">Header background</label><input id="headerColor" type="color" /></div>
      <div class="row"><label for="accentColor">Accent colour</label><input id="accentColor" type="color" /></div>
      <div class="row"><label for="fontSize">Font size (px)</label><input id="fontSize" type="number" min="9" max="24" /></div>
      <button type="submit">Apply</button>
    </form>
  `;

  class Styling extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(tpl.content.cloneNode(true));
      this._shadowRoot.getElementById("form").addEventListener("submit", (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("propertiesChanged", {
          detail: {
            properties: {
              headerColor: this.headerColor,
              accentColor: this.accentColor,
              fontSize: this.fontSize,
            },
          },
        }));
      });
    }

    _el(id) { return this._shadowRoot.getElementById(id); }

    set headerColor(v) { this._el("headerColor").value = v || "#f2f4f7"; }
    get headerColor() { return this._el("headerColor").value; }
    set accentColor(v) { this._el("accentColor").value = v || "#0a6ed1"; }
    get accentColor() { return this._el("accentColor").value; }
    set fontSize(v) { this._el("fontSize").value = v || 13; }
    get fontSize() { return parseInt(this._el("fontSize").value, 10) || 13; }
  }

  if (!customElements.get("com-custom-planning-table-styling")) {
    customElements.define("com-custom-planning-table-styling", Styling);
  }
})();
