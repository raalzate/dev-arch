# Source before running iikit scripts from apps/dev-arch:
#   source scripts/iikit-env.sh
# Makes `git rev-parse --show-toplevel` resolve to the product root (apps/dev-arch).
_iikit_shim="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/iikit-git-shim"
case ":$PATH:" in *":$_iikit_shim:"*) ;; *) export PATH="$_iikit_shim:$PATH" ;; esac
unset _iikit_shim
