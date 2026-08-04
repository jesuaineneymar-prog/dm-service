#!/usr/bin/env python3
"""Set BRIGHT_DATA_WS_ENDPOINT env var on Railway via GraphQL API."""
import requests
import json
import sys

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
PROJECT_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
WS_ENDPOINT = "wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

def graphql(query, variables=None):
    """Execute a GraphQL query/mutation."""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json=payload, timeout=30)
    data = resp.json()
    if "errors" in data:
        print(f"GraphQL Error: {json.dumps(data['errors'], indent=2)}")
        sys.exit(1)
    return data

# Step 1: Get services in the project
print("=== Step 1: Getting project services ===")
query1 = """
query {
  project(id: "PROJECT_ID") {
    services {
      edges {
        node {
          id
          name
        }
      }
    }
  }
}
""".replace("PROJECT_ID", PROJECT_ID)

result = graphql(query1)
services = result["data"]["project"]["services"]["edges"]

if not services:
    print("No services found!")
    sys.exit(1)

print(f"Found {len(services)} service(s):")
service_id = None
for edge in services:
    svc = edge["node"]
    print(f"  - {svc['name']} (id: {svc['id']})")
    # Pick the first service (likely the web app)
    if service_id is None:
        service_id = svc["id"]

print(f"\nUsing service: {service_id}")

# Step 2: Get current environment variables
print("\n=== Step 2: Getting current environment variables ===")
query2 = """
query {
  service(id: "SERVICE_ID") {
    serviceVariables {
      edges {
        node {
          id
          name
          value
        }
      }
    }
  }
}
""".replace("SERVICE_ID", service_id)

result2 = graphql(query2)
existing_vars = result2["data"]["service"]["serviceVariables"]["edges"]
print(f"Found {len(existing_vars)} existing env var(s):")
for edge in existing_vars:
    v = edge["node"]
    val_display = v["value"][:50] + "..." if len(v["value"]) > 50 else v["value"]
    print(f"  - {v['name']} = {val_display}")

# Check if BRIGHT_DATA_WS_ENDPOINT already exists
bd_var_id = None
for edge in existing_vars:
    v = edge["node"]
    if v["name"] == "BRIGHT_DATA_WS_ENDPOINT":
        bd_var_id = v["id"]
        print(f"\nFound existing BRIGHT_DATA_WS_ENDPOINT (id: {bd_var_id}), will update.")
        break

# Step 3: Set/update the env var
print("\n=== Step 3: Setting BRIGHT_DATA_WS_ENDPOINT ===")
if bd_var_id:
    # Update existing
    mutation = """
    mutation UpdateVariable($id: String!, $value: String!) {
      serviceVariableUpdate(id: $id, value: $value) {
        id
        name
        value
      }
    }
    """
    variables = {"id": bd_var_id, "value": WS_ENDPOINT}
    result3 = graphql(mutation, variables)
    print(f"Updated: {json.dumps(result3['data'], indent=2)}")
else:
    # Create new
    mutation = """
    mutation CreateVariable($serviceId: String!, $name: String!, $value: String!) {
      serviceVariableCreate(serviceId: $serviceId, name: $name, value: $value) {
        id
        name
        value
      }
    }
    """
    variables = {"serviceId": service_id, "name": "BRIGHT_DATA_WS_ENDPOINT", "value": WS_ENDPOINT}
    result3 = graphql(mutation, variables)
    print(f"Created: {json.dumps(result3['data'], indent=2)}")

print("\n=== DONE! ===")
print(f"BRIGHT_DATA_WS_ENDPOINT = {WS_ENDPOINT}")
print("Railway will auto-redeploy with the new env var.")