const form = document.getElementById("productoForm");
const listEl = document.getElementById("lista");
const statusEl = document.getElementById("status");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function render(items) {
  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = "<p>Sin productos aún.</p>";
    return;
  }
  listEl.innerHTML = items
    .map(
      (p) => `
      <article class="item">
        <strong>${p.nombre}</strong>
        <span>${money(p.precio)} · stock ${Number(p.stock || 0)} · ${p.categoria || "general"}</span>
      </article>
    `,
    )
    .join("");
}

async function load() {
  statusEl.textContent = "Cargando productos...";
  const resp = await fetch("/api/productos");
  const json = await resp.json();
  if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo listar productos.");
  render(json.data || []);
  statusEl.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Guardando...";
  const payload = {
    nombre: document.getElementById("nombre").value.trim(),
    precio: Number(document.getElementById("precio").value),
    stock: Number(document.getElementById("stock").value),
    categoria: document.getElementById("categoria").value.trim() || "general",
  };
  try {
    const resp = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo guardar.");
    form.reset();
    await load();
    statusEl.textContent = "Producto guardado.";
  } catch (error) {
    statusEl.textContent = error.message || "Error al guardar.";
  }
});

load().catch((error) => {
  statusEl.textContent = error.message || "Error al cargar.";
});
