#!/usr/bin/env python3
"""Check Railway deployment status and test the endpoint."""
import requests
import json
import time

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

# Try to get deployments for the project
query = """
{
  deployments {
    edges {
      node {
        id
        status
        createdAt
      }
    }
  }
}
"""

resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
data = resp.json()
print(json.dumps(data, indent=2))
