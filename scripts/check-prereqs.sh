#!/usr/bin/env bash
# Prerequisites of the dev-arch product commands (FR-011, contracts/make-targets.md).
#   jdk     $JAVA_HOME/bin/java (or java on the PATH) with major version exactly 17
#   dotnet  a .NET SDK >= 8 and the .NET 8 runtime (Microsoft.NETCore.App 8.x)
#   node    Node >= 20 and npm
# One "[prereqs] <tool>: OK|FAIL — detail" line per tool; exits 2 at the first FAIL, before anything compiles.
set -u
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

fail() { status prereqs "$1" FAIL "$2"; exit 2; }

# ---------------------------------------------------------------- jdk
jb="$(java_bin)"
if [ -z "$jb" ]; then
  if [ -n "${JAVA_HOME:-}" ]; then
    fail jdk "JDK 17 required (found none at JAVA_HOME=$JAVA_HOME); set JAVA_HOME to a JDK 17"
  fi
  fail jdk "JDK 17 required (found none); set JAVA_HOME to a JDK 17"
fi
major="$(java_major "$jb")"
if [ "$major" != "17" ]; then
  fail jdk "JDK 17 required (found ${major:-unknown} at $jb); set JAVA_HOME to a JDK 17"
fi
status prereqs jdk OK "17 ($jb)"

# ---------------------------------------------------------------- dotnet
if ! command -v dotnet >/dev/null 2>&1; then
  fail dotnet ".NET SDK >= 8 and .NET 8 runtime required (found none)"
fi
sdks="$(dotnet --list-sdks 2>/dev/null | awk '{print $1}' | paste -sd, - | sed 's/,/, /g')"
runtimes="$(dotnet --list-runtimes 2>/dev/null | awk '$1 == "Microsoft.NETCore.App" {print $2}' | paste -sd, - | sed 's/,/, /g')"
sdk_ok="$(dotnet --list-sdks 2>/dev/null | awk '{split($1, v, "."); if (v[1] + 0 >= 8) ok = 1} END {print ok + 0}')"
runtime_ok="$(dotnet --list-runtimes 2>/dev/null | awk '$1 == "Microsoft.NETCore.App" && $2 ~ /^8\./ {ok = 1} END {print ok + 0}')"
if [ "$sdk_ok" != "1" ] || [ "$runtime_ok" != "1" ]; then
  fail dotnet ".NET SDK >= 8 and .NET 8 runtime required (found SDK ${sdks:-none}; runtime ${runtimes:-none})"
fi
status prereqs dotnet OK "SDK ${sdks}; runtime ${runtimes}"

# ---------------------------------------------------------------- node
node_v="$(node --version 2>/dev/null | sed -E 's/^v//')"
node_major="${node_v%%.*}"
if [ -z "$node_v" ]; then
  fail node "Node 20+ required (found none)"
fi
if ! [ "$node_major" -ge 20 ] 2>/dev/null; then
  fail node "Node 20+ required (found $node_major)"
fi
if ! command -v npm >/dev/null 2>&1; then
  fail node "Node 20+ with npm required (found Node $node_major without npm)"
fi
status prereqs node OK "$node_v"
