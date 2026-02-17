# Ledgera — Install & package helper commands

This folder contains helper scripts and instructions to install project dependencies into a Conda environment or a local venv.

Files:

- `install_packages.ps1` — PowerShell helper for Windows/PowerShell users.
- `install_packages.sh` — Bash helper for Linux/macOS or WSL.

Usage notes

- If `conda` is not on your PATH, call the `conda.exe` binary directly (e.g. `C:\ProgramData\anaconda3\Scripts\conda.exe`).
- For large binary packages (NumPy, pandas) prefer installing those via `conda` first, then use `pip` for the rest.

Common commands

1) Create a new environment (repo-local):

```powershell
C:\ProgramData\anaconda3\Scripts\conda.exe create -p .\env python=3.11 -y
```

2) Install everything from `requirements.txt` into an env path without activating:

```powershell
C:\ProgramData\anaconda3\Scripts\conda.exe run -p "C:\Users\arjd2\Documents\GitHub\ledgera\.conda" --no-capture-output pip install -r requirements.txt
```

3) Install heavy packages with conda first, then pip for the remainder (recommended on Windows):

```powershell
C:\ProgramData\anaconda3\Scripts\conda.exe install -p "C:\Users\arjd2\Documents\GitHub\ledgera\.conda" -y numpy pandas
C:\ProgramData\anaconda3\Scripts\conda.exe run -p "C:\Users\arjd2\Documents\GitHub\ledgera\.conda" --no-capture-output pip install -r requirements.txt
```

4) Install a single package into the env (example: `yfinance`):

```powershell
C:\ProgramData\anaconda3\Scripts\conda.exe run -p "C:\Users\arjd2\Documents\GitHub\ledgera\.conda" --no-capture-output pip install yfinance
```

5) Verify installed packages in the env:

```powershell
C:\ProgramData\anaconda3\Scripts\conda.exe run -p "C:\Users\arjd2\Documents\GitHub\ledgera\.conda" --no-capture-output pip list
```

6) Lock currently installed packages to a `requirements-locked.txt`:

```powershell
C:\ProgramData\anaconda3\Scripts\conda.exe run -p "C:\Users\arjd2\Documents\GitHub\ledgera\.conda" --no-capture-output pip freeze > requirements-locked.txt
```

See the helper scripts in this folder for one-command flows.
