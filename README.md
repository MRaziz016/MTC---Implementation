# MTC — Implementation

## ServiceDesk Plus Cloud: Category / Sub Category / Item Visibility by Request Type

### Problem

When a technician creates a ticket in ServiceDesk Plus Cloud, the **Category**, **Sub Category**, and **Item** dropdowns currently show all values regardless of whether the ticket is an **Incident** or a **Service Request**.

This causes confusion because:
- Incident-specific sub categories and items appear when creating a Service Request.
- Service Request-specific sub categories and items appear when creating an Incident.

### Solution

`src/categoryVisibility.js` provides:

1. **API helpers** — `fetchCategories`, `fetchSubcategories`, `fetchItems` — each accepting a `requestTypeId` parameter (`"1"` = Incident, `"2"` = Service Request) and filtering the SDP Cloud API response accordingly.
2. **`CategoryVisibilityController`** — a class that wires the three dropdowns together so that:
   - Changing the **Request Type** clears and repopulates the **Category** list (only values valid for that type).
   - Changing the **Category** clears and repopulates the **Sub Category** list (scoped to both the category and the request type).
   - Changing the **Sub Category** clears and repopulates the **Item** list (scoped to the subcategory and request type).

Downstream dropdowns are **disabled** while data is loading, preventing invalid selections.

---

### Usage

```html
<!-- Your ticket-creation form must have these four <select> elements -->
<select id="request_type">
  <option value="">--- Select ---</option>
  <option value="1">Incident</option>
  <option value="2">Service Request</option>
</select>

<select id="category"></select>
<select id="subcategory"></select>
<select id="item"></select>

<script src="categoryVisibility.js"></script>
<script>
  const controller = new CategoryVisibilityController({
    baseUrl:             "https://your-portal.sdpondemand.com",
    authToken:           "YOUR_TECHNICIAN_API_KEY",
    requestTypeSelectId: "request_type",
    categorySelectId:    "category",
    subcategorySelectId: "subcategory",
    itemSelectId:        "item",
  });

  controller.init();
</script>
```

#### ES Module / Node.js

```js
const { CategoryVisibilityController, fetchCategories, REQUEST_TYPE } =
  require("./src/categoryVisibility");
```

---

### SDP Cloud API filtering

| Dropdown     | API endpoint            | Filter applied                                      |
|--------------|-------------------------|-----------------------------------------------------|
| Category     | `GET /api/v3/categories`   | `request_type.id = <1 or 2>`                        |
| Sub Category | `GET /api/v3/subcategories`| `category.id = <id>` **AND** `request_type.id = <1 or 2>` |
| Item         | `GET /api/v3/items`        | `subcategory.id = <id>` **AND** `request_type.id = <1 or 2>` |

Request type IDs:

| Value | Meaning         |
|-------|-----------------|
| `"1"` | Incident        |
| `"2"` | Service Request |

---

### Running tests

```bash
node src/categoryVisibility.test.js
```

Expected output:

```
PASS testFetchCategoriesIncident
PASS testFetchCategoriesServiceRequest
PASS testFetchSubcategories
PASS testFetchItems
PASS testFetchCategoriesApiError
PASS testEmptyResponsesHandledGracefully
PASS testControllerClearsDownstreamOnRequestTypeChange

Results: 7 passed, 0 failed
```
