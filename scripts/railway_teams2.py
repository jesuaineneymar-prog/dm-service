#!/usr/bin/env python3
"""Try team-based queries on Railway API."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

def gql(query):
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Try team query
print("=== Try teams query ===")
data = gql("{ teams { edges { node { id name } } } }")
if data:
    print(json.dumps(data, indent=2))

# Try me with all possible fields
print("\n=== Me full ===")
data = gql("""{
  me {
    id
    email
    name
    avatar
    isAdmin
    isVerified
  }
}""")
if data:
    print(json.dumps(data, indent=2))

# Try to find the project via the URL slug
print("\n=== Try project by ID (full UUID format) ===")
for pid in [
    "acc6bfb1-9cd7-42ac-a862-fa1e14196a33",
    "acc6bfb1-9cd7-42ac-a862-fa1e14196a33",
]:
    data = gql(f'{{ project(id: "{pid}") {{ id name description }} }}')
    if data and data.get('project'):
        print(f"Found: {json.dumps(data['project'], indent=2)}")
    else:
        print(f"Not found: {pid}")

# Try a broader search - list ALL resources
print("\n=== Try cabledViewer ===")
data = gql("""{
  projects {
    edges {
      node {
        id
        name
        description
        createdAt
        updatedAt
        deletedAt
      }
    }
  }
}""")
if data:
    projects = data.get("projects", {}).get("edges", [])
    print(f"Total: {len(projects)}")
    for p in projects:
        print(f"  {p['node']['name']} - {p['node']['id']}")

# The user may have the project under a different account
# Let's try using the serviceVariableCreate with a direct service ID
# First, let's see if we can access anything with the project ID as a service ID
print("\n=== Try as service ID ===")
data = gql(f'{{ service(id: "acc6bfb1-9cd7-42ac-a862-fa1e14196a33") {{ id name environment { id } }} }}')
print(json.dumps(data, indent=2) if data else "No data")