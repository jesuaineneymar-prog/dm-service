#!/usr/bin/env python3
"""Find the correct project/team on Railway."""
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
    return data["data"]

# Check teams
print("=== Teams ===")
data = gql("""{
  me {
    teams {
      edges {
        node {
          id
          name
        }
      }
    }
  }
}""")
if data:
    teams = data["me"]["teams"]["edges"]
    print(f"Found {len(teams)} team(s):")
    for edge in teams:
        t = edge["node"]
        print(f"  - {t['name']} (id: {t['id']})")

print()

# Try projects with team context
print("=== All projects (via me) ===")
data = gql("""{
  projects {
    edges {
      node {
        id
        name
        team {
          id
          name
        }
      }
    }
  }
}""")
if data:
    projects = data["projects"]["edges"]
    print(f"Found {len(projects)} project(s):")
    for edge in projects:
        p = edge["node"]
        team_name = p["team"]["name"] if p.get("team") else "personal"
        print(f"  - {p['name']} (id: {p['id']}, team: {team_name})")

print()

# Try the project ID directly (maybe it's a deployment/service ID?)
print("=== Trying project ID directly ===")
data = gql(f'{{ project(id: "acc6bfb1-9cd7-42ac-a862-fa1e14196a33") {{ id name }} }}')
if data:
    print(f"Project found: {data}")
else:
    print("Project NOT found with that ID")

# Try listing deployments/services
print()
print("=== Trying to find by deployment ===")
data = gql(f'{{ deployment(id: "acc6bfb1-9cd7-42ac-a862-fa1e14196a33") {{ id url }} }}')
if data:
    print(f"Deployment found: {data}")
else:
    print("Not a deployment ID")

print()
print("=== Trying to find by service ===")
data = gql(f'{{ service(id: "acc6bfb1-9cd7-42ac-a862-fa1e14196a33") {{ id name }} }}')
if data:
    print(f"Service found: {data}")
else:
    print("Not a service ID")