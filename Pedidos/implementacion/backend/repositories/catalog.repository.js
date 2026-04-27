const EMPTY_CATALOG = {
  categories: [{ id: "all", name: "Todos" }],
  products: [],
};

const EMPTY_STAFF = { waiters: [], couriers: [], zones: [] };

/**
 * Estructuras vacías; el catálogo operativo vive en Supabase (PWA: loadOperationalCatalog).
 */
export function getCatalogMock() {
  return structuredClone(EMPTY_CATALOG);
}

export function getStaffMock() {
  return structuredClone(EMPTY_STAFF);
}

export function getDeliveryPartnersMock() {
  return [];
}

export function getRecipeAvailabilityMock() {
  return {};
}

export function getKitchenBoardMock() {
  return [];
}

export function getTakeawayChatFeedMock() {
  return [];
}
