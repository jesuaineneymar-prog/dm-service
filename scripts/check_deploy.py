#!/usr/bin/env python3
import requests, json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"
SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"

resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": f'{{ service(id: "{SERVICE_ID}") {{ deployments {{ edges {{ node {{ id status createdAt }} }} }} }} }}'}, timeout=15)
data = resp.json()
for edge in data["data"]["service"]["deployments"]["edges"][:3]:
    d = edge["node"]
    print(f"{d['createdAt']}  {d['status']}  {d['id'][:12]}")
