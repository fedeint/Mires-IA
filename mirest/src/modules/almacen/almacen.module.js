const form = document.getElementById("almacenForm");
const listEl = document.getElementById("lista");
const statusEl = document.getElementById("status");

function render(items) {
  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = "<p>Sin insumos aún.</p>";
    return;
  }
  listEl.innerHTML = items
    .map(
      (item) => `
      <article class="item">
        <strong>${item.nombre}</strong>
        <span>stock ${Number(item.stock || 0)} ${item.unidad || "u"} · mínimo ${Number(item.minimo || 0)}</span>
      </article>
    `,
    )
    .join("");
}

async function load() {
  statusEl.textContent = "Cargando almacen...";
  const resp = await fetch("/api/almacen");
  const json = await resp.json();
  if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo listar almacen.");
  render(json.data || []);
  statusEl.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Guardando...";
  const payload = {
    nombre: document.getElementById("nombre").value.trim(),
    stock: Number(document.getElementById("stock").value),
    unidad: document.getElementById("unidad").value.trim() || "u",
    minimo: Number(document.getElementById("minimo").value || 0),
  };
  try {
    const resp = await fetch("/api/almacen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo guardar.");
    form.reset();
    await load();
    statusEl.textContent = "Insumo guardado.";
  } catch (error) {
    statusEl.textContent = error.message || "Error al guardar.";
  }
});

load().catch((error) => {
  statusEl.textContent = error.message || "Error al cargar.";
});
