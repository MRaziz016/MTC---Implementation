/**
 * ServiceDesk Plus Cloud – Category / Sub Category / Item Visibility
 *
 * Ensures that when a technician creates or edits a ticket, only the
 * Category → Sub Category → Item values that belong to the selected
 * request type (Incident or Service Request) are shown.
 *
 * Request-type IDs used by SDP Cloud:
 *   Incident        → 1
 *   Service Request → 2
 */

const REQUEST_TYPE = {
  INCIDENT: "1",
  SERVICE_REQUEST: "2",
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch categories that are associated with the given request type.
 *
 * SDP Cloud API reference:
 *   GET /api/v3/categories
 *   filter: request_type.id equals <id>
 *
 * @param {string} baseUrl    e.g. "https://helpdesk.example.com"
 * @param {string} authToken  Technician API key / OAuth bearer token
 * @param {string} requestTypeId  "1" for Incident, "2" for SR
 * @returns {Promise<Array>}  Array of { id, name } category objects
 */
async function fetchCategories(baseUrl, authToken, requestTypeId) {
  const listInfo = JSON.stringify({
    row_count: 500,
    start_index: 0,
    search_criteria: [
      {
        field: "request_type.id",
        condition: "is",
        value: requestTypeId,
      },
    ],
  });

  const url = `${baseUrl}/api/v3/categories?input_data=${encodeURIComponent(
    JSON.stringify({ list_info: JSON.parse(listInfo) })
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authToken,
      Accept: "application/vnd.manageengine.sdp.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `fetchCategories failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return (data.categories ?? []).map((c) => ({ id: String(c.id), name: c.name }));
}

/**
 * Fetch subcategories for a given category, scoped to a request type.
 *
 * SDP Cloud API reference:
 *   GET /api/v3/subcategories
 *   filter: category.id equals <catId> AND request_type.id equals <typeId>
 *
 * @param {string} baseUrl
 * @param {string} authToken
 * @param {string} categoryId
 * @param {string} requestTypeId
 * @returns {Promise<Array>}  Array of { id, name }
 */
async function fetchSubcategories(baseUrl, authToken, categoryId, requestTypeId) {
  const inputData = {
    list_info: {
      row_count: 500,
      start_index: 0,
      search_criteria: [
        {
          field: "category.id",
          condition: "is",
          value: categoryId,
        },
        {
          field: "request_type.id",
          condition: "is",
          value: requestTypeId,
          logical_operator: "AND",
        },
      ],
    },
  };

  const url = `${baseUrl}/api/v3/subcategories?input_data=${encodeURIComponent(
    JSON.stringify(inputData)
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authToken,
      Accept: "application/vnd.manageengine.sdp.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `fetchSubcategories failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return (data.subcategories ?? []).map((s) => ({ id: String(s.id), name: s.name }));
}

/**
 * Fetch items for a given subcategory, scoped to a request type.
 *
 * SDP Cloud API reference:
 *   GET /api/v3/items
 *   filter: subcategory.id equals <subCatId> AND request_type.id equals <typeId>
 *
 * @param {string} baseUrl
 * @param {string} authToken
 * @param {string} subcategoryId
 * @param {string} requestTypeId
 * @returns {Promise<Array>}  Array of { id, name }
 */
async function fetchItems(baseUrl, authToken, subcategoryId, requestTypeId) {
  const inputData = {
    list_info: {
      row_count: 500,
      start_index: 0,
      search_criteria: [
        {
          field: "subcategory.id",
          condition: "is",
          value: subcategoryId,
        },
        {
          field: "request_type.id",
          condition: "is",
          value: requestTypeId,
          logical_operator: "AND",
        },
      ],
    },
  };

  const url = `${baseUrl}/api/v3/items?input_data=${encodeURIComponent(
    JSON.stringify(inputData)
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authToken,
      Accept: "application/vnd.manageengine.sdp.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `fetchItems failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return (data.items ?? []).map((i) => ({ id: String(i.id), name: i.name }));
}

// ---------------------------------------------------------------------------
// Dropdown population helpers
// ---------------------------------------------------------------------------

/**
 * Populate an HTML <select> element with options.
 * Always prepends a blank "--- Select ---" placeholder option.
 *
 * @param {HTMLSelectElement} selectEl
 * @param {Array<{id: string, name: string}>} options
 */
function populateSelect(selectEl, options) {
  selectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "--- Select ---";
  selectEl.appendChild(placeholder);

  options.forEach(({ id, name }) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}

/**
 * Clear and disable a <select> element.
 *
 * @param {HTMLSelectElement} selectEl
 */
function clearSelect(selectEl) {
  selectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "--- Select ---";
  selectEl.appendChild(placeholder);
  selectEl.disabled = true;
}

// ---------------------------------------------------------------------------
// Main controller
// ---------------------------------------------------------------------------

/**
 * CategoryVisibilityController
 *
 * Wires up the three dropdowns (category, subcategory, item) so that their
 * contents are always filtered to match the currently selected request type.
 *
 * Usage:
 *
 *   const controller = new CategoryVisibilityController({
 *     baseUrl:           "https://helpdesk.example.com",
 *     authToken:         "your-api-token",
 *     requestTypeSelectId: "request_type",   // id of the request-type <select>
 *     categorySelectId:    "category",        // id of the category <select>
 *     subcategorySelectId: "subcategory",     // id of the subcategory <select>
 *     itemSelectId:        "item",            // id of the item <select>
 *   });
 *
 *   controller.init();
 */
class CategoryVisibilityController {
  constructor({
    baseUrl,
    authToken,
    requestTypeSelectId,
    categorySelectId,
    subcategorySelectId,
    itemSelectId,
  }) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;

    this.requestTypeEl = document.getElementById(requestTypeSelectId);
    this.categoryEl = document.getElementById(categorySelectId);
    this.subcategoryEl = document.getElementById(subcategorySelectId);
    this.itemEl = document.getElementById(itemSelectId);

    if (
      !this.requestTypeEl ||
      !this.categoryEl ||
      !this.subcategoryEl ||
      !this.itemEl
    ) {
      throw new Error(
        "CategoryVisibilityController: one or more element IDs not found in DOM."
      );
    }
  }

  init() {
    this.requestTypeEl.addEventListener("change", () =>
      this._onRequestTypeChange()
    );
    this.categoryEl.addEventListener("change", () => this._onCategoryChange());
    this.subcategoryEl.addEventListener("change", () =>
      this._onSubcategoryChange()
    );

    // Trigger initial population if a request type is already selected
    const initial = this.requestTypeEl.value;
    if (initial) {
      this._onRequestTypeChange();
    } else {
      clearSelect(this.categoryEl);
      clearSelect(this.subcategoryEl);
      clearSelect(this.itemEl);
    }
  }

  async _onRequestTypeChange() {
    const requestTypeId = this.requestTypeEl.value;

    // Reset downstream dropdowns immediately
    clearSelect(this.subcategoryEl);
    clearSelect(this.itemEl);

    if (!requestTypeId) {
      clearSelect(this.categoryEl);
      return;
    }

    this.categoryEl.disabled = true;

    try {
      const categories = await fetchCategories(
        this.baseUrl,
        this.authToken,
        requestTypeId
      );
      populateSelect(this.categoryEl, categories);
      this.categoryEl.disabled = false;
    } catch (err) {
      console.error("Failed to load categories:", err);
      clearSelect(this.categoryEl);
    }
  }

  async _onCategoryChange() {
    const requestTypeId = this.requestTypeEl.value;
    const categoryId = this.categoryEl.value;

    clearSelect(this.itemEl);

    if (!categoryId) {
      clearSelect(this.subcategoryEl);
      return;
    }

    this.subcategoryEl.disabled = true;

    try {
      const subcategories = await fetchSubcategories(
        this.baseUrl,
        this.authToken,
        categoryId,
        requestTypeId
      );
      populateSelect(this.subcategoryEl, subcategories);
      this.subcategoryEl.disabled = false;
    } catch (err) {
      console.error("Failed to load subcategories:", err);
      clearSelect(this.subcategoryEl);
    }
  }

  async _onSubcategoryChange() {
    const requestTypeId = this.requestTypeEl.value;
    const subcategoryId = this.subcategoryEl.value;

    if (!subcategoryId) {
      clearSelect(this.itemEl);
      return;
    }

    this.itemEl.disabled = true;

    try {
      const items = await fetchItems(
        this.baseUrl,
        this.authToken,
        subcategoryId,
        requestTypeId
      );
      populateSelect(this.itemEl, items);
      this.itemEl.disabled = false;
    } catch (err) {
      console.error("Failed to load items:", err);
      clearSelect(this.itemEl);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports (works in both Node/module environments and plain browser scripts)
// ---------------------------------------------------------------------------

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CategoryVisibilityController,
    fetchCategories,
    fetchSubcategories,
    fetchItems,
    REQUEST_TYPE,
  };
}
