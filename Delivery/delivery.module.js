const form = document.getElementById("form");
const listEl = document.getElementById("lista");
const statusEl = document.getElementById("status");
const fields = ["pedido", "repartidor", "estado"];

function render(items) {
  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = "<p>Sin registros aun.</p>";
    return;
  }
  listEl.innerHTML = items
    .map((it) => `<article class="item"><strong>${it.pedido || "envio"}</strong><span>${fields.map((f) => String(it[f] ?? "")).join(" · ")}</span></article>`)
    .join("");
}

async function load() {
  statusEl.textContent = "Cargando...";
  const resp = await fetch("/api/delivery");
  const json = await resp.json();
  if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo listar.");
  render(json.data || []);
  statusEl.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Guardando...";
  const payload = Object.fromEntries(fields.map((f) => [f, document.getElementById(f).value.trim()]));
  try {
    const resp = await fetch("/api/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo guardar.");
    form.reset();
    await load();
    statusEl.textContent = "Registro guardado.";
  } catch (error) {
    statusEl.textContent = error.message || "Error al guardar.";
  }
});

load().catch((error) => {
  statusEl.textContent = error.message || "Error al cargar.";
});
