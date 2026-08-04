#!/usr/bin/env python3
"""Debug Railway API - try different endpoints."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# Try v1
print("=== Trying GraphQL v1 ===")
try:
    resp = requests.post(
        "https://backboard.railway.app/graphql/v1",
        headers=HEADERS,
        json={"query": "{ me { id email } }"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")

print()

# Try v2 introspection
print("=== Trying v2 me query ===")
try:
    resp = requests.post(
        "https://backboard.railway.app/graphql/v2",
        headers=HEADERS,
        json={"query": "{ me { id email name } }"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")

print()

# Try REST API
print("=== Trying REST API ===")
try:
    resp = requests.get(
        "https://backboard.railway.app/api/v1/projects",
        headers=HEADERS,
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")

print()

# Try without Bearer
print("=== Trying without Bearer prefix ===")
try:
    resp = requests.post(
        "https://backboard.railway.app/graphql/v2",
        headers={"Authorization": TOKEN, "Content-Type": "application/json"},
        json={"query": "{ projects { edges { node { id name } } } }"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")