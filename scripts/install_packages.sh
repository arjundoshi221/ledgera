#!/usr/bin/env bash
# Bash helper to install packages for the Ledgera project
# Usage examples:
#   ./install_packages.sh create_env ./env 3.11
#   ./install_packages.sh install_requirements /path/to/env
#   ./install_packages.sh install_package /path/to/env yfinance

set -euo pipefail

ACTION=${1:-}
ENVPATH=${2:-./env}
PY=${3:-3.11}
PACKAGE=${3:-}

CONDA_EXE=${CONDA_EXE:-/opt/conda/bin/conda}
if [ ! -x "$CONDA_EXE" ]; then
  # fallback to conda on PATH
  CONDA_EXE=conda
fi

case "$ACTION" in
  create_env)
    echo "Creating conda env at $ENVPATH with python $PY"
    "$CONDA_EXE" create -p "$ENVPATH" python=$PY -y
    ;;

  install_requirements)
    echo "Installing requirements.txt into $ENVPATH"
    "$CONDA_EXE" run -p "$ENVPATH" --no-capture-output pip install -r requirements.txt
    ;;

  install_conda_then_pip)
    echo "Installing numpy/pandas via conda, then pip for the rest"
    "$CONDA_EXE" install -p "$ENVPATH" -y numpy pandas
    "$CONDA_EXE" run -p "$ENVPATH" --no-capture-output pip install -r requirements.txt
    ;;

  install_package)
    if [ -z "$3" ]; then
      echo "Usage: $0 install_package /path/to/env package-name"; exit 1
    fi
    echo "Installing package $3 into $ENVPATH"
    "$CONDA_EXE" run -p "$ENVPATH" --no-capture-output pip install "$3"
    ;;

  pip_list)
    echo "Listing pip packages in $ENVPATH"
    "$CONDA_EXE" run -p "$ENVPATH" --no-capture-output pip list
    ;;

  freeze)
    echo "Freezing installed packages to requirements-locked.txt"
    "$CONDA_EXE" run -p "$ENVPATH" --no-capture-output pip freeze > requirements-locked.txt
    ;;

  *)
    echo "Usage: $0 {create_env|install_requirements|install_conda_then_pip|install_package|pip_list|freeze} [env_path] [python|package]"
    exit 1
    ;;
esac
