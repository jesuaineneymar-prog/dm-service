#!/usr/bin/env python3
"""Explore Railway API schema and available queries."""
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
    return resp.json()

# Full me query
print("=== Full 'me' query ===")
data = gql("""{
  me {
    id
    email
    name
    avatar
    admin
    verified
  }
}""")
print(json.dumps(data, indent=2))

print("\n=== Try updatableProjects ===")
data = gql("""{
  updatableProjects {
    edges {
      node {
        id
        name
      }
    }
  }
}""")
print(json.dumps(data, indent=2))

print("\n=== Try project by searching ===")
data = gql("""{
  projects(search: "aura") {
    edges {
      node {
        id
        name
        createdAt
      }
    }
  }
}""")
print(json.dumps(data, indent=2))

print("\n=== Try projects with first:100 ===")
data = gql("""{
  projects(first: 100) {
    edges {
      node {
        id
        name
      }
    }
  }
}""")
print(json.dumps(data, indent=2))
