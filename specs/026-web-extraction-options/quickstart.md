# Quickstart: 026
```bash
curl -X POST "http://localhost:9002/api/analyses?language=dotnet&config=$(python3 -c 'import urllib.parse,json;print(urllib.parse.quote(json.dumps({"detection":{"maxDepth":3},"analysis":{"extended":"on"}})))')" -H 'Content-Type: application/zip' --data-binary @project.zip
```
