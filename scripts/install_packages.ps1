<#
PowerShell helper to manage environment installs for Ledgera.

Usage examples:
  # Create a repo-local conda env
  .\install_packages.ps1 -Action create_env -EnvPath .\env -Python 3.11

  # Install requirements into existing env path
  .\install_packages.ps1 -Action install_requirements -EnvPath "C:\Users\arjd2\Documents\GitHub\ledgera\.conda"

  # Install a single package
  .\install_packages.ps1 -Action install_package -EnvPath .\env -Package yfinance

#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('create_env','install_requirements','install_conda_then_pip','install_package','pip_list','freeze')]
    [string]$Action,

    [string]$EnvPath = ".\env",
    [string]$Python = "3.11",
    [string]$Package = "",
    [string]$CondaExe = "C:\ProgramData\anaconda3\Scripts\conda.exe"
)

function Run-Conda([string]$Args) {
    $exe = $CondaExe
    if (-not (Test-Path $exe)) {
        Write-Error "Conda executable not found at $exe. Update \$CondaExe parameter or add conda to PATH."
        exit 1
    }
    & $exe $Args
}

switch ($Action) {
    'create_env' {
        Write-Host "Creating conda env at: $EnvPath with Python $Python"
        Run-Conda "create -p `"$EnvPath`" python=$Python -y"
        break
    }

    'install_requirements' {
        Write-Host "Installing packages from requirements.txt into: $EnvPath"
        Run-Conda "run -p `"$EnvPath`" --no-capture-output pip install -r requirements.txt"
        break
    }

    'install_conda_then_pip' {
        Write-Host "Installing heavy packages with conda, then pip for rest"
        Run-Conda "install -p `"$EnvPath`" -y numpy pandas"
        Run-Conda "run -p `"$EnvPath`" --no-capture-output pip install -r requirements.txt"
        break
    }

    'install_package' {
        if (-not $Package) { Write-Error "Please provide -Package name"; exit 1 }
        Write-Host "Installing package $Package into $EnvPath"
        Run-Conda "run -p `"$EnvPath`" --no-capture-output pip install $Package"
        break
    }

    'pip_list' {
        Write-Host "Listing pip packages in $EnvPath"
        Run-Conda "run -p `"$EnvPath`" --no-capture-output pip list"
        break
    }

    'freeze' {
        Write-Host "Freezing packages from $EnvPath to requirements-locked.txt"
        Run-Conda "run -p `"$EnvPath`" --no-capture-output pip freeze > requirements-locked.txt"
        break
    }
}
