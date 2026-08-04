#!/usr/bin/env python3
"""List all Railway projects to find the right one."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

query = """
query {
  projects {
    edges {
      node {
        id
        name
        createdAt
      }
    }
  }
}
"""

resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=30)
data = resp.json()

if "errors" in data:
    print(f"Error: {json.dumps(data['errors'], indent=2)}")
else:
    projects = data["data"]["projects"]["edges"]
    print(f"Found {len(projects)} project(s):\n")
    for edge in projects:
        p = edge["node"]
        print(f"  Name: {p['name']}")
        print(f"  ID:   {p['id']}")
        print(f"  Created: {p['createdAt']}")
        print()