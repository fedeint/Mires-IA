const form = document.getElementById("recetaForm");
const listEl = document.getElementById("lista");
const statusEl = document.getElementById("status");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function render(items) {
  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = "<p>Sin recetas aún.</p>";
    return;
  }
  listEl.innerHTML = items
    .map(
      (r) => `
      <article class="item">
        <strong>${r.nombre}</strong>
        <span>${money(r.costo)} · ${Number(r.porciones || 0)} porciones · ${r.categoria || "general"}</span>
      </article>
    `,
    )
    .join("");
}

async function load() {
  statusEl.textContent = "Cargando recetas...";
  const resp = await fetch("/api/recetas");
  const json = await resp.json();
  if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo listar recetas.");
  render(json.data || []);
  statusEl.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Guardando...";
  const payload = {
    nombre: document.getElementById("nombre").value.trim(),
    costo: Number(document.getElementById("costo").value),
    porciones: Number(document.getElementById("porciones").value),
    categoria: document.getElementById("categoria").value.trim() || "general",
  };
  try {
    const resp = await fetch("/api/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok || !json?.ok) throw new Error(json?.error || "No se pudo guardar.");
    form.reset();
    await load();
    statusEl.textContent = "Receta guardada.";
  } catch (error) {
    statusEl.textContent = error.message || "Error al guardar.";
  }
});

load().catch((error) => {
  statusEl.textContent = error.message || "Error al cargar.";
});
