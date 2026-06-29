/**
 * Unit tests for categoryVisibility.js
 * Run with: node --experimental-vm-modules src/categoryVisibility.test.js
 * (or any test runner that supports CommonJS)
 */

const {
  fetchCategories,
  fetchSubcategories,
  fetchItems,
  REQUEST_TYPE,
  CategoryVisibilityController,
} = require("./categoryVisibility");

// ---------------------------------------------------------------------------
// Minimal fetch mock
// ---------------------------------------------------------------------------

function makeFetchMock(responseMap) {
  return async (url) => {
    for (const [pattern, payload] of Object.entries(responseMap)) {
      if (url.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          json: async () => payload,
        };
      }
    }
    return { ok: false, status: 404, statusText: "Not Found" };
  };
}

// ---------------------------------------------------------------------------
// API tests
// ---------------------------------------------------------------------------

async function testFetchCategoriesIncident() {
  global.fetch = makeFetchMock({
    "/api/v3/categories": {
      categories: [
        { id: 10, name: "Hardware" },
        { id: 11, name: "Network" },
      ],
    },
  });

  const results = await fetchCategories(
    "https://sdp.example.com",
    "token123",
    REQUEST_TYPE.INCIDENT
  );

  assert(results.length === 2, "Should return 2 categories");
  assert(results[0].id === "10", "ID should be stringified");
  assert(results[0].name === "Hardware", "Name should match");
  console.log("PASS testFetchCategoriesIncident");
}

async function testFetchCategoriesServiceRequest() {
  global.fetch = makeFetchMock({
    "/api/v3/categories": {
      categories: [{ id: 20, name: "Software Request" }],
    },
  });

  const results = await fetchCategories(
    "https://sdp.example.com",
    "token123",
    REQUEST_TYPE.SERVICE_REQUEST
  );

  assert(results.length === 1, "Should return 1 SR category");
  assert(results[0].name === "Software Request", "Name should match");
  console.log("PASS testFetchCategoriesServiceRequest");
}

async function testFetchSubcategories() {
  global.fetch = makeFetchMock({
    "/api/v3/subcategories": {
      subcategories: [
        { id: 30, name: "Laptop" },
        { id: 31, name: "Desktop" },
      ],
    },
  });

  const results = await fetchSubcategories(
    "https://sdp.example.com",
    "token123",
    "10",
    REQUEST_TYPE.INCIDENT
  );

  assert(results.length === 2, "Should return 2 subcategories");
  assert(results[1].name === "Desktop", "Second subcategory should be Desktop");
  console.log("PASS testFetchSubcategories");
}

async function testFetchItems() {
  global.fetch = makeFetchMock({
    "/api/v3/items": {
      items: [{ id: 50, name: "Screen Replacement" }],
    },
  });

  const results = await fetchItems(
    "https://sdp.example.com",
    "token123",
    "30",
    REQUEST_TYPE.INCIDENT
  );

  assert(results.length === 1, "Should return 1 item");
  assert(results[0].name === "Screen Replacement", "Item name should match");
  console.log("PASS testFetchItems");
}

async function testFetchCategoriesApiError() {
  global.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
  });

  try {
    await fetchCategories("https://sdp.example.com", "bad-token", "1");
    assert(false, "Should have thrown");
  } catch (err) {
    assert(
      err.message.includes("fetchCategories failed"),
      "Error message should mention fetchCategories"
    );
    console.log("PASS testFetchCategoriesApiError");
  }
}

async function testEmptyResponsesHandledGracefully() {
  global.fetch = makeFetchMock({
    "/api/v3/categories": {},  // no `categories` key
  });

  const results = await fetchCategories(
    "https://sdp.example.com",
    "token",
    REQUEST_TYPE.SERVICE_REQUEST
  );
  assert(Array.isArray(results) && results.length === 0, "Should return empty array");
  console.log("PASS testEmptyResponsesHandledGracefully");
}

// ---------------------------------------------------------------------------
// DOM controller tests (minimal DOM simulation)
// ---------------------------------------------------------------------------

function makeSelectEl(id, options = []) {
  const el = {
    id,
    value: "",
    disabled: false,
    innerHTML: "",
    _listeners: {},
    addEventListener(event, fn) {
      this._listeners[event] = fn;
    },
    appendChild(child) {
      if (child.value === "") return; // skip placeholder for value tracking
    },
    trigger(event) {
      if (this._listeners[event]) this._listeners[event]();
    },
  };
  return el;
}

async function testControllerClearsDownstreamOnRequestTypeChange() {
  // Stub document.getElementById
  const elements = {
    request_type: makeSelectEl("request_type"),
    category: makeSelectEl("category"),
    subcategory: makeSelectEl("subcategory"),
    item: makeSelectEl("item"),
  };

  global.document = {
    getElementById: (id) => elements[id],
    createElement: (tag) => ({
      value: "",
      textContent: "",
    }),
  };

  global.fetch = makeFetchMock({
    "/api/v3/categories": { categories: [{ id: 1, name: "Cat A" }] },
  });

  const ctrl = new CategoryVisibilityController({
    baseUrl: "https://sdp.example.com",
    authToken: "tok",
    requestTypeSelectId: "request_type",
    categorySelectId: "category",
    subcategorySelectId: "subcategory",
    itemSelectId: "item",
  });

  ctrl.init();

  // Simulate user picking an Incident request type
  elements.request_type.value = REQUEST_TYPE.INCIDENT;
  await elements.request_type.trigger("change");

  // After change, subcategory and item should be cleared/disabled
  assert(elements.subcategory.disabled === true, "Subcategory should be disabled after request type change");
  assert(elements.item.disabled === true, "Item should be disabled after request type change");

  console.log("PASS testControllerClearsDownstreamOnRequestTypeChange");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;

  const tests = [
    testFetchCategoriesIncident,
    testFetchCategoriesServiceRequest,
    testFetchSubcategories,
    testFetchItems,
    testFetchCategoriesApiError,
    testEmptyResponsesHandledGracefully,
    testControllerClearsDownstreamOnRequestTypeChange,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`FAIL ${test.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
